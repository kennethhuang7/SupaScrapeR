import sys
import time
import traceback
import os
import json
import platform
from datetime import datetime, timezone
from PyQt5.QtCore import Qt, pyqtSignal, QThread, QStandardPaths, QSize, QTimer
from PyQt5.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QHBoxLayout, QPushButton, QLabel,
    QCheckBox, QScrollArea, QGridLayout, QMessageBox, QStackedWidget, QTextEdit,
    QProgressBar, QSizePolicy, QFrame, QFileDialog
)
from PyQt5.QtGui import QFont, QPalette, QColor, QIcon, QPixmap
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from pytrends.request import TrendReq
from supabase import create_client
import html as html_lib
from cryptography.fernet import Fernet
ERROR_LOG_FILE = "error_log.txt"
USER_DATA_FILE = "user_presets.json"
LAST_FOLDER_FILE = "last_folder.txt"
MAX_COMMENTS = 50
SLEEP_BETWEEN_CYCLES = 600
CREDENTIALS_FILE = "scraper_credentials.dat"
BROAD_SUBREDDITS = [
    "politics","Conservative","Republican","democrats","NewsAndPolitics",
    "AmericanPolitics","uspolitics","NeutralPolitics","popculture",
    "popculturechat","newjersey","GenZ","lgbt","law","NoFilterNews","news",
    "worldnews","GlobalNews","goodnews","Millennials","teenagers","technews",
    "finance","Parenting","Parents","blackladies","asian","scotus","centrist",
    "geopolitics","anime_titties","nyc","HeadlineWorthy"
]
CONCENTRATED_SUBREDDITS = [
    "politics","Conservative","Republican","democrats","NewsAndPolitics",
    "AmericanPolitics","uspolitics","NeutralPolitics","NoFilterNews",
    "PoliticalDiscussion","scotus","centrist","geopolitics","anime_titties"
]
KEYWORD_BATCH_SIZES = [5, 10, 25, 50]
DEEPSCAN_BATCH_SIZES = [5, 10, 25, 50, 100]
DEFAULT_KEYWORD_BATCH_SIZE = 10
DEFAULT_DEEPSCAN_BATCH_SIZE = 25
reddit = None
analyzer = SentimentIntensityAnalyzer()
supabase = None
DATA_FOLDER = None
def get_config_folder():
    try:
        documents = QStandardPaths.writableLocation(QStandardPaths.DocumentsLocation)
        if not documents:
            documents = os.path.expanduser("~")
        config_folder = os.path.join(documents, "SupaScrapeR")
        os.makedirs(config_folder, exist_ok=True)
        test_file = os.path.join(config_folder, "test_write.tmp")
        try:
            with open(test_file, 'w') as f:
                f.write("test")
            os.remove(test_file)
        except Exception as e:
            print(f"No write permission in config folder {config_folder}: {e}")
            import tempfile
            config_folder = os.path.join(tempfile.gettempdir(), "SupaScrapeR")
            os.makedirs(config_folder, exist_ok=True)
        return config_folder
    except Exception as e:
        print(f"Failed to get config folder: {e}")
        import tempfile
        return tempfile.gettempdir()

def log_error(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        config_folder = get_config_folder()
        log_file = os.path.join(config_folder, ERROR_LOG_FILE)
        if not isinstance(message, str):
            message = str(message) if message is not None else "None"
        os.makedirs(config_folder, exist_ok=True)
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] {message}\n")
            f.flush()
    except Exception as e:
        try:
            print(f"Failed to log error: {e}")
            print(f"Original message: {message}")
        except:
            print("Critical logging failure")

def safe_praw_patch():
    try:
        import praw.config
        original_fetch = praw.config.Config._fetch
        def safe_fetch(self, item):
            try:
                return original_fetch(self, item)
            except KeyError:
                defaults = {
                    'comment_kind': 't1',
                    'message_kind': 't4',
                    'redditor_kind': 't2', 
                    'submission_kind': 't3',
                    'subreddit_kind': 't5',
                    'trophy_kind': 't6',
                    'oauth_url': 'https://www.reddit.com/api/v1/authorize',
                    'reddit_url': 'https://oauth.reddit.com',
                    'short_url': 'https://redd.it',
                    'timeout': '16',
                    'check_for_updates': 'False'
                }
                if item in defaults:
                    log_error(f"Providing default for missing config: {item} = {defaults[item]}")
                    return defaults[item]
                else:
                    log_error(f"No default available for missing config: {item}")
                    return ""
        praw.config.Config._fetch = safe_fetch
        log_error("Successfully patched PRAW configuration")
        return True
    except Exception as e:
        log_error(f"PRAW patching failed (this is OK): {e}")
        return False
safe_praw_patch()
try:
    import praw
    log_error("PRAW imported successfully")
except Exception as e:
    log_error(f"PRAW import failed: {e}")
def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    try:
        path = os.path.join(base_path, relative_path)
        if os.path.exists(path):
            return path
    except (UnicodeDecodeError, UnicodeError) as e:
        log_error(f"Unicode error with path {relative_path}: {e}")
    try:
        assets_path = os.path.join(base_path, "assets", os.path.basename(relative_path))
        if os.path.exists(assets_path):
            return assets_path
    except Exception as e:
        log_error(f"Error checking assets path: {e}")
    try:
        dev_path = os.path.join(os.path.dirname(__file__), relative_path)
        if os.path.exists(dev_path):
            return dev_path
    except Exception as e:
        log_error(f"Error checking dev path: {e}")
    log_error(f"⚠️ Resource not found: {relative_path}. Searched in {base_path}")
    return os.path.join(base_path, relative_path)

def get_app_icon():
    try:
        if platform.system() == "Darwin":
            icon_path = resource_path("assets/supascraper-icon.icns")
        else:
            icon_path = resource_path("assets/supascraper-icon.ico")
        if os.path.exists(icon_path):
            return QIcon(icon_path)
        else:
            log_error(f"Icon file not found at {icon_path}")
            return None
    except Exception as e:
        log_error(f"Error loading app icon: {e}")
        return None
    
eye_closed_path = resource_path("assets/eye_closed.png")
eye_open_path = resource_path("assets/eye_open.png")

def get_sentiment(text):
    return analyzer.polarity_scores(text or "")["compound"]

def is_mod_or_bot_comment(comment):
    if hasattr(comment, 'body'):
        body = comment.body
    else:
        body = getattr(comment, 'text', '')
    if body.strip().lower() in ["[deleted]", "[removed]"]:
        return True
    if hasattr(comment, 'author') and comment.author:
        if hasattr(comment.author, 'name'):
            author_name = comment.author.name
        else:
            author_name = str(comment.author)
        if author_name.lower() in ["automoderator", "automod"]:
            return True
    else:
        return True 
    lower_body = body.lower()
    if "i am a bot" in lower_body or "/message/compose/?" in lower_body:
        return True
    return False

def batch_process_submissions(submissions, batch_size=25):
    try:
        for i in range(0, len(submissions), batch_size):
            yield submissions[i:i + batch_size]
    except Exception as e:
        log_error(f"Error in batch_process_submissions: {e}")
        yield []

def format_utc(ts):
    dt = datetime.fromtimestamp(ts, tz=timezone.utc)
    s = dt.strftime("%m/%d/%Y, %I:%M%p UTC")
    s = s.replace("/0", "/").replace(", 0", ", ")
    return s

def get_last_used_folder():
    try:
        config_folder = get_config_folder()
        last_folder_path = os.path.join(config_folder, LAST_FOLDER_FILE)
        if os.path.exists(last_folder_path):
            with open(last_folder_path, "r", encoding="utf-8") as f:
                folder = f.read().strip()
                if folder and os.path.exists(folder):
                    return os.path.normpath(folder)
        default_folder = os.path.normpath(config_folder)
        if not os.path.exists(default_folder):
            os.makedirs(default_folder, exist_ok=True)
            log_error(f"Created default folder: {default_folder}")
        return default_folder
    except Exception as e:
        log_error(f"Failed to get last used folder: {e}")
        return os.path.normpath(get_config_folder())

def save_last_used_folder(folder_path):
    try:
        config_folder = get_config_folder()
        last_folder_path = os.path.join(config_folder, LAST_FOLDER_FILE)
        norm_path = os.path.normpath(folder_path)
        with open(last_folder_path, "w", encoding="utf-8") as f:
            f.write(norm_path)
        return True
    except Exception as e:
        log_error(f"Failed to save last used folder: {e}")
        return False

def create_reddit_client_safe(client_id, client_secret, user_agent):
    try:
        if 'praw' not in globals():
            raise Exception("PRAW not available")
        log_error("Attempting to create Reddit client with complete config")
        reddit_client = praw.Reddit(
            client_id=str(client_id).strip(),
            client_secret=str(client_secret).strip(),
            user_agent=str(user_agent).strip(),
            site_name=None
        ) 
        log_error("Successfully created Reddit client")
        return reddit_client
    except Exception as e:
        log_error(f"PRAW Reddit client creation failed: {e}")
        try:
            log_error("Attempting to create minimal Reddit client")
            minimal_client = create_minimal_reddit_client(client_id, client_secret, user_agent)
            log_error("Successfully created minimal Reddit client - returning it")
            return minimal_client 
        except Exception as e2:
            log_error(f"Minimal Reddit client also failed: {e2}")
            raise Exception(f"All Reddit client creation methods failed. PRAW error: {e}, Minimal error: {e2}")

def create_minimal_reddit_client(client_id, client_secret, user_agent):
    import requests
    log_error(f"Creating minimal client with ID: {client_id[:10]}... and agent: {user_agent}")

    class MinimalRedditClient:
        def __init__(self, client_id, client_secret, user_agent):
            self.client_id = client_id
            self.client_secret = client_secret
            self.user_agent = user_agent
            self.access_token = None
            self.session = requests.Session()
            self.session.headers.update({'User-Agent': user_agent})
            log_error("MinimalRedditClient initialized, getting access token...")
            self._get_access_token()
            
        def _get_access_token(self):
            try:
                log_error("Requesting access token from Reddit...")
                auth = requests.auth.HTTPBasicAuth(self.client_id, self.client_secret)
                data = {'grant_type': 'client_credentials'}
                headers = {'User-Agent': self.user_agent}
                response = requests.post(
                    'https://www.reddit.com/api/v1/access_token',
                    auth=auth, 
                    data=data,
                    headers=headers,
                    timeout=10
                )
                log_error(f"Reddit token response status: {response.status_code}")                
                if response.status_code == 200:
                    token_data = response.json()
                    self.access_token = token_data.get('access_token')
                    if self.access_token:
                        self.session.headers.update({
                            'Authorization': f'bearer {self.access_token}'
                        })
                        log_error("Successfully obtained Reddit access token")
                    else:
                        raise Exception("No access token in response")
                else:
                    raise Exception(f"Failed to get access token: {response.status_code} - {response.text}")
            except Exception as e:
                log_error(f"Reddit authentication failed: {e}")
                raise Exception(f"Reddit authentication failed: {e}")
          
        def subreddit(self, name):
            log_error(f"Creating subreddit object for: {name}")
            return MinimalSubreddit(name, self)
    
    class MinimalSubreddit:
        def __init__(self, name, reddit_client):
            self.display_name = name
            self.reddit = reddit_client
            log_error(f"MinimalSubreddit created for: {name}")
            
        def hot(self, limit=25):
            try:
                log_error(f"Getting hot posts from r/{self.display_name}")
                url = f'https://oauth.reddit.com/r/{self.display_name}/hot'
                params = {'limit': min(limit, 100)}                
                response = self.reddit.session.get(url, params=params, timeout=10)
                log_error(f"Hot posts response status: {response.status_code}")              
                if response.status_code == 200:
                    data = response.json()
                    posts = [MinimalSubmission(post['data'], self.reddit) for post in data['data']['children']]
                    log_error(f"Retrieved {len(posts)} hot posts")
                    return posts
                else:
                    raise Exception(f"Failed to get hot posts: {response.status_code}")
            except Exception as e:
                log_error(f"Error getting hot posts: {e}")
                raise Exception(f"Error getting hot posts: {e}")
                
        def new(self, limit=25):
            try:
                url = f'https://oauth.reddit.com/r/{self.display_name}/new'
                params = {'limit': min(limit, 100)}
                response = self.reddit.session.get(url, params=params, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    return [MinimalSubmission(post['data'], self.reddit) for post in data['data']['children']]
                else:
                    raise Exception(f"Failed to get new posts: {response.status_code}")
            except Exception as e:
                raise Exception(f"Error getting new posts: {e}")
                
        def search(self, query, limit=25):
            try:
                url = f'https://oauth.reddit.com/r/{self.display_name}/search'
                params = {
                    'q': query,
                    'limit': min(limit, 100),
                    'sort': 'relevance',
                    'restrict_sr': 'true'
                }                
                response = self.reddit.session.get(url, params=params, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    return [MinimalSubmission(post['data'], self.reddit) for post in data['data']['children']]
                else:
                    raise Exception(f"Failed to search: {response.status_code}")
            except Exception as e:
                raise Exception(f"Error searching: {e}")
    
    class MinimalSubmission:
        def __init__(self, data, reddit_client=None):
            self.id = data.get('id', '')
            self.title = data.get('title', '')
            self.selftext = data.get('selftext', '')
            self.url = data.get('url', '')
            self.permalink = data.get('permalink', '')
            self.score = data.get('score', 0)
            self.upvote_ratio = data.get('upvote_ratio', 0.5)
            self.num_comments = data.get('num_comments', 0)
            self.created_utc = data.get('created_utc', 0)
            author_name = data.get('author')
            if author_name and author_name != '[deleted]':
                self.author = MinimalAuthor(author_name)
            else:
                self.author = None
            subreddit_name = data.get('subreddit', '')
            self.subreddit = MinimalSubredditName(subreddit_name)
            self.comments = MinimalComments(self.id, self.permalink, reddit_client)
            self.comment_sort = "top"
            
        def __str__(self):
            return f"MinimalSubmission(id={self.id}, title={self.title[:50]}...)"
    
    class MinimalAuthor:
        def __init__(self, name):
            self.name = name
            
        def __str__(self):
            return self.name
                
    class MinimalSubredditName:
        def __init__(self, name):
            self.display_name = name
            
        def __str__(self):
            return self.display_name
    
    class MinimalComments:
        def __init__(self, submission_id, permalink, reddit_client):
            self.submission_id = submission_id
            self.permalink = permalink
            self.reddit = reddit_client
            self._comments = []
            self._loaded = False
            
        def replace_more(self, limit=0):
            if self._loaded:
                return
                
            try:
                url = f'https://oauth.reddit.com{self.permalink}'
                params = {'limit': 500, 'depth': 10} 
                response = self.reddit.session.get(url, params=params, timeout=15)
                if response.status_code == 200:
                    data = response.json()
                    if len(data) >= 2 and 'data' in data[1]:
                        comments_data = data[1]['data']['children']                        
                        for comment_item in comments_data:
                            if comment_item['kind'] == 't1':
                                comment_data = comment_item['data']
                                if comment_data.get('body') in ['[deleted]', '[removed]', '']:
                                    continue
                                if comment_data.get('author') == 'AutoModerator':
                                    continue
                                comment = MinimalComment(comment_data)
                                self._comments.append(comment)                    
                    self._loaded = True
                    log_error(f"Loaded {len(self._comments)} comments for submission {self.submission_id}")
                else:
                    log_error(f"Failed to load comments: {response.status_code}")                    
            except Exception as e:
                log_error(f"Error loading comments: {e}")
                
        def __iter__(self):
            if not self._loaded:
                self.replace_more()
            return iter(self._comments)
            
        def __len__(self):
            if not self._loaded:
                self.replace_more()
            return len(self._comments)

    class MinimalComment:
        def __init__(self, data):
            self.id = data.get('id', '')
            self.body = data.get('body', '')
            self.score = data.get('score', 0)
            self.author = MinimalAuthor(data.get('author', '[deleted]'))
            
        def __str__(self):
            return f"MinimalComment(id={self.id}, score={self.score})"
    
    try:
        log_error("Creating MinimalRedditClient instance...")
        client = MinimalRedditClient(client_id, client_secret, user_agent)
        log_error("MinimalRedditClient instance created successfully")
        return client  
    except Exception as e:
        log_error(f"Failed to create minimal Reddit client: {e}")
        raise Exception(f"Minimal Reddit client creation failed: {e}")

def test_reddit_connection(reddit_client):
    try:
        log_error("DEBUG: test_reddit_connection starting")
        test_subreddit = reddit_client.subreddit('test')
        log_error(f"DEBUG: Got test subreddit object: {test_subreddit}")
        if hasattr(test_subreddit, 'display_name'):
            display_name = test_subreddit.display_name
            log_error(f"DEBUG: Got display name: {display_name}")
        else:
            display_name = 'test'
            log_error("DEBUG: Using minimal client, display name is 'test'")
        try:
            submissions = list(test_subreddit.hot(limit=1))
            log_error(f"DEBUG: Got {len(submissions)} submissions")
        except Exception as hot_error:
            log_error(f"DEBUG: Hot posts failed: {hot_error}")  
        log_error("DEBUG: Reddit connection test passed")
        return True, None
        
    except Exception as e:
        log_error(f"DEBUG: test_reddit_connection exception: {e}")
        log_error(f"DEBUG: test_reddit_connection exception type: {type(e)}")        
        try:
            error_msg = str(e)
            log_error(f"DEBUG: Error message: {error_msg}")
        except Exception as convert_error:
            log_error(f"DEBUG: Could not convert error to string: {convert_error}")
            error_msg = "connection error"
        if 'invalid_grant' in error_msg or 'unauthorized' in error_msg or '401' in error_msg:
            return False, "Invalid Reddit API credentials"
        elif 'forbidden' in error_msg or '403' in error_msg:
            return False, "Reddit API access forbidden - check your app permissions"
        elif 'not found' in error_msg or '404' in error_msg:
            return False, "Reddit API endpoint not found"
        elif 'timeout' in error_msg or 'network' in error_msg:
            return False, "Network timeout - check your internet connection"
        else:
            return False, f"Reddit connection failed: {error_msg}"

def test_supabase_connection(supabase_client):
    try:
        response = supabase_client.table('reddit_posts').select("post_id").limit(1).execute()
        if hasattr(response, 'error') and response.error:
            return False, f"Supabase error: {response.error}"  
        return True, None  
    except Exception as e:
        error_msg = str(e).lower()
        if 'invalid api key' in error_msg or 'unauthorized' in error_msg:
            return False, "Invalid Supabase service key"
        elif 'not found' in error_msg or '404' in error_msg:
            return False, "Supabase project not found - check your URL"
        elif 'forbidden' in error_msg:
            return False, "Supabase access forbidden - check your service key permissions"
        elif 'timeout' in error_msg or 'network' in error_msg:
            return False, "Network timeout connecting to Supabase"
        else:
            return False, f"Supabase connection failed: {str(e)}"

class CredentialsManager:
    def __init__(self, data_folder=None):
        self.data_folder = data_folder or get_config_folder()
        self.credentials_path = os.path.join(self.data_folder, CREDENTIALS_FILE)
        try:
            self.key = self.get_or_create_key()
        except Exception as e:
            log_error(f"Failed to initialize encryption key: {e}")
            from cryptography.fernet import Fernet
            self.key = Fernet.generate_key()
        
    def get_or_create_key(self):
        key_file = os.path.join(self.data_folder, ".scraper_key")
        if os.path.exists(key_file):
            try:
                with open(key_file, 'rb') as f:
                    key_data = f.read()
                    if len(key_data) == 44: 
                        return key_data
            except Exception as e:
                log_error(f"Failed to read existing encryption key: {e}")
        try:
            from cryptography.fernet import Fernet
            key = Fernet.generate_key()
            os.makedirs(self.data_folder, exist_ok=True)
            with open(key_file, 'wb') as f:
                f.write(key)
            if os.name == 'nt':
                try:
                    import ctypes
                    ctypes.windll.kernel32.SetFileAttributesW(key_file, 2)
                except Exception as e:
                    log_error(f"Could not hide key file: {e}")
            return key
        except Exception as e:
            log_error(f"Failed to create encryption key: {e}")
            raise

    def save_credentials(self, supabase_url, service_key, reddit_client_id, 
                         reddit_client_secret, reddit_user_agent):
        try:
            from cryptography.fernet import Fernet
            fernet = Fernet(self.key)
            data = {
                'supabase_url': supabase_url,
                'service_key': service_key,
                'reddit_client_id': reddit_client_id,
                'reddit_client_secret': reddit_client_secret,
                'reddit_user_agent': reddit_user_agent,
                'saved_at': datetime.now().isoformat()
            }
            json_data = json.dumps(data).encode('utf-8')
            encrypted_data = fernet.encrypt(json_data)
            os.makedirs(self.data_folder, exist_ok=True)
            with open(self.credentials_path, 'wb') as f:
                f.write(encrypted_data)
            return True
        except Exception as e:
            log_error(f"Failed to save credentials: {e}")
            return False
    
    def load_credentials(self):
        try:
            if not os.path.exists(self.credentials_path):
                return None 
            with open(self.credentials_path, 'rb') as f:
                encrypted_data = f.read()
            if not encrypted_data:
                log_error("Credentials file is empty")
                return None
            from cryptography.fernet import Fernet
            fernet = Fernet(self.key)
            try:
                decrypted_data = fernet.decrypt(encrypted_data)
                data = json.loads(decrypted_data.decode('utf-8'))
                required_fields = ['supabase_url', 'service_key', 'reddit_client_id', 
                                 'reddit_client_secret', 'reddit_user_agent']
                for field in required_fields:
                    if field not in data or not data[field]:
                        log_error(f"Missing or empty field in credentials: {field}")
                        return None
                return {
                    'supabase_url': data.get('supabase_url'),
                    'service_key': data.get('service_key'),
                    'reddit_client_id': data.get('reddit_client_id'),
                    'reddit_client_secret': data.get('reddit_client_secret'),
                    'reddit_user_agent': data.get('reddit_user_agent')
                }
            except Exception as decrypt_error:
                log_error(f"Failed to decrypt credentials: {decrypt_error}")
                return None
        except Exception as e:
            log_error(f"Failed to load credentials: {e}")
            return None
    
    def delete_credentials(self):
        try:
            if os.path.exists(self.credentials_path):
                os.remove(self.credentials_path)
            key_file = os.path.join(self.data_folder, ".scraper_key")
            if os.path.exists(key_file):
                os.remove(key_file)
            return True
        except Exception as e:
            log_error(f"Failed to delete credentials: {e}")
            return False

class PresetManager:
    def __init__(self, data_folder):
        self.data_folder = data_folder
        self.user_data_path = os.path.join(data_folder, USER_DATA_FILE)
        self.presets = self.load_presets()
    
    def load_presets(self):
        try:
            if os.path.exists(self.user_data_path):
                with open(self.user_data_path, 'r', encoding='utf-8') as f:
                    presets = json.load(f)
                    for preset_type in ['broad', 'concentrated', 'both_broad', 'both_concentrated']:
                        if f"{preset_type}_presets" not in presets:
                            presets[f"{preset_type}_presets"] = {str(i): [] for i in range(1, 6)}
                    return presets
        except Exception as e:
            log_error(f"Failed to load presets: {e}")
        return {
            'broad_presets': {str(i): [] for i in range(1, 6)},
            'concentrated_presets': {str(i): [] for i in range(1, 6)},
            'both_broad_presets': {str(i): [] for i in range(1, 6)},
            'both_concentrated_presets': {str(i): [] for i in range(1, 6)}
        }
    
    def save_presets(self):
        try:
            with open(self.user_data_path, 'w', encoding='utf-8') as f:
                json.dump(self.presets, f, indent=2)
            return True
        except Exception as e:
            log_error(f"Failed to save presets: {e}")
            return False
    
    def save_preset(self, preset_type, preset_number, subreddits):
        if preset_type == "both":
            self.presets["both_broad_presets"][str(preset_number)] = subreddits[0]
            self.presets["both_concentrated_presets"][str(preset_number)] = subreddits[1]
        else:
            preset_key = f"{preset_type}_presets"
            self.presets[preset_key][str(preset_number)] = subreddits
        return self.save_presets()
    
    def get_preset(self, preset_type, preset_number):
        if preset_type == "both":
            return (
                self.presets.get("both_broad_presets", {}).get(str(preset_number), []),
                self.presets.get("both_concentrated_presets", {}).get(str(preset_number), [])
            )
        else:
            preset_key = f"{preset_type}_presets"
            return self.presets.get(preset_key, {}).get(str(preset_number), [])
    
class KeywordFetchThread(QThread):
    keywords_fetched = pyqtSignal(list)
    error_occurred = pyqtSignal(str)
    retry_countdown = pyqtSignal(int, str)  
    fetch_failed = pyqtSignal(str)  
    
    def __init__(self, base_keywords):
        super().__init__()
        self.base_keywords = base_keywords if isinstance(base_keywords, list) else [base_keywords]
        self.max_retries = 3
        self.initial_retry_delay = 5
        self._is_running = True
        self._current_retry_countdown = False  

    def stop(self):
        self._is_running = False
        self._current_retry_countdown = False
        if self.isRunning():
            self.wait(2000) 

    def run(self):
        try:
            all_keywords = set()
            pytrend = TrendReq()
            for base_keyword in self.base_keywords:
                if not self._is_running:
                    break
                retry_delay = self.initial_retry_delay
                success = False
                for attempt in range(self.max_retries):
                    if not self._is_running:
                        break
                    try:
                        pytrend.build_payload([base_keyword], timeframe='now 7-d', geo='US')
                        related_queries = pytrend.related_queries()
                        if (related_queries and 
                            base_keyword in related_queries and 
                            related_queries[base_keyword]['top'] is not None):
                            trending_keywords = related_queries[base_keyword]['top']['query'].tolist()
                            all_keywords.update([kw.lower().strip() for kw in trending_keywords])
                            success = True
                            break 
                    except Exception as e:
                        error_msg = f"Error fetching trends for '{base_keyword}': {str(e)}"
                        self.error_occurred.emit(error_msg)
                        log_error(error_msg)
                        if attempt == self.max_retries - 1:
                            break
                        self._current_retry_countdown = True
                        for remaining in range(retry_delay, 0, -1):
                            if not self._is_running or not self._current_retry_countdown:
                                break
                            self.retry_countdown.emit(remaining, base_keyword)
                            time.sleep(1)
                        self._current_retry_countdown = False
                        if not self._is_running:
                            break
                        retry_delay *= 2
                if not success:
                    self.fetch_failed.emit(base_keyword)
                    return
            if all_keywords:
                keywords = list(all_keywords)
                self.keywords_fetched.emit(keywords)
            else:
                self.fetch_failed.emit("all keywords")
        except Exception as e:
            error_msg = f"Critical error in keyword fetching: {str(e)}"
            log_error(error_msg)
            self.fetch_failed.emit(error_msg)

class ScraperThread(QThread):
    log_signal = pyqtSignal(str)
    clear_log_signal = pyqtSignal()
    header_signal = pyqtSignal(str)
    post_progress_signal = pyqtSignal(int, int)
    subreddit_progress_signal = pyqtSignal(int, int)
    keyword_progress_signal = pyqtSignal(int, int)
    finished_signal = pyqtSignal()
    method_changed_signal = pyqtSignal(str) 

    def __init__(self, run_infinite, scrape_mode, keywords, supabase_client, reddit_instance, broad_subreddits=None, concentrated_subreddits=None, keyword_batch_size=10, deepscan_batch_size=25):
        super().__init__()
        self.run_infinite = run_infinite
        self.scrape_mode = scrape_mode 
        self.keywords = keywords
        self._is_running = True
        self.supabase = supabase_client
        self.reddit = reddit_instance
        self.current_method = "Keyword Search" if scrape_mode in ['keyword', 'both'] else "DeepScan"
        self.broad_subreddits = broad_subreddits if broad_subreddits else BROAD_SUBREDDITS
        self.concentrated_subreddits = concentrated_subreddits if concentrated_subreddits else CONCENTRATED_SUBREDDITS
        self.keyword_batch_size = keyword_batch_size
        self.deepscan_batch_size = deepscan_batch_size
        log_error(f"ScraperThread initialized with batch sizes - Keyword: {keyword_batch_size}, DeepScan: {deepscan_batch_size}")

    def stop(self):
        self._is_running = False
        if self.isRunning():
            self.wait(5000)

    def cleanup_resources(self):
        try:
            if hasattr(self, 'current_submissions'):
                del self.current_submissions
            if hasattr(self, 'current_batch'):
                del self.current_batch
        except Exception as e:
            log_error(f"Error during thread cleanup: {e}")

    def run(self):
        try:
            current_keywords = ["politics"]
            if self.scrape_mode in ['keyword', 'both']:
                current_keywords = [kw.lower() for kw in self.keywords if kw.strip()] or ["politics"]
            cycle_count = 0
            self.method_changed_signal.emit(self.current_method)
            while self._is_running:
                cycle_count += 1
                if self.scrape_mode in ['keyword', 'both']:
                    self.method_changed_signal.emit("Keyword Search")
                    total_subs = len(self.broad_subreddits)
                    completed_subs = 0
                    for subreddit_name in self.broad_subreddits:
                        if not self._is_running:
                            break
                        self.subreddit_progress_signal.emit(completed_subs, total_subs)
                        total_keywords = len(current_keywords)
                        completed_keywords = 0
                        for keyword in current_keywords:
                            if not self._is_running:
                                break
                            self.keyword_progress_signal.emit(completed_keywords, total_keywords)
                            self.clear_log_signal.emit()
                            time.sleep(0.12)
                            safe_kw = html_lib.escape(keyword)
                            safe_sub = html_lib.escape(subreddit_name)
                            self.header_signal.emit(
                                f"<b>Cycle Mode:</b> {'Infinite' if self.run_infinite else 'Single'} | "
                                f"<b>Scrape Method:</b> Keyword Search | "
                                f"<b>Subreddit:</b> r/{safe_sub} | "
                                f"<b>Keyword:</b> \"{safe_kw}\""
                            )
                            max_retries = 3
                            retry_delay = 5
                            for attempt in range(max_retries):
                                try:
                                    try:
                                        subreddit = self.reddit.subreddit(subreddit_name)
                                    except Exception as e:
                                        self.log_signal.emit(f"<b>Error:</b> Subreddit r/{safe_sub} not found: {e}")
                                        log_error(f"Subreddit r/{subreddit_name} not found: {e}")
                                        break
                                    submissions = list(subreddit.search(keyword, limit=50))
                                    valid_submissions = [post for post in submissions if post is not None]
                                    total_posts = len(valid_submissions)
                                    completed_posts = 0
                                    processed_posts = 0
                                    self.post_progress_signal.emit(0, total_posts if total_posts > 0 else 1)
                                    for batch in batch_process_submissions(valid_submissions, batch_size=self.keyword_batch_size):
                                        for submission in batch:
                                            if not self._is_running:
                                                break
                                            processed_posts += 1
                                            result = self.scrape_submission(submission)
                                            completed_posts += 1
                                            self.post_progress_signal.emit(completed_posts, total_posts if total_posts > 0 else 1)                                          
                                            time.sleep(0.2)
                                            self.msleep(10)
                                        del batch
                                        if not self._is_running:
                                            break
                                    time.sleep(0.4)
                                    break
                                except Exception as e:
                                    error_str = str(e).lower()
                                    if any(err in error_str for err in ["timeout", "network", "connection", "502", "503", "rate limit"]):
                                        if attempt < max_retries - 1:
                                            self.log_signal.emit(f"<b>Network Issue:</b> Retrying in {retry_delay}s (attempt {attempt+1}/{max_retries})")
                                            time.sleep(retry_delay)
                                            retry_delay *= 2
                                            continue
                                    err = f"Error accessing subreddit '{subreddit_name}' for keyword '{keyword}': {e}"
                                    self.log_signal.emit(f"<b>Error:</b> {html_lib.escape(err)}")
                                    log_error(err)
                                    break
                            completed_keywords += 1
                            time.sleep(0.8)
                        if self._is_running:
                            self.keyword_progress_signal.emit(completed_keywords, total_keywords)
                            completed_subs += 1
                    if self._is_running:
                        self.subreddit_progress_signal.emit(completed_subs, total_subs)                
                if self.scrape_mode in ['both']:
                    self.method_changed_signal.emit("DeepScan")                
                if self.scrape_mode in ['deepscan', 'both']:
                    total_subs = len(self.concentrated_subreddits)
                    completed_subs = 0
                    for subreddit_name in self.concentrated_subreddits:
                        if not self._is_running:
                            break
                        self.subreddit_progress_signal.emit(completed_subs, total_subs)
                        self.clear_log_signal.emit()
                        time.sleep(0.12)
                        safe_sub = html_lib.escape(subreddit_name)
                        self.header_signal.emit(
                            f"<b>Cycle Mode:</b> {'Infinite' if self.run_infinite else 'Single'} | "
                            f"<b>Scrape Method:</b> DeepScan | "
                            f"<b>Subreddit:</b> r/{safe_sub} | "
                            f"<b>Keyword:</b> (none)"
                        )
                        max_retries = 3
                        retry_delay = 5
                        for attempt in range(max_retries):
                            try:
                                try:
                                    subreddit = self.reddit.subreddit(subreddit_name)
                                except Exception as e:
                                    self.log_signal.emit(f"<b>Error:</b> Subreddit r/{safe_sub} not found: {e}")
                                    log_error(f"Subreddit r/{subreddit_name} not found: {e}")
                                    break                                    
                                batch = list(subreddit.new(limit=100))
                                valid_batch = [post for post in batch if post is not None]
                                total_posts = len(valid_batch)
                                completed_posts = 0
                                processed_posts = 0
                                self.post_progress_signal.emit(0, total_posts if total_posts > 0 else 1)                                
                                for post_batch in batch_process_submissions(valid_batch, batch_size=self.deepscan_batch_size):
                                    for post in post_batch:
                                        if not self._is_running:
                                            break
                                        processed_posts += 1
                                        if (not post.title or post.title.strip() == "") and (not post.selftext or post.selftext.strip() == ""):
                                            self.log_signal.emit(f"<b>Empty Post (Skipped):</b> Post {processed_posts} has no title or content")
                                            self.log_signal.emit("")
                                            completed_posts += 1
                                            self.post_progress_signal.emit(completed_posts, total_posts)
                                            continue
                                        if post.num_comments < 5:
                                            safe_title = html_lib.escape(post.title[:50] + "..." if len(post.title) > 50 else post.title)
                                            self.log_signal.emit(f"<b>Low Engagement (Skipped):</b> {safe_title} — Only {post.num_comments} comments")
                                            self.log_signal.emit("")
                                            completed_posts += 1
                                            self.post_progress_signal.emit(completed_posts, total_posts)
                                            continue
                                        result = self.scrape_submission(post)
                                        completed_posts += 1
                                        self.post_progress_signal.emit(completed_posts, total_posts)                                        
                                        time.sleep(0.2)
                                        self.msleep(10)
                                    del post_batch
                                    if not self._is_running:
                                        break
                                time.sleep(0.4)
                                break
                            except Exception as e:
                                error_str = str(e).lower()
                                if any(err in error_str for err in ["timeout", "network", "connection", "502", "503", "rate limit"]):
                                    if attempt < max_retries - 1:
                                        self.log_signal.emit(f"<b>Network Issue:</b> Retrying in {retry_delay}s (attempt {attempt+1}/{max_retries})")
                                        time.sleep(retry_delay)
                                        retry_delay *= 2
                                        continue
                                err = f"Error during DeepScan in subreddit '{subreddit_name}': {e}"
                                self.log_signal.emit(f"<b>Error:</b> {html_lib.escape(err)}")
                                log_error(err)
                                break
                        if self._is_running:
                            completed_subs += 1
                    if self._is_running:
                        self.subreddit_progress_signal.emit(completed_subs, total_subs)                        
                if not self.run_infinite:
                    break
                else:
                    self.log_signal.emit(f"Cycle complete, sleeping {SLEEP_BETWEEN_CYCLES//60} minutes...")
                    for _ in range(SLEEP_BETWEEN_CYCLES):
                        if not self._is_running:
                            break
                        time.sleep(1)
            if self._is_running:
                self.log_signal.emit("Scraper completed successfully.")
            else:
                self.log_signal.emit("Scraper stopped by user.")
        except Exception as e:
            error_msg = f"Unexpected error in scraper thread: {str(e)}\n{traceback.format_exc()}"
            log_error(error_msg)
            self.log_signal.emit(f"<b>Unexpected error:</b> {html_lib.escape(str(e))}<br/><pre>{html_lib.escape(traceback.format_exc())}</pre>")
        finally:
            self.cleanup_resources()
            self.finished_signal.emit()

    def scrape_submission(self, submission):
        try:
            if submission is None:
                self.log_signal.emit(f"<b>Null Submission (Skipped):</b> Empty post data")
                self.log_signal.emit("")
                return "skipped"             
            post_data = {
                "post_id": submission.id,
                "title": submission.title or "",
                "body": submission.selftext or "",
                "url": submission.url,
                "permalink": "https://reddit.com" + submission.permalink,
                "score": submission.score,
                "upvote_ratio": submission.upvote_ratio,
                "num_comments": submission.num_comments,
                "created_utc": submission.created_utc,
                "author": str(submission.author) if submission.author else None,
                "subreddit": str(submission.subreddit),
                "sentiment": get_sentiment((submission.title or "") + " " + (submission.selftext or "")),
                "comments": [],
                "live": False,
            }            
            info_title = html_lib.escape(post_data["title"])
            info_date = format_utc(post_data["created_utc"])
            info_link = html_lib.escape(post_data["permalink"])            
            if post_data["title"].strip().lower() in ["[deleted]", "[removed]"] or post_data["body"].strip().lower() in ["[deleted]", "[removed]"]:
                self.log_signal.emit(f"<b>Deleted/Removed Post (Skipped):</b> {info_title} — {info_date} — {info_link}")
                self.log_signal.emit("")
                return "skipped"            
            if submission.author and submission.author.name.lower() in ["automoderator", "bot", "automod"]:
                self.log_signal.emit(f"<b>Bot Post (Skipped):</b> by {submission.author.name} — {info_title} — {info_date}")
                self.log_signal.emit("")
                return "skipped"            
            submission.comment_sort = "top"
            submission.comments.replace_more(limit=0)
            comment_count = 0            
            for comment in submission.comments:
                if comment_count >= MAX_COMMENTS:
                    break
                if is_mod_or_bot_comment(comment):
                    continue
                comment_text = comment.body if hasattr(comment, 'body') else getattr(comment, 'text', '')
                comment_score = comment.score if hasattr(comment, 'score') else 0
                comment_id = comment.id if hasattr(comment, 'id') else f"comment_{comment_count}"
                post_data["comments"].append({
                    "comment_id": comment_id,
                    "text": comment_text,
                    "score": comment_score,
                    "sentiment": get_sentiment(comment_text)
                })
                comment_count += 1    
            if comment_count < 5:
                self.log_signal.emit(f"<b>Not Enough Comments (Skipped):</b> {info_title} — {info_date} — {info_link}")
                self.log_signal.emit("")
                return "skipped"            
            created_iso = datetime.fromtimestamp(post_data["created_utc"], tz=timezone.utc).isoformat()
            insert_data = {
                "post_id": post_data["post_id"],
                "title": post_data["title"],
                "body": post_data["body"],
                "url": post_data["url"],
                "permalink": post_data["permalink"],
                "score": post_data["score"],
                "upvote_ratio": post_data["upvote_ratio"],
                "num_comments": post_data["num_comments"],
                "created_utc": created_iso,
                "author": post_data["author"],
                "subreddit": post_data["subreddit"],
                "sentiment": post_data["sentiment"],
                "comments": post_data["comments"],
                "live": post_data["live"]
            }            
            max_retries = 3
            for attempt in range(max_retries):
                if not self._is_running:
                    return None
                try:
                    response = self.supabase.table('reddit_posts').insert(insert_data).execute()
                    if not getattr(response, "error", None):
                        self.log_signal.emit(f"<b>Saved Post:</b> {info_title} — {info_date} — {info_link}")
                        self.log_signal.emit("")
                        return "saved"
                    else:
                        raise Exception(response.error)
                except Exception as e:
                    error_str = str(e)
                    if "unique" in error_str.lower() or "duplicate key" in error_str.lower():
                        self.log_signal.emit(f"<b>Duplicate Post (Skipped):</b> {info_title} — {info_date} — {info_link}")
                        self.log_signal.emit("")
                        return "skipped"
                    elif any(err in error_str for err in [
                        "Network connection lost", "502", "ETIMEDOUT", "ECONNRESET",
                        "Connection aborted", "timeout", "Temporary failure"
                    ]):
                        msg = f"Insert failed due to network issue (attempt {attempt+1}/{max_retries}). Retrying in 5 seconds..."
                        self.log_signal.emit(f"<b>Network Issue:</b> {html_lib.escape(msg)}")
                        log_error(msg)
                        time.sleep(5)
                    else:
                        error_msg = f"Error inserting post_id {post_data['post_id']}: {e}"
                        self.log_signal.emit(f"<b>Error:</b> {html_lib.escape(error_msg)}")
                        log_error(error_msg)
                        self.log_signal.emit("")
                        return "error"
            else:
                fail_msg = f"Failed to insert post_id {post_data['post_id']} after {max_retries} attempts."
                self.log_signal.emit(f"<b>Error:</b> {html_lib.escape(fail_msg)}")
                log_error(fail_msg)
                self.log_signal.emit("")
                return "error"
        except Exception as e:
            error_msg = f"Error processing submission: {e}"
            self.log_signal.emit(f"<b>Error:</b> {html_lib.escape(error_msg)}")
            log_error(error_msg)
            self.log_signal.emit("")
            return "error"

class SupaScrapeR(QWidget):
    def __init__(self):
        super().__init__()
        self.data_folder = None
        self.credentials_manager = None
        self.preset_manager = None
        self.reddit = None
        self.scraper_thread = None
        try:
            self.setWindowTitle("SupaScrapeR: Advanced Reddit Data Collection")
            self.setWindowState(Qt.WindowMaximized)
            app_icon = get_app_icon()
            if app_icon:
                self.setWindowIcon(app_icon)        
            self.apply_dark_theme()
            self.selected_keywords = []
            self.keywords = ["politics"]
            self.run_mode = None
            self.scrape_mode = None
            self.selected_preset = None
            self.current_broad_subreddits = BROAD_SUBREDDITS[:]
            self.current_concentrated_subreddits = CONCENTRATED_SUBREDDITS[:]
            self.keyword_batch_size = DEFAULT_KEYWORD_BATCH_SIZE
            self.deepscan_batch_size = DEFAULT_DEEPSCAN_BATCH_SIZE
            self.stack = QStackedWidget()
            main_layout = QVBoxLayout()
            main_layout.setContentsMargins(0, 0, 0, 0)
            main_layout.addWidget(self.stack)
            self.setLayout(main_layout)
            self.FOLDER_SELECT_SCREEN = 0
            self.LOGIN_SCREEN = 1
            self.RUN_MODE_SCREEN = 2
            self.SCRAPE_MODE_SCREEN = 3
            self.SETTINGS_SCREEN = 4
            self.PRESET_SELECT_SCREEN = 5
            self.KEYWORD_SELECT_SCREEN = 6
            self.BATCH_SIZE_SCREEN = 7       
            self.CONFIRMATION_SCREEN = 8     
            self.CUSTOM_KEYWORDS_SCREEN = 9  
            self.SCRAPING_STATUS_SCREEN = 10 
            self.setup_folder_select_screen()
            self.setup_login_screen()
            self.setup_run_mode_screen()
            self.setup_scrape_mode_screen()
            self.setup_settings_screen()
            self.setup_preset_select_screen()
            self.setup_keyword_select_screen()
            self.setup_batch_size_screen()
            self.setup_confirmation_screen()
            self.setup_custom_keywords_screen()
            self.setup_scraping_status_screen()
            self.try_auto_login()
        except Exception as e:
            log_error(f"Critical error during initialization: {e}\n{traceback.format_exc()}")
            try:
                QMessageBox.critical(self, "Initialization Error", 
                                f"Some features may not work properly.\nError: {str(e)}")
            except:
                pass
    
    def create_title_with_logo(self, subtitle_text="Advanced Reddit Data Collection Tool\nCreated by Kenneth Huang"):
        try:
            title_container = QVBoxLayout()
            title_container.setSpacing(-300)
            title_container.setContentsMargins(0, 0, 0, 0) 
            logo_label = QLabel()
            logo_path = resource_path("assets/supascraper-complete-logo.png")
            if os.path.exists(logo_path):
                pixmap = QPixmap(logo_path)
                if not pixmap.isNull():
                    scaled_pixmap = pixmap.scaled(300, 80, Qt.KeepAspectRatio, Qt.SmoothTransformation)
                    logo_label.setPixmap(scaled_pixmap)
                    logo_label.setAlignment(Qt.AlignCenter)
                    logo_label.setContentsMargins(0, 0, 0, -85)
                    title_container.addWidget(logo_label)
                else:
                    log_error(f"Failed to load logo from {logo_path}")
                    raise Exception("Logo load failed")
            else:
                log_error(f"Logo file not found at {logo_path}")
                raise Exception("Logo file not found")
            subtitle = QLabel(subtitle_text)
            subtitle.setObjectName("Subtitle")
            subtitle.setAlignment(Qt.AlignCenter)
            subtitle.setContentsMargins(0, -20, 0, 0) 
            title_container.addWidget(subtitle)
            
            return title_container
        except Exception as e:
            log_error(f"Failed to create logo title, falling back to text: {e}")
            title_container = QVBoxLayout()
            title_container.setSpacing(4)
            main_title = QLabel("SupaScrapeR")
            main_title.setObjectName("Title")
            main_title.setAlignment(Qt.AlignCenter)
            subtitle = QLabel(subtitle_text)
            subtitle.setObjectName("Subtitle")
            subtitle.setAlignment(Qt.AlignCenter)
            title_container.addWidget(main_title)
            title_container.addWidget(subtitle)
            return title_container

    def force_input_styling(self):
        input_fields = [
            self.supabase_url_input,
            self.service_key_input, 
            self.reddit_client_id_input,
            self.reddit_client_secret_input,
            self.reddit_user_agent_input
        ]
        from PyQt5.QtGui import QFont, QColor, QPalette
        font = QFont("Consolas", 12)
        font.setFamily("Consolas, Monaco, monospace")
        for field in input_fields:
            field.setFont(font)
            palette = field.palette()
            palette.setColor(QPalette.Text, QColor("#e5e7eb"))
            palette.setColor(QPalette.Base, QColor("#0f131c"))
            field.setPalette(palette)
            field.setStyleSheet("""
                QTextEdit {
                    background-color: #0f131c !important;
                    border: 1px solid #232a3a !important;
                    border-radius: 10px !important;
                    padding: 10px 12px !important;
                    font-family: "Consolas", "Monaco", monospace !important;
                    color: #e5e7eb !important;
                    font-size: 12px !important;
                }
                QTextEdit:focus { 
                    border-color: #4f8cff !important; 
                    background-color: #0f131c !important;
                    color: #e5e7eb !important;
                }
            """)

    def setup_paste_interceptors(self):
        def create_paste_interceptor(text_edit):
            def paste_plain_text():
                clipboard = QApplication.clipboard()
                plain_text = clipboard.text()
                text_edit.insertPlainText(plain_text)
            return paste_plain_text
        input_fields = [
            self.supabase_url_input,
            self.service_key_input,
            self.reddit_client_id_input, 
            self.reddit_client_secret_input,
            self.reddit_user_agent_input
        ]
        for field in input_fields:
            def keyPressEvent(event, original_method=field.keyPressEvent, paste_func=create_paste_interceptor(field)):
                if event.key() == Qt.Key_V and event.modifiers() & Qt.ControlModifier:
                    paste_func()  
                else:
                    original_method(event)       
            field.keyPressEvent = keyPressEvent

    def update_login_button_state(self):
        fields_filled = all([
            self.supabase_url_input.toPlainText().strip(),
            self.actual_service_key.strip(),
            self.reddit_client_id_input.toPlainText().strip(),
            self.reddit_client_secret_input.toPlainText().strip(),
            self.reddit_user_agent_input.toPlainText().strip()
        ])
        self.btn_login.setEnabled(fields_filled)        
        if fields_filled:
            self.btn_login.setStyleSheet("""
                QPushButton {
                    background-color: #1d3b2a;
                    border: 1px solid #23533a;
                    color: #c6f6d5;
                }
                QPushButton:hover { background-color: #204330; border-color: #2a6a48; }
                QPushButton:pressed { background-color: #193324; }
            """)
            self.btn_login.setToolTip("")
        else:
            self.btn_login.setStyleSheet("""
                QPushButton:disabled {
                    background-color: #11151d;
                    color: #717a8c;
                    border-color: #1a2030;
                }
            """)
            self.btn_login.setToolTip("Please fill in all fields")
        
    def load_saved_credentials(self):
        try:
            if not self.credentials_manager:
                return                
            credentials = self.credentials_manager.load_credentials()
            if credentials:
                self.supabase_url_input.setPlainText(credentials.get('supabase_url', ''))
                self.actual_service_key = credentials.get('service_key', '')
                if not self.service_key_visible:
                    self.service_key_input.setPlainText("•" * len(self.actual_service_key))
                else:
                    self.service_key_input.setPlainText(self.actual_service_key)
                self.reddit_client_id_input.setPlainText(credentials.get('reddit_client_id', ''))
                self.reddit_client_secret_input.setPlainText(credentials.get('reddit_client_secret', ''))
                self.reddit_user_agent_input.setPlainText(credentials.get('reddit_user_agent', ''))
                self.keep_signed_in_checkbox.setChecked(True)
        except Exception as e:
            log_error(f"Failed to load saved credentials: {e}")

    def try_auto_login(self):
        try:
            config_folder = get_config_folder()
            last_folder_path = os.path.join(config_folder, LAST_FOLDER_FILE)
            if os.path.exists(last_folder_path):
                with open(last_folder_path, "r", encoding="utf-8") as f:
                    last_folder = f.read().strip()
                    if last_folder and os.path.exists(last_folder):
                        self.data_folder = os.path.normpath(last_folder)
                        log_error(f"Using last used folder: {self.data_folder}")
                    else:
                        self.data_folder = config_folder
                        log_error("Last folder invalid, using config folder")
            else:
                self.data_folder = config_folder
                log_error("First run, using config folder")
            self.credentials_manager = CredentialsManager(self.data_folder)
            credentials = self.credentials_manager.load_credentials()
            if credentials and all([
                credentials.get('supabase_url'),
                credentials.get('service_key'),
                credentials.get('reddit_client_id'),
                credentials.get('reddit_client_secret'),
                credentials.get('reddit_user_agent')
            ]):
                global DATA_FOLDER
                DATA_FOLDER = self.data_folder
                self.preset_manager = PresetManager(self.data_folder)
                try:
                    supabase_client = create_client(
                        credentials['supabase_url'], 
                        credentials['service_key']
                    )
                    reddit_client = create_reddit_client_safe(
                        credentials['reddit_client_id'],
                        credentials['reddit_client_secret'],
                        credentials['reddit_user_agent']
                    )
                    _ = reddit_client.subreddit('test').display_name
                    _ = supabase_client.table('reddit_posts').select("post_id").limit(1).execute()
                    global supabase
                    supabase = supabase_client
                    self.reddit = reddit_client
                    self.stack.setCurrentIndex(self.RUN_MODE_SCREEN)
                    return
                except Exception as e:
                    log_error(f"Auto-login connection test failed: {e}")
            self.stack.setCurrentIndex(self.FOLDER_SELECT_SCREEN)
        except Exception as e:
            log_error(f"Auto-login error: {e}")
            self.stack.setCurrentIndex(self.FOLDER_SELECT_SCREEN)

    def apply_dark_theme(self):
        self.setFont(QFont("Segoe UI", 10))
        palette = QPalette()
        bg = QColor("#0f1117")
        surface = QColor("#151922")
        text = QColor("#e5e7eb")
        palette.setColor(QPalette.Window, bg)
        palette.setColor(QPalette.Base, QColor("#0f1117"))
        palette.setColor(QPalette.AlternateBase, surface)
        palette.setColor(QPalette.WindowText, text)
        palette.setColor(QPalette.Text, text)
        palette.setColor(QPalette.Button, QColor("#1b2130"))
        palette.setColor(QPalette.ButtonText, text)
        palette.setColor(QPalette.Highlight, QColor("#4f8cff"))
        palette.setColor(QPalette.HighlightedText, QColor("#ffffff"))
        QApplication.instance().setPalette(palette)
        self.setStyleSheet("""
            QWidget {
                background-color: #0f1117;
                color: #e5e7eb;
                font-family: "Segoe UI", Arial, sans-serif;
                font-size: 12px;
            }
            QStackedWidget { background-color: #0f1117; }
            QFrame { border: none; background: transparent; }
            QLabel {
                color: #e5e7eb;
                padding: 0;
                background: transparent;
                border: none;
            }
            QLabel#Title {
                font-size: 28px;
                font-weight: 700;
                color: #4f8cff;
            }
            QLabel#Subtitle {
                font-size: 14px;
                color: #9aa4b2;
            }
            QLabel#SectionTitle {
                font-size: 20px;
                font-weight: 600;
                color: #cbd5e1;
            }
            QLabel#Muted {
                color: #9aa4b2;
            }
            QLabel#Credit {
                color: #6b7280;
                font-size: 10px;
                font-style: italic;
                padding-top: 10px;
            }
            QPushButton {
                background-color: #1b2130;
                border: 1px solid #232a3a;
                border-radius: 10px;
                color: #e5e7eb;
                padding: 12px 16px;
                font-size: 14px;
                font-weight: 600;
            }
            QPushButton:hover {
                background-color: #20273a;
                border-color: #2b3448;
            }
            QPushButton:pressed {
                background-color: #171c28;
            }
            QPushButton:disabled {
                background-color: #11151d;
                color: #717a8c;
                border-color: #1a2030;
            }
            QPushButton:focus {
                outline: none;
                border: 1px solid #4f8cff;
            }
            QLabel:focus {
                outline: none;
            }
            QPushButton#PresetButton {
                text-align: left;
                padding: 10px 12px;
            }
            QPushButton#PresetButton:checked {
                background-color: #1d3b2a;
                border: 1px solid #23533a;
                color: #c6f6d5;
            }
            QPushButton#SettingsButton {
                background-color: #2d1f3a;
                border: 1px solid #4a3564;
                color: #d6c7e7;
                padding: 8px 12px;
                font-size: 12px;
                min-width: 80px;
            }
            QPushButton#SettingsButton:hover {
                background-color: #372849;
                border-color: #5d4277;
            }
            QTextEdit {
                background-color: #0f131c;
                border: 1px solid #232a3a;
                border-radius: 10px;
                padding: 10px 12px;
                font-family: "Consolas", "Monaco", monospace;
                color: #e5e7eb;
                outline: none;
                border-color: #4f8cff;
            }
            QScrollArea {
                background-color: #0f1117;
                border: 1px solid #232a3a;
                border-radius: 10px;
            }
            QScrollArea > QWidget > QWidget {
                background-color: #0f1117;
            }
            QScrollArea > QWidget {
                background-color: #0f1117;
            }
            QScrollArea QScrollBar:vertical {
                background: transparent;
                width: 8px;
                margin: 0px;
                border: none;
            }
            QScrollArea QScrollBar::handle:vertical {
                background: #4a5568;
                min-height: 20px;
                border-radius: 4px;
                margin: 0px;
            }
            QScrollArea QScrollBar::handle:vertical:hover {
                background: #5a6478;
            }
            QScrollArea QScrollBar::add-page:vertical, 
            QScrollArea QScrollBar::sub-page:vertical {
                background: transparent;
            }
            QScrollArea QScrollBar:horizontal {
                background: transparent;
                height: 8px;
                margin: 0px;
                border: none;
            }
            QScrollArea QScrollBar::handle:horizontal {
                background: #4a5568;
                min-width: 20px;
                border-radius: 4px;
                margin: 0px;
            }
            QScrollArea QScrollBar::handle:horizontal:hover {
                background: #5a6478;
            }
            QScrollArea QScrollBar::add-line:horizontal, 
            QScrollArea QScrollBar::sub-line:horizontal {
                background: transparent;
                height: 0px;
                width: 0px;
                border: none;
            }
            QScrollArea QScrollBar::add-page:horizontal, 
            QScrollArea QScrollBar::sub-page:horizontal {
                background: transparent;
            }
            QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical,
            QScrollBar::add-page:horizontal, QScrollBar::sub-page:horizontal {
                background: #0f1117;
            }
            QScrollBar::handle:vertical, QScrollBar::handle:horizontal {
                background: #4a5568;
                border-radius: 4px;
            }
            QScrollBar::handle:vertical:hover, QScrollBar::handle:horizontal:hover {
                background: #5a6478;
            }
            QScrollBar:vertical {
                background: #0f1117;
                width: 10px;
            }
            QScrollBar:horizontal {
                background: #0f1117;
                height: 10px;
            }
            QTextEdit QScrollBar:vertical {
                background: transparent;
                width: 8px;
                margin: 0px;
                border: none;
            }
            QTextEdit QScrollBar::handle:vertical {
                background: #4a5568;
                min-height: 20px;
                border-radius: 4px;
                margin: 0px;
            }
            QTextEdit QScrollBar::handle:vertical:hover {
                background: #5a6478;
            }
            QTextEdit QScrollBar::add-line:vertical, 
            QTextEdit QScrollBar::sub-line:vertical {
                background: transparent;
                height: 0px;
                width: 0px;
                border: none;
            }
            QTextEdit QScrollBar::add-page:vertical, 
            QTextEdit QScrollBar::sub-page:vertical {
                background: transparent;
            }
            QCheckBox {
                spacing: 8px;
                color: #e5e7eb;
                font-size: 12px;
                padding: 4px 2px;
                background: transparent;
                border: none;
            }
            QCheckBox::indicator {
                width: 16px;
                height: 16px;
                border-radius: 4px;
                border: 1px solid #3a4763;
                background-color: #0f131c;
            }
            QCheckBox::indicator:checked {
                background-color: #4f8cff;
                border: 1px solid #4f8cff;
            }
            QCheckBox:hover {
                color: #ffffff;
            }
            QProgressBar {
                border: 1px solid #232a3a;
                border-radius: 8px;
                background-color: #0f131c;
                text-align: center;
                font-size: 11px;
                font-weight: 600;
                color: #e5e7eb;
                height: 20px;
            }
            QProgressBar::chunk {
                background-color: #4f8cff;
                border-radius: 7px;
            }
            QMessageBox {
                background-color: #0f1117;
            }         
            QToolTip {
                background-color: #1b2130;
                color: #e5e7eb;
                border: 1px solid #232a3a;
                padding: 4px;
                border-radius: 4px;
                font-size: 11px;
            }
        """)

    def create_card_widget(self, title, content_layout):
        card = QFrame()
        main_layout = QVBoxLayout()
        main_layout.setContentsMargins(30, 20, 30, 20)
        main_layout.setSpacing(16)
        if title:
            title_label = QLabel(title)
            title_label.setObjectName("SectionTitle")
            title_label.setAlignment(Qt.AlignCenter)
            main_layout.addWidget(title_label)
        main_layout.addLayout(content_layout)
        card.setLayout(main_layout)
        return card

    def setup_folder_select_screen(self):
        widget = QWidget()
        layout = QVBoxLayout()
        layout.setContentsMargins(50, 50, 50, 50)
        layout.setSpacing(4)
        widget.setLayout(layout)
        layout.addStretch(1)        
        title_container = self.create_title_with_logo()
        layout.addSpacing(-15)
        layout.addLayout(title_container)
        content_layout = QVBoxLayout()
        content_layout.setSpacing(12)        
        instruction_label = QLabel("Choose where to store your app data:")
        instruction_label.setAlignment(Qt.AlignCenter)
        instruction_label.setObjectName("Muted")
        instruction_label.setContentsMargins(0, 0, 0, 2)
        content_layout.addWidget(instruction_label)
        self.folder_display = QLabel()
        self.folder_display.setAlignment(Qt.AlignCenter)
        self.folder_display.setWordWrap(True)
        self.folder_display.setStyleSheet("""
            QLabel {
                background-color: #0f131c;
                border: 1px solid #232a3a;
                border-radius: 10px;
                padding: 10px 12px;
                font-family: "Consolas", "Monaco", monospace;
                color: #4f8cff;
                font-size: 11px;
            }
        """)
        self.update_folder_display()
        content_layout.addWidget(self.folder_display)        
        btn_browse = QPushButton("📁 Browse Folder")
        btn_browse.clicked.connect(self.browse_folder)
        btn_browse.setMinimumHeight(44)
        content_layout.addWidget(btn_browse)        
        btn_default = QPushButton("📂 Use Default Location")
        btn_default.clicked.connect(self.use_default_folder)
        btn_default.setMinimumHeight(44)
        content_layout.addWidget(btn_default)        
        self.folder_error_label = QLabel()
        self.folder_error_label.setAlignment(Qt.AlignCenter)
        self.folder_error_label.setStyleSheet("color: #ef4444; font-size: 11px;")
        self.folder_error_label.setVisible(False)
        content_layout.addWidget(self.folder_error_label)
        self.btn_continue = QPushButton("Please choose and confirm a location")
        self.btn_continue.setMinimumHeight(44)
        self.btn_continue.setEnabled(False)
        self.btn_continue.setToolTip("Cannot continue until location is chosen")
        self.btn_continue.setStyleSheet("""
            QPushButton:disabled {
                background-color: #11151d;
                color: #717a8c;
                border-color: #1a2030;
            }
            QPushButton {
                background-color: #1d3b2a;
                border: 1px solid #23533a;
                color: #c6f6d5;
            }
            QPushButton:hover { background-color: #204330; border-color: #2a6a48; }
            QPushButton:pressed { background-color: #193324; }
        """)
        self.btn_continue.clicked.connect(self.continue_to_login)
        content_layout.addWidget(self.btn_continue)
        disclaimer_label = QLabel(
            "Note: For easy access, crucial app data (like configuration files) will always be stored in Documents/SupaScrapeR. "
            "Your user data will be stored in the folder you choose."
        )
        disclaimer_label.setAlignment(Qt.AlignCenter)
        disclaimer_label.setObjectName("Muted")
        disclaimer_label.setStyleSheet("color: #6b7280; font-size: 12px; margin-top: 4px;")
        disclaimer_label.setWordWrap(True)
        content_layout.addWidget(disclaimer_label)        
        layout.addLayout(content_layout)
        layout.addStretch(1)         
        self.stack.addWidget(widget)
    
    def update_folder_display(self):
        default_folder = get_config_folder()        
        if not self.data_folder:
            last_folder = get_last_used_folder()
            if os.path.normpath(last_folder) == os.path.normpath(default_folder):
                self.folder_display.setText(f"Default: {os.path.normpath(last_folder)}")
            else:
                self.folder_display.setText(f"Current: {os.path.normpath(last_folder)}")
        else:
            try:
                os.makedirs(self.data_folder, exist_ok=True)
                if os.path.normpath(self.data_folder) == os.path.normpath(default_folder):
                    self.folder_display.setText(f"Default: {os.path.normpath(self.data_folder)}")
                else:
                    self.folder_display.setText(f"Selected: {os.path.normpath(self.data_folder)}")
            except Exception as e:
                log_error(f"Error creating data folder: {e}")
                self.folder_display.setText(f"Error: Cannot access {self.data_folder}")
    
    def show_folder_error(self, message):
        self.folder_error_label.setText(message)
        self.folder_error_label.setVisible(True)
        log_error(f"Folder error: {message}")

    def browse_folder(self):
        documents = QStandardPaths.writableLocation(QStandardPaths.DocumentsLocation)
        folder = QFileDialog.getExistingDirectory(
            self, 
            "Select Data Storage Folder",
            documents
        )
        if folder:
            if os.path.normpath(folder) == os.path.normpath(get_config_folder()):
                self.show_folder_error("Please select a different folder than the configuration folder")
                return
            self.data_folder = folder
            if os.path.normpath(folder) == os.path.normpath(get_config_folder()):
                self.show_folder_error("Cannot use configuration folder as data folder")
                return
            try:
                os.makedirs(self.data_folder, exist_ok=True)
                self.update_folder_display()
                self.folder_error_label.setVisible(False)
                self.btn_continue.setEnabled(True)
                self.btn_continue.setText("✨ Continue")
            except Exception as e:
                error_msg = f"Cannot access selected folder: {str(e)}"
                self.folder_error_label.setText(error_msg)
                self.folder_error_label.setVisible(True)
                log_error(f"Folder access error: {str(e)}")
    
    def use_default_folder(self):
        self.data_folder = get_config_folder()
        try:
            os.makedirs(self.data_folder, exist_ok=True)
            self.update_folder_display()
            self.folder_error_label.setVisible(False)
            self.btn_continue.setEnabled(True)
            self.btn_continue.setText("✨ Continue")
        except Exception as e:
            error_msg = f"Cannot access default folder: {str(e)}"
            self.folder_error_label.setText(error_msg)
            self.folder_error_label.setVisible(True)
            log_error(f"Default folder access error: {str(e)}")
            self.folder_error_label.setText(error_msg)
            self.folder_error_label.setVisible(True)

    def continue_to_login(self):
        if not self.data_folder:
            self.use_default_folder()
        try:
            os.makedirs(self.data_folder, exist_ok=True)
            if not save_last_used_folder(self.data_folder):
                log_error("Warning: Could not save last used folder")
            self.credentials_manager = CredentialsManager(self.data_folder)
            self.preset_manager = PresetManager(self.data_folder)
            global DATA_FOLDER
            DATA_FOLDER = self.data_folder
            self.load_saved_credentials()
            self.stack.setCurrentIndex(self.LOGIN_SCREEN)
        except Exception as e:
            error_msg = f"Cannot setup data folder: {str(e)}"
            self.folder_error_label.setText(error_msg)
            self.folder_error_label.setVisible(True)
            log_error(f"Folder setup error: {str(e)}\n{traceback.format_exc()}")

    def setup_login_screen(self):
        widget = QWidget()
        layout = QVBoxLayout()
        layout.setContentsMargins(50, 50, 50, 50)
        layout.setSpacing(4)
        widget.setLayout(layout)
        layout.addStretch(1)        
        title_container = self.create_title_with_logo()
        layout.addSpacing(-15)
        layout.addLayout(title_container)
        content_layout = QVBoxLayout()
        content_layout.setSpacing(12)
        input_field_style = """
            QTextEdit {
                background-color: #0f131c !important;
                border: 1px solid #232a3a !important;
                border-radius: 10px !important;
                padding: 10px 12px !important;
                font-family: "Consolas", "Monaco", monospace !important;
                color: #e5e7eb !important;
                font-size: 12px !important;
            }
            QTextEdit:focus { 
                border-color: #4f8cff !important; 
                background-color: #0f131c !important;
                color: #e5e7eb !important;
            }
        """
        url_instruction = QLabel("Supabase Project URL:")
        url_instruction.setObjectName("Muted")
        content_layout.addWidget(url_instruction)             
        self.supabase_url_input = QTextEdit()
        self.supabase_url_input.setFixedHeight(60)
        self.supabase_url_input.setPlaceholderText("https://your-project.supabase.co")
        self.supabase_url_input.setStyleSheet(input_field_style)
        content_layout.addWidget(self.supabase_url_input)
        key_instruction_layout = QHBoxLayout()
        key_instruction_layout.setContentsMargins(0, 8, 0, 2)
        key_instruction = QLabel("Supabase Service Role Key:")
        key_instruction.setObjectName("Muted")
        key_instruction_layout.addWidget(key_instruction)      
        self.service_key_visible = False
        self.service_key_toggle_btn = QPushButton()
        self.service_key_toggle_btn.setFixedSize(18, 18) 
        try:
            eye_open_icon = self.create_colored_icon(resource_path("assets/eye_open.png"), "#9aa4b2")
            self.service_key_toggle_btn.setIcon(eye_open_icon)
            self.service_key_toggle_btn.setIconSize(QSize(14, 14)) 
        except Exception as e:
            log_error(f"Icon loading error: {e}")
            self.service_key_toggle_btn.setText("👁")
        self.service_key_toggle_btn.setStyleSheet("""
            QPushButton {
                background-color: transparent;
                border: none;
                padding: 0px;
                margin: 0px;
                margin-left: -4px;
                margin-top: 2px;
            }
            QPushButton:hover {
                background-color: transparent;
            }
            QPushButton:pressed {
                background-color: transparent;
            }
            QPushButton:focus {
                outline: none;
                background-color: transparent;
            }
        """)
        self.service_key_toggle_btn.clicked.connect(self.toggle_service_key_visibility)
        self.service_key_toggle_btn.setToolTip("Click to show service key")
        key_instruction_layout.addWidget(self.service_key_toggle_btn)
        key_instruction_layout.addStretch()
        content_layout.addLayout(key_instruction_layout)        
        self.service_key_input = QTextEdit()
        self.service_key_input.setObjectName("ServiceKeyInput")
        self.service_key_input.setFixedHeight(72)
        self.service_key_input.setPlaceholderText("Paste your Supabase service role key here... Never share it publicly. If leaked, generate a new JWT secret immediately. Don't worry: SupaScrapeR safely encrypts your data in a secure manner.")
        self.service_key_input.setStyleSheet(input_field_style)
        self.service_key_input.textChanged.connect(self.update_service_key_display)
        content_layout.addWidget(self.service_key_input)
        self.actual_service_key = ""
        reddit_id_label = QLabel("Reddit Client ID:")
        reddit_id_label.setObjectName("Muted")
        content_layout.addWidget(reddit_id_label)        
        self.reddit_client_id_input = QTextEdit()
        self.reddit_client_id_input.setFixedHeight(72)
        self.reddit_client_id_input.setPlaceholderText("Your Reddit client ID")
        self.reddit_client_id_input.setStyleSheet(input_field_style)
        content_layout.addWidget(self.reddit_client_id_input)
        reddit_secret_label = QLabel("Reddit Client Secret:")
        reddit_secret_label.setObjectName("Muted")
        content_layout.addWidget(reddit_secret_label)                
        self.reddit_client_secret_input = QTextEdit()
        self.reddit_client_secret_input.setFixedHeight(72)
        self.reddit_client_secret_input.setPlaceholderText("Your Reddit client secret")
        self.reddit_client_secret_input.setStyleSheet(input_field_style)
        content_layout.addWidget(self.reddit_client_secret_input)
        reddit_ua_label = QLabel("Reddit User Agent:")
        reddit_ua_label.setObjectName("Muted")
        content_layout.addWidget(reddit_ua_label)            
        self.reddit_user_agent_input = QTextEdit()
        self.reddit_user_agent_input.setFixedHeight(72)
        self.reddit_user_agent_input.setPlaceholderText("Your Reddit user agent (e.g., MyApp/1.0 by username)")
        self.reddit_user_agent_input.setStyleSheet(input_field_style)
        content_layout.addWidget(self.reddit_user_agent_input)
        self.keep_signed_in_checkbox = QCheckBox("Keep me signed in on this device")
        self.keep_signed_in_checkbox.setStyleSheet("""
            QCheckBox {
                font-size: 12px;
                color: #9aa4b2;
                padding: 4px;
            }
        """)
        content_layout.addWidget(self.keep_signed_in_checkbox)
        self.login_error_label = QLabel()
        self.login_error_label.setAlignment(Qt.AlignCenter)
        self.login_error_label.setObjectName("Muted")
        self.login_error_label.setWordWrap(True)
        self.login_error_label.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Minimum)
        self.login_error_label.setStyleSheet("""
            QLabel {
                color: #ef4444; 
                font-size: 11px;
                padding: 10px 12px;
                background-color: #2d1114;
                border: 1px solid #5a1c21;
                border-radius: 10px;
                margin: 0px;
            }
        """)
        self.login_error_label.setVisible(False)
        content_layout.addWidget(self.login_error_label)
        self.btn_login = QPushButton("🔑 Login")
        self.btn_login.setStyleSheet("""
            QPushButton:disabled {
                background-color: #11151d;
                color: #717a8c;
                border-color: #1a2030;
            }
        """)
        self.btn_login.clicked.connect(self.handle_login)
        self.btn_login.setMinimumHeight(44)
        self.btn_login.setEnabled(False)
        self.btn_login.setToolTip("Please fill in all fields")
        content_layout.addWidget(self.btn_login)
        self.supabase_url_input.textChanged.connect(self.update_login_button_state)
        self.service_key_input.textChanged.connect(self.update_login_button_state)
        self.reddit_client_id_input.textChanged.connect(self.update_login_button_state)
        self.reddit_client_secret_input.textChanged.connect(self.update_login_button_state)
        self.reddit_user_agent_input.textChanged.connect(self.update_login_button_state)
        btn_back_folder = QPushButton("← Change Data Folder")
        btn_back_folder.clicked.connect(lambda: self.stack.setCurrentIndex(self.FOLDER_SELECT_SCREEN))
        btn_back_folder.setStyleSheet("""
            QPushButton {
                background-color: transparent;
                border: 1px solid #374151;
                color: #9aa4b2;
                font-size: 12px;
                padding: 8px 12px;
            }
            QPushButton:hover {
                background-color: #1f2937;
                color: #e5e7eb;
            }
        """)
        content_layout.addWidget(btn_back_folder)
        layout.addLayout(content_layout)
        layout.addStretch(1)
        self.stack.addWidget(widget)
        QApplication.processEvents()
        self.setup_paste_interceptors()
        self.force_input_styling() 
    
    def create_colored_icon(self, relative_path, color):
        try:
            from PyQt5.QtGui import QPixmap, QPainter, QColor
            from PyQt5.QtCore import Qt
            abs_path = resource_path(relative_path)
            if not os.path.exists(abs_path):
                log_error(f"Icon file not found: {abs_path}")
                return QIcon()
            pixmap = QPixmap(abs_path)
            if pixmap.isNull():
                log_error(f"Could not load image: {abs_path}")
                return QIcon()
            colored_pixmap = QPixmap(pixmap.size())
            colored_pixmap.fill(Qt.transparent)
            painter = QPainter(colored_pixmap)
            painter.setRenderHint(QPainter.Antialiasing)
            painter.drawPixmap(0, 0, pixmap)
            painter.setCompositionMode(QPainter.CompositionMode_SourceAtop)
            painter.fillRect(colored_pixmap.rect(), QColor(color))
            painter.end()
            return QIcon(colored_pixmap)
        except Exception as e:
            log_error(f"Error creating colored icon from {relative_path}: {e}")
            return QIcon()

    def toggle_service_key_visibility(self):
        self.service_key_visible = not self.service_key_visible
        if self.service_key_visible:
            try:
                eye_closed_icon = self.create_colored_icon("assets/eye_closed.png", "#9aa4b2")
                self.service_key_toggle_btn.setIcon(eye_closed_icon)
            except Exception as e:
                log_error(f"Error loading closed eye icon: {e}")
                self.service_key_toggle_btn.setText("🙈")
            self.service_key_toggle_btn.setToolTip("Click to hide service key")
            self.service_key_input.textChanged.disconnect()
            self.service_key_input.setPlainText(self.actual_service_key)
            self.service_key_input.textChanged.connect(self.update_service_key_display)
        else:
            try:
                eye_open_icon = self.create_colored_icon("assets/eye_open.png", "#9aa4b2")
                self.service_key_toggle_btn.setIcon(eye_open_icon)
            except Exception as e:
                log_error(f"Error loading open eye icon: {e}")
                self.service_key_toggle_btn.setText("👁")
            self.service_key_toggle_btn.setToolTip("Click to show service key")
            self.service_key_input.textChanged.disconnect()
            if self.actual_service_key:
                self.service_key_input.setPlainText("•" * len(self.actual_service_key))
            self.service_key_input.textChanged.connect(self.update_service_key_display)
    
    def update_service_key_display(self):
        if self.service_key_visible:
            self.actual_service_key = self.service_key_input.toPlainText()
        else:
            current_text = self.service_key_input.toPlainText()
            if current_text and all(c == '•' for c in current_text):
                return
            if current_text != "•" * len(self.actual_service_key):
                self.actual_service_key = current_text
                cursor_pos = self.service_key_input.textCursor().position()
                self.service_key_input.textChanged.disconnect()
                self.service_key_input.setPlainText("•" * len(self.actual_service_key))
                cursor = self.service_key_input.textCursor()
                cursor.setPosition(min(cursor_pos, len(self.actual_service_key)))
                self.service_key_input.setTextCursor(cursor)
                self.service_key_input.textChanged.connect(self.update_service_key_display)

    def handle_login(self):
        supabase_url = self.supabase_url_input.toPlainText().strip()
        service_key = self.actual_service_key.strip()
        reddit_client_id = self.reddit_client_id_input.toPlainText().strip()
        reddit_client_secret = self.reddit_client_secret_input.toPlainText().strip()
        reddit_user_agent = self.reddit_user_agent_input.toPlainText().strip()
        if not all([supabase_url, service_key, reddit_client_id, 
                reddit_client_secret, reddit_user_agent]):
            self.show_login_error("Please fill in all fields")
            return
        if not supabase_url.startswith(('http://', 'https://')):
            self.show_login_error("Supabase URL must start with http:// or https://")
            return
        self.btn_login.setEnabled(False)
        self.btn_login.setText("🔄 Testing connections...")
        QApplication.processEvents()
        try:
            try:
                supabase_client = create_client(supabase_url, service_key)
                supabase_success, supabase_error = test_supabase_connection(supabase_client)
                if not supabase_success:
                    raise Exception(supabase_error)
            except Exception as e:
                raise Exception(f"Supabase: {str(e)}")
            try:
                reddit_client = create_reddit_client_safe(
                    reddit_client_id,
                    reddit_client_secret, 
                    reddit_user_agent
                )
                reddit_success, reddit_error = test_reddit_connection(reddit_client)
                if not reddit_success:
                    raise Exception(reddit_error)
            except Exception as e:
                raise Exception(f"Reddit: {str(e)}")
            global supabase
            supabase = supabase_client
            self.reddit = reddit_client
            if self.keep_signed_in_checkbox.isChecked():
                success = self.credentials_manager.save_credentials(
                    supabase_url, service_key, 
                    reddit_client_id, reddit_client_secret, reddit_user_agent
                )
                if not success:
                    log_error("Warning: Could not save credentials")
            self.login_error_label.setVisible(False)
            self.reset_input_styles()
            self.btn_login.setText("🔑 Login")
            self.btn_login.setEnabled(True)
            self.stack.setCurrentIndex(self.RUN_MODE_SCREEN)
        except Exception as e:
            self.btn_login.setText("🔑 Login")
            self.btn_login.setEnabled(True)
            try:
                error_msg = str(e) if hasattr(e, '__str__') else repr(e)
                if not error_msg or error_msg.strip() == "":
                    error_msg = "Authentication failed"
            except Exception:
                error_msg = "Login failed - please check your credentials"
            if len(error_msg) > 200:
                error_display = error_msg[:200] + "..."
            else:
                error_display = error_msg
            self.show_login_error(f"Login failed: {error_display}")
            log_error(f"Login failed: {error_msg}")
            log_error(f"Full traceback:\n{traceback.format_exc()}")

    def show_login_error(self, message):
        self.supabase_url_input.setStyleSheet("""
            QTextEdit {
                background-color: #0f131c;
                border: 1px solid #ef4444;
                border-radius: 10px;
                padding: 10px 12px;
            }
        """)
        self.service_key_input.setStyleSheet("""
            QTextEdit {
                background-color: #0f131c;
                border: 1px solid #ef4444;
                border-radius: 10px;
                padding: 10px 12px;
            }
        """)
        self.reddit_client_id_input.setStyleSheet("""
            QTextEdit {
                background-color: #0f131c;
                border: 1px solid #ef4444;
                border-radius: 10px;
                padding: 10px 12px;
            }
        """)
        self.reddit_client_secret_input.setStyleSheet("""
            QTextEdit {
                background-color: #0f131c;
                border: 1px solid #ef4444;
                border-radius: 10px;
                padding: 10px 12px;
            }
        """)
        self.reddit_user_agent_input.setStyleSheet("""
            QTextEdit {
                background-color: #0f131c;
                border: 1px solid #ef4444;
                border-radius: 10px;
                padding: 10px 12px;
            }
        """)
        self.login_error_label.setText(message)
        self.login_error_label.setVisible(True)

    def reset_input_styles(self):
        normal_style = """
            QTextEdit {
                background-color: #0f131c !important;
                border: 1px solid #232a3a !important;
                border-radius: 10px !important;
                padding: 10px 12px !important;
                font-family: "Consolas", "Monaco", monospace !important;
                color: #e5e7eb !important;
                font-size: 12px !important;
            }
            QTextEdit:focus { 
                border-color: #4f8cff !important;
                background-color: #0f131c !important;
                color: #e5e7eb !important;
            }
        """
        self.supabase_url_input.setStyleSheet(normal_style)
        self.service_key_input.setStyleSheet(normal_style)
        self.reddit_client_id_input.setStyleSheet(normal_style)
        self.reddit_client_secret_input.setStyleSheet(normal_style)
        self.reddit_user_agent_input.setStyleSheet(normal_style)

    def setup_run_mode_screen(self):
        widget = QWidget()
        outer_layout = QVBoxLayout()
        outer_layout.setContentsMargins(12, 12, 12, 12)
        topbar = QHBoxLayout()
        topbar.addStretch()
        outer_layout.addLayout(topbar)
        layout = QVBoxLayout()
        layout.setContentsMargins(50, 50, 50, 50)
        layout.setSpacing(4)
        layout.addStretch(1)     
        title_container = self.create_title_with_logo()
        layout.addSpacing(-15)
        layout.addLayout(title_container)
        content_layout = QVBoxLayout()
        content_layout.setSpacing(12)
        instruction_label = QLabel("Choose how you want to run the scraper:")
        instruction_label.setAlignment(Qt.AlignCenter)
        instruction_label.setObjectName("Muted")
        instruction_label.setContentsMargins(0, 0, 0, 2)
        content_layout.addWidget(instruction_label)
        btn_once = QPushButton("🔄 Run Once")
        btn_once.clicked.connect(lambda: self.set_run_mode("once"))
        btn_once.setMinimumHeight(44)
        btn_once.setMaximumWidth(300)        
        btn_infinite = QPushButton("♾️ Run Continuously")
        btn_infinite.clicked.connect(lambda: self.set_run_mode("infinite"))
        btn_infinite.setMinimumHeight(44)
        btn_infinite.setMaximumWidth(300)
        btn_infinite.setStyleSheet("""
            QPushButton {
                font-size: 13px; 
            }
        """)
        btn_logout = QPushButton("🔒 Logout")
        btn_logout.clicked.connect(self.logout)
        btn_logout.setMinimumHeight(44)
        btn_logout.setMaximumWidth(300)
        btn_logout.setStyleSheet("""
            QPushButton {
                background-color: #3a1114;
                border: 1px solid #5a1c21;
                color: #ffd4d6;
            }
            QPushButton:hover { background-color: #471519; border-color: #6d242a; }
            QPushButton:pressed { background-color: #2c0c0f; }
        """)
        button_width = 300
        btn_once.setFixedWidth(button_width)
        btn_infinite.setFixedWidth(button_width)
        btn_logout.setFixedWidth(button_width)
        button_height = 44
        btn_once.setFixedHeight(button_height)
        btn_infinite.setFixedHeight(button_height)
        btn_logout.setFixedHeight(button_height)
        content_layout.addWidget(btn_once, alignment=Qt.AlignHCenter)
        content_layout.addWidget(btn_infinite, alignment=Qt.AlignHCenter)
        content_layout.addWidget(btn_logout, alignment=Qt.AlignHCenter)        
        layout.addLayout(content_layout)
        layout.addStretch(1)        
        outer_layout.addLayout(layout) 
        widget.setLayout(outer_layout) 
        self.stack.addWidget(widget)
    
    def logout(self):
        try:
            if self.credentials_manager:
                self.credentials_manager.delete_credentials()
            self.reddit = None
            global supabase
            supabase = None
            self.selected_keywords = []
            self.keywords = ["politics"]
            self.run_mode = None
            self.scrape_mode = None
            self.selected_preset = None
            self.stack.setCurrentIndex(self.FOLDER_SELECT_SCREEN)
        except Exception as e:
            log_error(f"Logout failed: {str(e)}\n{traceback.format_exc()}")
            try:
                QMessageBox.critical(self, "Logout Error", f"Failed to logout: {str(e)}")
            except Exception as msg_error:
                log_error(f"Failed to show logout error message: {msg_error}")

    def setup_scrape_mode_screen(self):
        widget = QWidget()
        outer_layout = QVBoxLayout()
        outer_layout.setContentsMargins(12, 12, 12, 12)
        topbar = QHBoxLayout()
        btn_back = QPushButton("← Back")
        btn_back.setFixedHeight(40)
        btn_back.clicked.connect(lambda: self.stack.setCurrentIndex(self.RUN_MODE_SCREEN))
        topbar.addWidget(btn_back, 0, Qt.AlignLeft)
        topbar.addStretch()
        outer_layout.addLayout(topbar)
        layout = QVBoxLayout()
        layout.setContentsMargins(50, 50, 50, 50)
        layout.setSpacing(16)
        layout.addStretch(1)
        content_layout = QVBoxLayout()
        content_layout.setSpacing(12)
        instruction_label = QLabel("Select your scraping strategy:")
        instruction_label.setAlignment(Qt.AlignCenter)
        instruction_label.setObjectName("Muted")
        content_layout.addWidget(instruction_label)
        keyword_layout = QHBoxLayout()
        btn_keyword = QPushButton("🔍 Keyword Search Only")
        btn_keyword.clicked.connect(lambda: self.set_scrape_mode("keyword"))
        btn_keyword.setMinimumHeight(44)
        btn_keyword.setFixedWidth(280)
        btn_keyword_settings = QPushButton("⚙️")
        btn_keyword_settings.setObjectName("SettingsButton")
        btn_keyword_settings.clicked.connect(lambda: self.open_settings("keyword"))
        btn_keyword_settings.setFixedSize(44, 44)
        btn_keyword_settings.setStyleSheet("""
            QPushButton {
                width: 44px;
                height: 44px;
                border-radius: 8px;
                text-align: center;
                padding: 0px;
            }
        """)
        btn_keyword_settings.setToolTip("Customize subreddit lists")
        keyword_layout.addStretch()
        keyword_layout.addWidget(btn_keyword)
        keyword_layout.addWidget(btn_keyword_settings)
        keyword_layout.addStretch()
        content_layout.addLayout(keyword_layout)
        deepscan_layout = QHBoxLayout()
        btn_deepscan = QPushButton("🔬 DeepScan Only")
        btn_deepscan.clicked.connect(lambda: self.set_scrape_mode("deepscan"))
        btn_deepscan.setMinimumHeight(44)
        btn_deepscan.setFixedWidth(280)
        btn_deepscan_settings = QPushButton("⚙️")
        btn_deepscan_settings.setObjectName("SettingsButton")
        btn_deepscan_settings.clicked.connect(lambda: self.open_settings("deepscan"))
        btn_deepscan_settings.setFixedSize(44, 44)
        btn_deepscan_settings.setStyleSheet("""
            QPushButton {
                width: 44px;
                height: 44px;
                border-radius: 8px;
                text-align: center;
                padding: 0px;
            }
        """)
        btn_deepscan_settings.setToolTip("Customize subreddit lists")
        deepscan_layout.addStretch()
        deepscan_layout.addWidget(btn_deepscan)
        deepscan_layout.addWidget(btn_deepscan_settings)
        deepscan_layout.addStretch()
        content_layout.addLayout(deepscan_layout)
        both_layout = QHBoxLayout()
        btn_both = QPushButton("⚡ Both Keyword and DeepScan")
        btn_both.clicked.connect(lambda: self.set_scrape_mode("both"))
        btn_both.setMinimumHeight(44)
        btn_both.setFixedWidth(280)
        btn_both_settings = QPushButton("⚙️")
        btn_both_settings.setObjectName("SettingsButton")
        btn_both_settings.clicked.connect(lambda: self.open_settings("both"))
        btn_both_settings.setFixedSize(44, 44)
        btn_both_settings.setStyleSheet("""
            QPushButton {
                width: 44px;
                height: 44px;
                border-radius: 8px;
                text-align: center;
                padding: 0px;
            }
        """)
        btn_deepscan_settings.setToolTip("Customize subreddit lists")
        btn_both_settings.setToolTip("Customize subreddit lists")
        both_layout.addStretch()
        both_layout.addWidget(btn_both)
        both_layout.addWidget(btn_both_settings)
        both_layout.addStretch()
        content_layout.addLayout(both_layout)
        layout.addLayout(content_layout)
        layout.addStretch(1) 
        outer_layout.addLayout(layout)
        widget.setLayout(outer_layout)
        self.stack.addWidget(widget)

    def open_settings(self, settings_type):
        self.current_settings_type = settings_type
        self.selected_preset_num = None
        if hasattr(self, 'preset_buttons'):
            for btn in self.preset_buttons:
                btn.setParent(None)
                btn.deleteLater()
            del self.preset_buttons
        self.setup_settings_for_type(settings_type)
        self.stack.setCurrentIndex(self.SETTINGS_SCREEN)

    def setup_settings_screen(self):
        self.settings_widget = QWidget()
        self.settings_outer_layout = QVBoxLayout()
        self.settings_outer_layout.setContentsMargins(12, 12, 12, 12)
        topbar = QHBoxLayout()
        self.settings_back_btn = QPushButton("← Back")
        self.settings_back_btn.setFixedHeight(40)
        self.settings_back_btn.clicked.connect(lambda: self.stack.setCurrentIndex(self.SCRAPE_MODE_SCREEN))
        topbar.addWidget(self.settings_back_btn, 0, Qt.AlignLeft)
        topbar.addStretch()
        self.settings_outer_layout.addLayout(topbar)
        self.settings_content_layout = QVBoxLayout()
        self.settings_outer_layout.addLayout(self.settings_content_layout)
        self.settings_widget.setLayout(self.settings_outer_layout)
        self.stack.addWidget(self.settings_widget)

    def clear_layout_recursive(self, layout):
        while layout.count():
            child = layout.takeAt(0)
            if child.widget():
                widget = child.widget()
                widget.setParent(None)
                widget.deleteLater()
            elif child.layout():
                self.clear_layout_recursive(child.layout())
                child.layout().setParent(None)

    def setup_settings_for_type(self, settings_type):
        self.preset_buttons = []
        while self.settings_content_layout.count():
            child = self.settings_content_layout.takeAt(0)
            if child.widget():
                child.widget().setParent(None)
                child.widget().deleteLater()
            elif child.layout():
                self.clear_layout_recursive(child.layout())
        if hasattr(self, 'preset_buttons'):
            self.preset_buttons.clear()
        QApplication.processEvents()
        layout = QVBoxLayout()
        layout.setContentsMargins(50, 50, 50, 50)
        layout.setSpacing(24)
        layout.setAlignment(Qt.AlignCenter)
        layout.addStretch(1)
        if settings_type == "keyword":
            title_text = "Keyword Search Settings"
            subtitle_text = "Configure subreddits for keyword-based searches\n(These subreddits will be searched for your keywords)"
            default_subreddits = BROAD_SUBREDDITS[:]
            preset_type = "broad"
        elif settings_type == "deepscan":
            title_text = "DeepScan Settings"
            subtitle_text = "Configure subreddits for deep scanning\n(These subreddits will be scanned for high-engagement posts)"
            default_subreddits = CONCENTRATED_SUBREDDITS[:]
            preset_type = "concentrated"
        else:
            title_text = "Combined Settings"
            subtitle_text = "Configure subreddits for both keyword search and deep scanning"
            default_subreddits = BROAD_SUBREDDITS[:] + CONCENTRATED_SUBREDDITS[:]
            preset_type = "both"
        title_label = QLabel(title_text)
        title_label.setObjectName("SectionTitle")
        title_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(title_label)
        subtitle_label = QLabel(subtitle_text)
        subtitle_label.setAlignment(Qt.AlignCenter)
        subtitle_label.setObjectName("Muted")
        layout.addWidget(subtitle_label)
        if settings_type == "both":
            self.setup_both_settings_content(layout)
        else:
            self.setup_single_settings_content(layout, preset_type, default_subreddits)
        layout.addStretch(1)
        self.settings_content_layout.addLayout(layout)

    def setup_single_settings_content(self, layout, preset_type, default_subreddits):
        content_layout = QVBoxLayout()
        content_layout.setSpacing(12)
        content_layout.setAlignment(Qt.AlignCenter)
        instruction_label = QLabel("Enter subreddits separated by commas (exclude 'r/' prefix):")
        instruction_label.setAlignment(Qt.AlignCenter)
        instruction_label.setObjectName("Muted")
        content_layout.addWidget(instruction_label)
        self.settings_subreddit_input = QTextEdit()
        self.settings_subreddit_input.setFixedHeight(100)
        self.settings_subreddit_input.setPlainText(", ".join(default_subreddits))
        self.settings_subreddit_input.setPlaceholderText("Enter subreddits like: politics, news, worldnews")
        self.settings_subreddit_input.setStyleSheet("""
            QTextEdit {
                background-color: #0f131c;
                border: 1px solid #232a3a;
                border-radius: 10px;
                padding: 10px 12px;
                font-family: "Consolas", "Monaco", monospace;
                color: #e5e7eb;
            }
            QTextEdit:focus { border-color: #4f8cff; }
        """)
        content_layout.addWidget(self.settings_subreddit_input)
        presets_label = QLabel("Presets:")
        presets_label.setObjectName("Muted")
        presets_label.setAlignment(Qt.AlignCenter)
        content_layout.addWidget(presets_label)
        presets_widget = QWidget()
        presets_layout = QHBoxLayout(presets_widget)
        presets_layout.setContentsMargins(0, 0, 0, 0)
        presets_layout.setSpacing(10)
        self.preset_buttons = []
        self.selected_preset_num = None
        button_width = 50 
        for i in range(1, 6):
            preset_btn = QPushButton(str(i))
            preset_btn.setObjectName("PresetButton")
            preset_btn.setCheckable(True)
            preset_btn.setMinimumWidth(button_width) 
            preset_btn.setFixedHeight(44)
            preset_btn.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed) 
            preset_btn.setStyleSheet("""
                QPushButton {
                    text-align: center;
                    font-weight: bold;
                    font-size: 14px;
                }
            """)
            preset_btn.clicked.connect(lambda checked, num=i: self.select_preset_number(num))
            self.preset_buttons.append(preset_btn)
            presets_layout.addWidget(preset_btn)
        for i, btn in enumerate(self.preset_buttons):
            btn.clicked.connect(lambda checked, num=i+1: self.select_preset_number(num))
        content_layout.addWidget(presets_widget)
        self.settings_save_btn = QPushButton("💾 Save to Preset")
        self.settings_save_btn.setEnabled(False)
        self.settings_save_btn.setToolTip("Please select a preset to save to")
        self.settings_save_btn.setMinimumHeight(44)
        self.settings_save_btn.clicked.connect(lambda: self.save_preset_settings(preset_type))
        content_layout.addWidget(self.settings_save_btn)
        self.settings_status_label = QLabel("Selecting a used preset will overwrite its data.")
        self.settings_status_label.setAlignment(Qt.AlignCenter)
        self.settings_status_label.setStyleSheet("color: #6b7280; font-size: 11px;") 
        content_layout.addWidget(self.settings_status_label)
        layout.addLayout(content_layout)

    def setup_both_settings_content(self, layout):
        content_layout = QVBoxLayout()
        content_layout.setSpacing(16)
        content_layout.setAlignment(Qt.AlignCenter)
        broad_section = QVBoxLayout()
        broad_title = QLabel("Keyword Search Subreddits:")
        broad_title.setObjectName("Muted")
        broad_title.setAlignment(Qt.AlignCenter)
        broad_section.addWidget(broad_title)
        self.settings_broad_input = QTextEdit()
        self.settings_broad_input.setFixedHeight(80)
        self.settings_broad_input.setPlainText(", ".join(BROAD_SUBREDDITS))
        self.settings_broad_input.setPlaceholderText("Enter broad subreddits for keyword searches")
        self.settings_broad_input.setStyleSheet("""
            QTextEdit {
                background-color: #0f131c;
                border: 1px solid #232a3a;
                border-radius: 10px;
                padding: 10px 12px;
                font-family: "Consolas", "Monaco", monospace;
                color: #e5e7eb;
            }
            QTextEdit:focus { border-color: #4f8cff; }
        """)
        broad_section.addWidget(self.settings_broad_input)
        concentrated_section = QVBoxLayout()
        concentrated_title = QLabel("DeepScan Subreddits:")
        concentrated_title.setObjectName("Muted")
        concentrated_title.setAlignment(Qt.AlignCenter)
        concentrated_section.addWidget(concentrated_title)
        self.settings_concentrated_input = QTextEdit()
        self.settings_concentrated_input.setFixedHeight(80)
        self.settings_concentrated_input.setPlainText(", ".join(CONCENTRATED_SUBREDDITS))
        self.settings_concentrated_input.setPlaceholderText("Enter concentrated subreddits for deep scanning")
        self.settings_concentrated_input.setStyleSheet("""
            QTextEdit {
                background-color: #0f131c;
                border: 1px solid #232a3a;
                border-radius: 10px;
                padding: 10px 12px;
                font-family: "Consolas", "Monaco", monospace;
                color: #e5e7eb;
            }
            QTextEdit:focus { border-color: #4f8cff; }
        """)
        concentrated_section.addWidget(self.settings_concentrated_input)
        content_layout.addLayout(broad_section)
        content_layout.addLayout(concentrated_section)
        presets_label = QLabel("Presets:")
        presets_label.setObjectName("Muted")
        presets_label.setAlignment(Qt.AlignCenter)
        content_layout.addWidget(presets_label)
        presets_widget = QWidget()
        presets_layout = QHBoxLayout(presets_widget)
        presets_layout.setContentsMargins(0, 0, 0, 0)
        presets_layout.setSpacing(10)
        self.preset_buttons = []
        self.selected_preset_num = None
        button_width = 50
        for i in range(1, 6):
            preset_btn = QPushButton(str(i))
            preset_btn.setObjectName("PresetButton")
            preset_btn.setCheckable(True)
            preset_btn.setMinimumWidth(button_width) 
            preset_btn.setFixedHeight(44)
            preset_btn.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
            preset_btn.setStyleSheet("""
                QPushButton {
                    text-align: center;
                    font-weight: bold;
                    font-size: 14px;
                }
            """)
            preset_btn.clicked.connect(lambda checked, num=i: self.select_preset_number(num))
            self.preset_buttons.append(preset_btn)
            presets_layout.addWidget(preset_btn)
        for i, btn in enumerate(self.preset_buttons):
            btn.clicked.connect(lambda checked, num=i+1: self.select_preset_number(num))
        content_layout.addWidget(presets_widget)
        self.settings_save_btn = QPushButton("💾 Save to Preset")
        self.settings_save_btn.setEnabled(False)
        self.settings_save_btn.setToolTip("Please select a preset to save to")
        self.settings_save_btn.setMinimumHeight(44)
        self.settings_save_btn.clicked.connect(lambda: self.save_preset_settings("both"))
        content_layout.addWidget(self.settings_save_btn)
        self.settings_status_label = QLabel()
        self.settings_status_label.setAlignment(Qt.AlignCenter)
        self.settings_status_label.setVisible(False)
        self.settings_status_label.setStyleSheet("color: #f59e0b; font-size: 11px;")
        content_layout.addWidget(self.settings_status_label)
        layout.addLayout(content_layout)

    def select_preset_number(self, preset_num):
        for i, btn in enumerate(self.preset_buttons):
            if i + 1 != preset_num:
                btn.setChecked(False)
        clicked_button = self.preset_buttons[preset_num - 1]
        if not clicked_button.isChecked():
            self.selected_preset_num = None
            self.settings_save_btn.setEnabled(False)
            self.settings_save_btn.setStyleSheet("")  
            self.settings_save_btn.setToolTip("Please select a preset to save to")
            self.settings_status_label.setText("Selecting a used preset will overwrite its data.")
            self.settings_status_label.setStyleSheet("color: #6b7280; font-size: 11px;")
            self.settings_status_label.setVisible(True)
            return
        self.selected_preset_num = preset_num
        self.settings_save_btn.setEnabled(True)
        self.settings_save_btn.setStyleSheet("""
            QPushButton {
                background-color: #1d3b2a;
                border: 1px solid #23533a;
                color: #c6f6d5;
            }
            QPushButton:hover { background-color: #204330; border-color: #2a6a48; }
            QPushButton:pressed { background-color: #193324; }
        """)
        self.settings_save_btn.setToolTip("")
        if hasattr(self, 'current_settings_type'):
            if self.current_settings_type == "both":
                both_broad_data = self.preset_manager.presets["both_broad_presets"].get(str(preset_num), [])
                both_concentrated_data = self.preset_manager.presets["both_concentrated_presets"].get(str(preset_num), [])
                if both_broad_data or both_concentrated_data:
                    self.settings_status_label.setText(f"⚠️ Preset {preset_num} already has saved data. Overwrite it?")
                    self.settings_status_label.setStyleSheet("color: #f59e0b; font-size: 11px;")
                else:
                    self.settings_status_label.setText(f"✨ Preset {preset_num} is empty. New data will be saved.")
                    self.settings_status_label.setStyleSheet("color: #10b981; font-size: 11px;")
            else:
                preset_type = "broad" if self.current_settings_type == "keyword" else "concentrated"
                existing_data = self.preset_manager.get_preset(preset_type, preset_num)
                if existing_data:
                    self.settings_status_label.setText(f"⚠️ Preset {preset_num} already has saved data. Overwrite it?")
                    self.settings_status_label.setStyleSheet("color: #f59e0b; font-size: 11px;")
                else:
                    self.settings_status_label.setText(f"✨ Preset {preset_num} is empty. New data will be saved.")
                    self.settings_status_label.setStyleSheet("color: #10b981; font-size: 11px;")
            self.settings_status_label.setVisible(True)

    def save_preset_settings(self, settings_type):
        if not self.selected_preset_num:
            self.show_settings_error("Please select a preset first.")
            return
        try:
            self.preset_manager.presets = self.preset_manager.load_presets()
            if settings_type == "both":
                broad_text = self.settings_broad_input.toPlainText().strip()
                concentrated_text = self.settings_concentrated_input.toPlainText().strip()
                if not broad_text and not concentrated_text:
                    self.show_settings_error("Please enter subreddits in at least one section")
                    return
                broad_subreddits = []
                if broad_text:
                    broad_subreddits = [s.strip() for s in broad_text.split(',') if s.strip()]
                    for sub in broad_subreddits:
                        if not all(c.isalnum() or c in "_-" for c in sub):
                            self.show_settings_error(f"Invalid subreddit name in broad list: {sub}")
                            return
                concentrated_subreddits = []
                if concentrated_text:
                    concentrated_subreddits = [s.strip() for s in concentrated_text.split(',') if s.strip()]
                    for sub in concentrated_subreddits:
                        if not all(c.isalnum() or c in "_-" for c in sub):
                            self.show_settings_error(f"Invalid subreddit name in concentrated list: {sub}")
                            return
                success = True
                if broad_subreddits:
                    self.preset_manager.presets["both_broad_presets"][str(self.selected_preset_num)] = broad_subreddits
                if concentrated_subreddits:
                    self.preset_manager.presets["both_concentrated_presets"][str(self.selected_preset_num)] = concentrated_subreddits
                if self.preset_manager.save_presets():
                    self.settings_status_label.setText(f"✅ Preset {self.selected_preset_num} saved successfully!")
                    self.settings_status_label.setStyleSheet("color: #10b981; font-size: 11px;")
                    QApplication.processEvents()
                else:
                    raise Exception("Failed to save presets")
            else:
                if settings_type in ["keyword", "broad"]:
                    preset_key = "broad_presets"
                    input_widget = self.settings_subreddit_input
                elif settings_type in ["deepscan", "concentrated"]:
                    preset_key = "concentrated_presets"
                    input_widget = self.settings_subreddit_input
                else:
                    raise ValueError(f"Unknown settings type: {settings_type}")
                subreddit_text = input_widget.toPlainText().strip()
                if not subreddit_text:
                    self.show_settings_error("Please enter at least one subreddit.")
                    return
                subreddits = [s.strip() for s in subreddit_text.split(',') if s.strip()]
                for sub in subreddits:
                    if not all(c.isalnum() or c in "_-" for c in sub):
                        self.show_settings_error(f"Invalid subreddit name: {sub}")
                        return
                self.preset_manager.presets[preset_key][str(self.selected_preset_num)] = subreddits
                if self.preset_manager.save_presets():
                    self.settings_status_label.setText(f"✅ Preset {self.selected_preset_num} saved successfully!")
                    self.settings_status_label.setStyleSheet("color: #10b981; font-size: 11px;")
                    QApplication.processEvents()
                else:
                    raise Exception("Failed to save preset")
        except Exception as e:
            error_msg = f"Failed to save preset {self.selected_preset_num}: {str(e)}"
            log_error(error_msg)
            log_error(f"Current presets state: {json.dumps(self.preset_manager.presets, indent=2)}")
            self.show_settings_error(f"Save failed: {str(e)}")

    def show_settings_error(self, message):
        self.settings_status_label.setText(f"❌ {message}")
        self.settings_status_label.setStyleSheet("color: #ef4444; font-size: 11px;")
        self.settings_status_label.setVisible(True)

    def setup_preset_select_screen(self):
        widget = QWidget()
        outer_layout = QVBoxLayout()
        outer_layout.setContentsMargins(12, 12, 12, 12)
        topbar = QHBoxLayout()
        btn_back = QPushButton("← Back")
        btn_back.setFixedHeight(40)
        btn_back.clicked.connect(lambda: self.stack.setCurrentIndex(self.SCRAPE_MODE_SCREEN))
        topbar.addWidget(btn_back, 0, Qt.AlignLeft)
        topbar.addStretch()
        outer_layout.addLayout(topbar) 
        layout = QVBoxLayout()
        layout.setContentsMargins(50, 50, 50, 50)
        layout.setSpacing(16)
        layout.setAlignment(Qt.AlignCenter)
        layout.addStretch(1)
        self.preset_title_label = QLabel("Select Subreddit Preset")
        self.preset_title_label.setObjectName("SectionTitle")
        self.preset_title_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.preset_title_label)
        self.preset_instruction_label = QLabel("Choose which preset to use for scraping:")
        self.preset_instruction_label.setAlignment(Qt.AlignCenter)
        self.preset_instruction_label.setObjectName("Muted")
        layout.addWidget(self.preset_instruction_label)
        self.preset_selection_layout = QVBoxLayout()
        self.preset_selection_layout.setSpacing(8)
        self.preset_selection_layout.setAlignment(Qt.AlignCenter)
        layout.addLayout(self.preset_selection_layout)
        self.preset_confirm_btn = QPushButton("✨ Confirm Preset")
        self.preset_confirm_btn.setFixedWidth(1250)
        self.preset_confirm_btn.setEnabled(False)
        self.preset_confirm_btn.setToolTip("Please select a preset first")
        self.preset_confirm_btn.setMinimumHeight(44)
        self.preset_confirm_btn.setMaximumWidth(300)
        self.preset_confirm_btn.clicked.connect(self.confirm_preset_selection)
        self.preset_confirm_btn.setStyleSheet("""
            QPushButton:disabled {
                background-color: #11151d;
                color: #717a8c;
                border-color: #1a2030;
            }
            QPushButton {
                background-color: #1d3b2a;
                border: 1px solid #23533a;
                color: #c6f6d5;
            }
            QPushButton:hover { background-color: #204330; border-color: #2a6a48; }
            QPushButton:pressed { background-color: #193324; }
        """)
        layout.addWidget(self.preset_confirm_btn, alignment=Qt.AlignCenter)
        layout.addStretch(1)
        outer_layout.addLayout(layout)
        widget.setLayout(outer_layout)
        self.stack.addWidget(widget)

    def setup_batch_size_screen(self):
        self.batch_size_widget = QWidget()
        self.batch_size_outer_layout = QVBoxLayout()
        self.batch_size_outer_layout.setContentsMargins(12, 12, 12, 12)
        topbar = QHBoxLayout()
        self.batch_size_back_btn = QPushButton("← Back")
        self.batch_size_back_btn.setFixedHeight(40)
        self.batch_size_back_btn.clicked.connect(self.handle_batch_size_back)
        topbar.addWidget(self.batch_size_back_btn, 0, Qt.AlignLeft)
        topbar.addStretch()
        self.batch_size_outer_layout.addLayout(topbar)
        self.batch_size_content_layout = QVBoxLayout()
        self.batch_size_outer_layout.addLayout(self.batch_size_content_layout)
        self.batch_size_widget.setLayout(self.batch_size_outer_layout)
        self.stack.addWidget(self.batch_size_widget)

    def setup_batch_size_for_type(self, batch_type):
        self.batch_size_buttons = []
        while self.batch_size_content_layout.count():
            child = self.batch_size_content_layout.takeAt(0)
            if child.widget():
                child.widget().setParent(None)
                child.widget().deleteLater()
            elif child.layout():
                self.clear_layout_recursive(child.layout())
        if hasattr(self, 'batch_size_buttons'):
            self.batch_size_buttons.clear()
        QApplication.processEvents()
        layout = QVBoxLayout()
        layout.setContentsMargins(50, 50, 50, 50)
        layout.setSpacing(12)
        layout.setAlignment(Qt.AlignCenter)
        layout.addStretch(1)
        if batch_type == "keyword":
            title_text = "Keyword Search Batch Size"
            subtitle_text = "Choose how many posts to process at once for keyword searches"
            available_sizes = KEYWORD_BATCH_SIZES
            current_size = self.keyword_batch_size
            recommendation = "Recommended: 10 (good balance of speed and memory usage)"
        elif batch_type == "deepscan":
            title_text = "DeepScan Batch Size"
            subtitle_text = "Choose how many posts to process at once for deep scanning"
            available_sizes = DEEPSCAN_BATCH_SIZES
            current_size = self.deepscan_batch_size
            recommendation = "Recommended: 25 (optimal for thorough analysis)"
        else:
            title_text = "Combined Batch Sizes"
            subtitle_text = "Configure batch sizes for both keyword search and deep scanning"
            available_sizes = None
            current_size = None
            recommendation = "Keyword recommended: 10 | DeepScan recommended: 25"
        title_label = QLabel(title_text)
        title_label.setObjectName("SectionTitle")
        title_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(title_label)
        subtitle_label = QLabel(subtitle_text)
        subtitle_label.setAlignment(Qt.AlignCenter)
        subtitle_label.setObjectName("Muted")
        layout.addWidget(subtitle_label)
        layout.addSpacing(-8)
        if batch_type == "both":
            self.setup_both_batch_size_content(layout)
        else:
            self.setup_single_batch_size_content(layout, batch_type, available_sizes, current_size)
        disclaimer_label = QLabel(f"{recommendation}\nHigher batch sizes may increase memory usage.")
        disclaimer_label.setAlignment(Qt.AlignCenter)
        disclaimer_label.setStyleSheet("color: #6b7280; font-size: 11px;")
        disclaimer_label.setWordWrap(True)
        layout.addWidget(disclaimer_label)
        layout.addStretch(1)
        self.batch_size_content_layout.addLayout(layout)

    def setup_single_batch_size_content(self, layout, batch_type, available_sizes, current_size):
        content_layout = QVBoxLayout()
        content_layout.setSpacing(8)
        content_layout.setAlignment(Qt.AlignCenter)
        instruction_label = QLabel("Select your preferred batch size:")
        instruction_label.setAlignment(Qt.AlignCenter)
        instruction_label.setObjectName("Muted")
        content_layout.addWidget(instruction_label)
        sizes_widget = QWidget()
        sizes_layout = QHBoxLayout(sizes_widget)
        sizes_layout.setContentsMargins(0, 0, 0, 0)
        sizes_layout.setSpacing(10)
        sizes_layout.setAlignment(Qt.AlignCenter)
        self.batch_size_buttons = []
        self.selected_batch_size = None
        for size in available_sizes:
            size_btn = QPushButton(str(size))
            size_btn.setObjectName("PresetButton")
            size_btn.setCheckable(True)
            size_btn.setMinimumWidth(60)
            size_btn.setFixedHeight(44)
            size_btn.setStyleSheet("""
                QPushButton {
                    text-align: center;
                    font-weight: bold;
                    font-size: 14px;
                }
            """)
            if size == current_size:
                size_btn.setChecked(True)
                self.selected_batch_size = size
            size_btn.clicked.connect(lambda checked, s=size: self.select_batch_size(s))
            self.batch_size_buttons.append(size_btn)
            sizes_layout.addWidget(size_btn)
        content_layout.addWidget(sizes_widget)
        self.batch_confirm_btn = QPushButton("✨ Start Scraping")
        self.batch_confirm_btn.setEnabled(self.selected_batch_size is not None)
        self.batch_confirm_btn.setToolTip("Please select a batch size first" if self.selected_batch_size is None else "")
        self.batch_confirm_btn.setMinimumHeight(44)
        self.batch_confirm_btn.setMaximumWidth(400)
        self.batch_confirm_btn.clicked.connect(lambda: self.confirm_batch_size_and_start(batch_type))
        self.update_batch_confirm_button()
        content_layout.addSpacing(6)
        content_layout.addWidget(self.batch_confirm_btn, alignment=Qt.AlignCenter)
        layout.addLayout(content_layout)

    def setup_both_batch_size_content(self, layout):
        content_layout = QVBoxLayout()
        content_layout.setSpacing(16)
        content_layout.setAlignment(Qt.AlignCenter)
        keyword_section = QVBoxLayout()
        keyword_title = QLabel("Keyword Search Batch Size:")
        keyword_title.setObjectName("Muted")
        keyword_title.setAlignment(Qt.AlignCenter)
        keyword_section.addWidget(keyword_title)
        keyword_sizes_widget = QWidget()
        keyword_sizes_layout = QHBoxLayout(keyword_sizes_widget)
        keyword_sizes_layout.setContentsMargins(0, 0, 0, 0)
        keyword_sizes_layout.setSpacing(10)
        keyword_sizes_layout.setAlignment(Qt.AlignCenter)
        self.keyword_batch_buttons = []
        for size in KEYWORD_BATCH_SIZES:
            size_btn = QPushButton(str(size))
            size_btn.setObjectName("PresetButton")
            size_btn.setCheckable(True)
            size_btn.setMinimumWidth(60)
            size_btn.setFixedHeight(44)
            size_btn.setStyleSheet("""
                QPushButton {
                    text-align: center;
                    font-weight: bold;
                    font-size: 14px;
                }
            """)
            if size == self.keyword_batch_size:
                size_btn.setChecked(True)
            size_btn.clicked.connect(lambda checked, s=size: self.select_keyword_batch_size(s))
            self.keyword_batch_buttons.append(size_btn)
            keyword_sizes_layout.addWidget(size_btn)
        keyword_section.addWidget(keyword_sizes_widget)
        deepscan_section = QVBoxLayout()
        deepscan_title = QLabel("DeepScan Batch Size:")
        deepscan_title.setObjectName("Muted")
        deepscan_title.setAlignment(Qt.AlignCenter)
        deepscan_section.addWidget(deepscan_title)
        deepscan_sizes_widget = QWidget()
        deepscan_sizes_layout = QHBoxLayout(deepscan_sizes_widget)
        deepscan_sizes_layout.setContentsMargins(0, 0, 0, 0)
        deepscan_sizes_layout.setSpacing(10)
        deepscan_sizes_layout.setAlignment(Qt.AlignCenter)
        self.deepscan_batch_buttons = []
        for size in DEEPSCAN_BATCH_SIZES:
            size_btn = QPushButton(str(size))
            size_btn.setObjectName("PresetButton")
            size_btn.setCheckable(True)
            size_btn.setMinimumWidth(60)
            size_btn.setFixedHeight(44)
            size_btn.setStyleSheet("""
                QPushButton {
                    text-align: center;
                    font-weight: bold;
                    font-size: 14px;
                }
            """)
            if size == self.deepscan_batch_size:
                size_btn.setChecked(True)
            size_btn.clicked.connect(lambda checked, s=size: self.select_deepscan_batch_size(s))
            self.deepscan_batch_buttons.append(size_btn)
            deepscan_sizes_layout.addWidget(size_btn)
        deepscan_section.addWidget(deepscan_sizes_widget)
        content_layout.addLayout(keyword_section)
        content_layout.addLayout(deepscan_section)
        self.batch_confirm_btn = QPushButton("✨ Start Scraping")
        self.batch_confirm_btn.setEnabled(True)
        self.batch_confirm_btn.setMinimumHeight(44)
        self.batch_confirm_btn.setMaximumWidth(300)
        self.batch_confirm_btn.clicked.connect(lambda: self.confirm_batch_size_and_start("both"))
        self.batch_confirm_btn.setStyleSheet("""
            QPushButton {
                background-color: #1d3b2a;
                border: 1px solid #23533a;
                color: #c6f6d5;
            }
            QPushButton:hover { background-color: #204330; border-color: #2a6a48; }
            QPushButton:pressed { background-color: #193324; }
        """)
        content_layout.addWidget(self.batch_confirm_btn, alignment=Qt.AlignCenter)
        layout.addLayout(content_layout)

    def select_batch_size(self, size):
        try:
            for btn in self.batch_size_buttons:
                if btn.text() != str(size):
                    btn.setChecked(False)
            self.selected_batch_size = size
            self.update_batch_confirm_button()
            log_error(f"Batch size selected: {size}")
        except Exception as e:
            log_error(f"Error selecting batch size: {e}")

    def select_keyword_batch_size(self, size):
        try:
            for btn in self.keyword_batch_buttons:
                if btn.text() != str(size):
                    btn.setChecked(False)
            self.keyword_batch_size = size
            log_error(f"Keyword batch size selected: {size}")
        except Exception as e:
            log_error(f"Error selecting keyword batch size: {e}")

    def select_deepscan_batch_size(self, size):
        try:
            for btn in self.deepscan_batch_buttons:
                if btn.text() != str(size):
                    btn.setChecked(False)
            self.deepscan_batch_size = size
            log_error(f"DeepScan batch size selected: {size}")
        except Exception as e:
            log_error(f"Error selecting deepscan batch size: {e}")

    def update_batch_confirm_button(self):
        try:
            if self.selected_batch_size is not None:
                self.batch_confirm_btn.setEnabled(True)
                self.batch_confirm_btn.setToolTip("")
                self.batch_confirm_btn.setStyleSheet("""
                    QPushButton {
                        background-color: #1d3b2a;
                        border: 1px solid #23533a;
                        color: #c6f6d5;
                    }
                    QPushButton:hover { background-color: #204330; border-color: #2a6a48; }
                    QPushButton:pressed { background-color: #193324; }
                """)
            else:
                self.batch_confirm_btn.setEnabled(False)
                self.batch_confirm_btn.setToolTip("Please select a batch size first")
                self.batch_confirm_btn.setStyleSheet("""
                    QPushButton:disabled {
                        background-color: #11151d;
                        color: #717a8c;
                        border-color: #1a2030;
                    }
                """)
        except Exception as e:
            log_error(f"Error updating batch confirm button: {e}")

    def confirm_batch_size_and_start(self, batch_type):
        try:
            if batch_type == "keyword":
                self.keyword_batch_size = self.selected_batch_size
            elif batch_type == "deepscan":
                self.deepscan_batch_size = self.selected_batch_size
            log_error(f"Batch sizes confirmed - Keyword: {self.keyword_batch_size}, DeepScan: {self.deepscan_batch_size}")
            self.start_scraping()
        except Exception as e:
            log_error(f"Error confirming batch size and starting: {e}")

    def populate_preset_selection(self):
        try:
            while self.preset_selection_layout.count():
                child = self.preset_selection_layout.takeAt(0)
                if child.widget():
                    child.widget().deleteLater()
            self.preset_selection_buttons = []
            default_btn = QPushButton("🏠 Default Configuration")
            default_btn.setObjectName("PresetButton")
            default_btn.setCheckable(True)
            default_btn.setMinimumHeight(50)
            default_btn.setFixedWidth(1250)
            default_btn.clicked.connect(lambda: self.select_preset_option("default"))
            if self.scrape_mode == "keyword":
                preview_text = f"Uses {len(BROAD_SUBREDDITS)} broad subreddits: " + ", ".join(BROAD_SUBREDDITS[:5])
                if len(BROAD_SUBREDDITS) > 5:
                    preview_text += f" (+{len(BROAD_SUBREDDITS) - 5} more)"
            elif self.scrape_mode == "deepscan":
                preview_text = f"Uses {len(CONCENTRATED_SUBREDDITS)} concentrated subreddits: " + ", ".join(CONCENTRATED_SUBREDDITS[:5])
                if len(CONCENTRATED_SUBREDDITS) > 5:
                    preview_text += f" (+{len(CONCENTRATED_SUBREDDITS) - 5} more)"
            else:
                broad_count = len(BROAD_SUBREDDITS)
                concentrated_count = len(CONCENTRATED_SUBREDDITS)
                preview_text = (f"Uses {broad_count} subreddits for keyword search\n"
                            f"and {concentrated_count} for deepscan")
            default_btn.setText(f"🏠 Default Configuration\n{preview_text}")
            default_btn.setStyleSheet("""
                QPushButton {
                    text-align: left;
                    padding: 12px 16px;
                    font-size: 12px;
                }
            """)
            self.preset_selection_layout.addWidget(default_btn, alignment=Qt.AlignCenter)
            self.preset_selection_buttons.append(("default", default_btn))
            for i in range(1, 6):
                preset_btn = QPushButton()
                preset_btn.setObjectName("PresetButton")
                preset_btn.setCheckable(True)
                preset_btn.setMinimumHeight(50)
                preset_btn.setFixedWidth(1250)
                preset_btn.clicked.connect(lambda checked, num=i: self.select_preset_option(f"preset_{num}"))
                has_data = False
                preview_text = ""
                if self.scrape_mode == "keyword":
                    broad_data = self.preset_manager.get_preset("broad", i)
                    if broad_data:
                        has_data = True
                        preview_text = f"📝 Preset {i}\n{len(broad_data)} subreddits: " + ", ".join(broad_data[:5])
                        if len(broad_data) > 5:
                            preview_text += f" (+{len(broad_data) - 5} more)"
                elif self.scrape_mode == "deepscan":
                    concentrated_data = self.preset_manager.get_preset("concentrated", i)
                    if concentrated_data:
                        has_data = True
                        preview_text = f"📝 Preset {i}\n{len(concentrated_data)} subreddits: " + ", ".join(concentrated_data[:5])
                        if len(concentrated_data) > 5:
                            preview_text += f" (+{len(concentrated_data) - 5} more)"
                else:
                    broad_data = self.preset_manager.get_preset("broad", i)
                    concentrated_data = self.preset_manager.get_preset("concentrated", i)
                    if broad_data or concentrated_data:
                        has_data = True
                        broad_count = len(broad_data) if broad_data else 0
                        concentrated_count = len(concentrated_data) if concentrated_data else 0
                        preview_text = (f"📝 Preset {i}\n"
                                    f"Keyword Search: {broad_count} subreddits\n"
                                    f"DeepScan: {concentrated_count} subreddits")
                if has_data:
                    preset_btn.setText(preview_text)
                    preset_btn.setEnabled(True)
                else:
                    preset_btn.setText(f"📝 Preset {i}\n(No data saved)")
                    preset_btn.setEnabled(False)
                    preset_btn.setToolTip("No data in this preset")
                preset_btn.setStyleSheet("""
                    QPushButton {
                        text-align: left;
                        padding: 12px 16px;
                        font-size: 12px;
                    }
                    QPushButton:disabled {
                        color: #717a8c;
                    }
                """)
                self.preset_selection_layout.addWidget(preset_btn, alignment=Qt.AlignCenter)
                self.preset_selection_buttons.append((f"preset_{i}", preset_btn))
            log_error(f"Preset selection populated for {self.scrape_mode} mode")
        except Exception as e:
            log_error(f"Error populating preset selection: {e}")

    def select_preset_option(self, option_type):
        try:
            for _, btn in self.preset_selection_buttons:
                if btn != self.sender():
                    btn.setChecked(False)
            self.selected_preset = option_type
            self.preset_confirm_btn.setEnabled(True)
            self.preset_confirm_btn.setToolTip("")
            self.preset_confirm_btn.setStyleSheet("""
                QPushButton {
                    background-color: #1d3b2a;
                    border: 1px solid #23533a;
                    color: #c6f6d5;
                }
                QPushButton:hover { background-color: #204330; border-color: #2a6a48; }
                QPushButton:pressed { background-color: #193324; }
            """)
            log_error(f"Preset selected: {option_type}")
        except Exception as e:
            log_error(f"Error selecting preset option: {e}")

    def confirm_preset_selection(self):
        if not self.selected_preset:
            try:
                QMessageBox.warning(self, "No Preset Selected", "Please select a preset first.")
            except Exception as e:
                log_error(f"Failed to show preset selection warning: {e}")
            return
        try:
            if self.selected_preset == "default":
                self.current_broad_subreddits = BROAD_SUBREDDITS[:]
                self.current_concentrated_subreddits = CONCENTRATED_SUBREDDITS[:]
            else:
                preset_num = int(self.selected_preset.split("_")[1])
                if self.scrape_mode == "keyword":
                    broad_data = self.preset_manager.get_preset("broad", preset_num)
                    self.current_broad_subreddits = broad_data if broad_data else BROAD_SUBREDDITS[:]
                    self.current_concentrated_subreddits = CONCENTRATED_SUBREDDITS[:]
                elif self.scrape_mode == "deepscan":
                    concentrated_data = self.preset_manager.get_preset("concentrated", preset_num)
                    self.current_broad_subreddits = BROAD_SUBREDDITS[:]
                    self.current_concentrated_subreddits = concentrated_data if concentrated_data else CONCENTRATED_SUBREDDITS[:]
                else:
                    broad_data = self.preset_manager.get_preset("broad", preset_num)
                    concentrated_data = self.preset_manager.get_preset("concentrated", preset_num)
                    self.current_broad_subreddits = broad_data if broad_data else BROAD_SUBREDDITS[:]
                    self.current_concentrated_subreddits = concentrated_data if concentrated_data else CONCENTRATED_SUBREDDITS[:]
            log_error(f"DEBUG: scrape_mode='{self.scrape_mode}', going to {'keywords' if self.scrape_mode in ['keyword', 'both'] else 'batch size'}")
            if self.scrape_mode in ["keyword", "both"]:
                self.stack.setCurrentIndex(self.CUSTOM_KEYWORDS_SCREEN)
            else: 
                self.show_confirmation()
        except Exception as e:
            error_msg = f"Failed to load preset: {str(e)}"
            log_error(error_msg)
            try:
                QMessageBox.critical(self, "Preset Load Error", error_msg)
            except Exception as msg_error:
                log_error(f"Failed to show preset error message: {msg_error}")

    def set_run_mode(self, mode):
        self.run_mode = mode
        self.stack.setCurrentIndex(self.SCRAPE_MODE_SCREEN)

    def set_scrape_mode(self, mode):
        self.scrape_mode = mode
        self.populate_preset_selection()
        self.stack.setCurrentIndex(self.PRESET_SELECT_SCREEN)

    def fetch_keywords(self):
        if hasattr(self, 'keyword_thread') and self.keyword_thread.isRunning():
            self.keyword_thread.stop()
            self.keyword_thread.wait()
        self.clear_keywords()
        self.keyword_label.setText("🔄 Fetching trending keywords...\nPlease wait, this may take a moment.")
        self.keyword_label.setStyleSheet("color: #4f8cff;")
        self.btn_confirm_keywords.setEnabled(False)
        self.btn_confirm_keywords.setToolTip("Waiting for keywords to load...")
        self.btn_confirm_keywords.setStyleSheet("""
            QPushButton:disabled {
                background-color: #2d3748;
                color: #718096;
                border-color: #2d3748;
            }
        """)
        self.btn_retry.setVisible(False)
        custom_text = self.custom_keyword_input.toPlainText().strip()
        base_keywords = [kw.strip().lower() for kw in custom_text.split(',') if kw.strip()] or ["politics"]
        self.keyword_thread = KeywordFetchThread(base_keywords)
        self.keyword_thread.keywords_fetched.connect(self.on_keywords_fetched)
        self.keyword_thread.error_occurred.connect(self.on_keyword_fetch_error)
        self.keyword_thread.retry_countdown.connect(self.update_retry_countdown)
        self.keyword_thread.fetch_failed.connect(self.on_keyword_fetch_failed)
        self.keyword_thread.start()

    def on_keyword_fetch_failed(self, error):
        error_msg = f"Keyword fetch failed: {error}"
        log_error(error_msg)
        self.keyword_label.setText(
            f"❌ Failed to fetch trending keywords\n"
            f"Google Trends may be temporarily unavailable\n\n"
            f"Last error: {error.split(':')[-1].strip()}"
        )
        self.keyword_label.setStyleSheet("color: #ef4444;")
        self.btn_confirm_keywords.setEnabled(False)
        self.btn_confirm_keywords.setStyleSheet("""
            QPushButton:disabled {
                background-color: #2d3748;
                color: #718096;
                border-color: #2d3748;
            }
        """)
        self.btn_confirm_keywords.setToolTip("Cannot confirm until selections are made")
        self.btn_retry.setVisible(True)

    def update_retry_countdown(self, seconds, keyword):
        self.keyword_label.setText(
            f"⚠️ Error collecting trends for '{keyword}'\n"
            f"Trying again in {seconds} seconds..."
        )
        self.keyword_label.setStyleSheet("color: #f59e0b;") 
        self.btn_confirm_keywords.setEnabled(False)
        self.btn_confirm_keywords.setStyleSheet("""
            QPushButton:disabled {
                background-color: #2d3748;
                color: #718096;
                border-color: #2d3748;
            }
        """)
        QApplication.processEvents()

    def on_keyword_fetch_error(self, error):
        error_msg = f"Keyword fetch error: {error}"
        log_error(error_msg)
        self.keyword_label.setText(
            f"⚠️ Error fetching keywords\n"
            f"Error: {error.split(':')[-1].strip()}"
        )
        self.keyword_label.setStyleSheet("color: #ef4444;") 
        self.btn_confirm_keywords.setEnabled(False)
        self.btn_confirm_keywords.setToolTip("Cannot confirm due to fetch error")
        self.btn_retry.setVisible(True)

    def on_keywords_fetched(self, keywords):
        if hasattr(self, 'btn_retry_fetch'):
            self.btn_retry_fetch.setVisible(False)
        self.keywords = [kw.lower().strip() for kw in keywords if kw.strip()]
        if not self.keywords: 
            self.on_keyword_fetch_failed("No keywords found")
            return
        self.keyword_label.setText("✅ Keywords ready! Select which to include:")
        self.keyword_label.setStyleSheet("color: #10b981;") 
        self.btn_confirm_keywords.setVisible(True)
        self.btn_confirm_keywords.setEnabled(True)
        self.btn_confirm_keywords.setStyleSheet("""
            QPushButton {
                background-color: #1d3b2a;
                border: 1px solid #23533a;
                color: #c6f6d5;
            }
            QPushButton:hover { background-color: #204330; border-color: #2a6a48; }
            QPushButton:pressed { background-color: #193324; }
        """)
        self.btn_confirm_keywords.setToolTip("")
        self.build_keyword_checkboxes()

    def clear_keywords(self):
        while self.keyword_grid.count():
            child = self.keyword_grid.takeAt(0)
            if child.widget():
                child.widget().deleteLater()

    def build_keyword_checkboxes(self):
        self.checkbox_vars = []
        max_columns = 3
        for i, kw in enumerate(self.keywords):
            checkbox = QCheckBox(kw)
            checkbox.setChecked(True)
            row = i // max_columns
            col = i % max_columns
            self.keyword_grid.addWidget(checkbox, row, col, Qt.AlignLeft)
            self.checkbox_vars.append(checkbox)

    def select_all_keywords(self):
        if hasattr(self, 'checkbox_vars') and self.checkbox_vars:
            for checkbox in self.checkbox_vars:
                checkbox.setChecked(True)

    def deselect_all_keywords(self):
        if hasattr(self, 'checkbox_vars') and self.checkbox_vars:
            for checkbox in self.checkbox_vars:
                checkbox.setChecked(False)

    def confirm_keywords(self):
        self.selected_keywords = [cb.text() for cb in self.checkbox_vars if cb.isChecked()]
        if not self.selected_keywords:
            try:
                QMessageBox.warning(self, "No Keywords Selected", "Please select at least one keyword.")
            except Exception as e:
                log_error(f"Failed to show keyword warning: {e}")
            return
        try:
            self.show_confirmation()
        except Exception as e:
            log_error(f"Error transitioning to batch size screen: {e}")
            self.show_confirmation()

    def show_confirmation(self):
        try:
            mode_icons = {"once": "🔄", "infinite": "♾️"}
            scrape_icons = {"keyword": "🔍", "deepscan": "🔬", "both": "⚡"}
            info_lines = []
            info_lines.append(f"Run Mode: {mode_icons.get(self.run_mode, '')} {self.run_mode.title()}")
            info_lines.append(f"Scrape Mode: {scrape_icons.get(self.scrape_mode, '')} {self.scrape_mode.title()}")
            if self.selected_preset == "default":
                preset_info = "🏠 Default"
            else:
                preset_num = self.selected_preset.split("_")[1]
                preset_info = f"📝 {preset_num}"
            info_lines.append(f"Preset: {preset_info}")
            if self.scrape_mode in ["keyword", "both"]:
                if len(self.selected_keywords) <= 3:
                    keyword_display = ", ".join(self.selected_keywords)
                else:
                    keyword_display = ", ".join(self.selected_keywords[:3])
                    remaining = len(self.selected_keywords) - 3
                    keyword_display += f" (+{remaining} more)"
                info_lines.append(f"Keywords: {keyword_display}")
            else:
                info_lines.append("Keywords: (none needed for DeepScan)")
            if self.scrape_mode == "keyword":
                info_lines.append(f"Batch Size: {self.keyword_batch_size}")
            elif self.scrape_mode == "deepscan":
                info_lines.append(f"Batch Size: {self.deepscan_batch_size}")
            else:
                info_lines.append(f"Keyword Batch: {self.keyword_batch_size}")
                info_lines.append(f"DeepScan Batch: {self.deepscan_batch_size}")
            self.confirm_label.setText("\n".join(info_lines))
            self.stack.setCurrentIndex(self.CONFIRMATION_SCREEN)
            log_error(f"Configuration confirmed: {self.scrape_mode} mode with batches K:{self.keyword_batch_size} D:{self.deepscan_batch_size}")
        except Exception as e:
            log_error(f"Error showing confirmation: {e}")

    def go_to_batch_size_config(self):
        try:
            log_error(f"DEBUG: BATCH_SIZE_SCREEN index = {self.BATCH_SIZE_SCREEN}")
            log_error(f"DEBUG: Total screens in stack = {self.stack.count()}")
            self.came_from_confirmation = True
            self.setup_batch_size_for_type(self.scrape_mode)
            self.stack.setCurrentIndex(self.BATCH_SIZE_SCREEN)
        except Exception as e:
            log_error(f"Error navigating to batch size config: {e}")

    def handle_batch_size_back(self):
        try:
            if getattr(self, 'came_from_confirmation', False):
                self.came_from_confirmation = False 
                self.stack.setCurrentIndex(self.CONFIRMATION_SCREEN)
            else:
                self.stack.setCurrentIndex(self.PRESET_SELECT_SCREEN)
            log_error("Handled batch size back navigation")
        except Exception as e:
            log_error(f"Error handling batch size back: {e}")

    def start_scraping(self):
        try:
            if self.scraper_thread and self.scraper_thread.isRunning():
                try:
                    QMessageBox.warning(self, "Scraper Running", "Scraper is already running!")
                except Exception as e:
                    log_error(f"Failed to show scraper running warning: {e}")
                return
            self.log_output.clear()
            self.header_label.setText("")
            show_keyword_bar = self.scrape_mode in ["keyword", "both"]
            self.keyword_bar.setVisible(show_keyword_bar)
            self.keyword_label_progress.setVisible(show_keyword_bar)
            self.keyword_bar.setMaximum(1); self.keyword_bar.setValue(0); self.keyword_bar.setFormat("0/0")
            self.post_bar.setMaximum(1); self.post_bar.setValue(0); self.post_bar.setFormat("0/0")
            self.subreddit_bar.setMaximum(1); self.subreddit_bar.setValue(0); self.subreddit_bar.setFormat("0/0")
            try:
                self.action_button.clicked.disconnect()
            except Exception:
                pass
            self.action_button.setText("🛑 Stop Scraping")
            self.action_button.setEnabled(True)
            self.action_button.setStyleSheet("""
                QPushButton {
                    background-color: #3a1114;
                    border: 1px solid #5a1c21;
                    color: #ffd4d6;
                }
                QPushButton:hover { background-color: #471519; border-color: #6d242a; }
                QPushButton:pressed { background-color: #2c0c0f; }
                QPushButton:disabled {
                    background-color: #11151d;
                    color: #717a8c;
                    border-color: #1a2030;
                }
            """)
            self.action_button.clicked.connect(self.stop_scraping)
            run_infinite = self.run_mode == "infinite"
            self.scraper_thread = ScraperThread(
                run_infinite, self.scrape_mode, 
                self.selected_keywords, supabase, self.reddit,
                self.current_broad_subreddits, self.current_concentrated_subreddits,
                self.keyword_batch_size, self.deepscan_batch_size
            )
            self.scraper_thread.clear_log_signal.connect(self.log_output.clear)
            self.scraper_thread.header_signal.connect(self.header_label.setText)
            self.scraper_thread.log_signal.connect(self.append_log)
            self.scraper_thread.post_progress_signal.connect(self.update_post_progress)
            self.scraper_thread.subreddit_progress_signal.connect(self.update_subreddit_progress)
            self.scraper_thread.keyword_progress_signal.connect(self.update_keyword_progress)
            self.scraper_thread.finished_signal.connect(self.scraping_finished)
            self.scraper_thread.start()
            self.stack.setCurrentIndex(self.SCRAPING_STATUS_SCREEN)
            
        except Exception as e:
            log_error(f"Error starting scraping: {str(e)}\n{traceback.format_exc()}")
            try:
                QMessageBox.critical(self, "Error", f"Failed to start scraping: {str(e)}")
            except Exception as msg_error:
                log_error(f"Failed to show scraping start error: {msg_error}")
    
    def update_scrape_method(self, method_name):
        mode_text = f"Cycle Mode: {'Infinite' if self.run_mode == 'infinite' else 'Single'} | Scrape Method: {method_name}"
        self.mode_label.setText(mode_text)

    def update_keyword_progress(self, current, total):
        if not self.keyword_bar.isVisible():
            return
        if total <= 0:
            return
        safe_total = max(total, 1)
        safe_current = max(0, min(current, safe_total))
        self.keyword_bar.setMaximum(safe_total)
        self.keyword_bar.setValue(safe_current)
        self.keyword_bar.setFormat(f"{current}/{total}")

    def update_post_progress(self, current, total):
        safe_total = max(total, 1)
        safe_current = max(0, min(current, safe_total))
        self.post_bar.setMaximum(safe_total)
        self.post_bar.setValue(safe_current)
        self.post_bar.setFormat(f"{current}/{total}")

    def update_subreddit_progress(self, current, total):
        safe_total = max(total, 1)
        safe_current = max(0, min(current, safe_total))
        self.subreddit_bar.setMaximum(safe_total)
        self.subreddit_bar.setValue(safe_current)
        self.subreddit_bar.setFormat(f"{current}/{total}")

    def append_log(self, text):
        if text is None:
            return
        if "<" in text and ">" in text:
            self.log_output.append(text)
        else:
            self.log_output.append(html_lib.escape(text))
        if self.log_output.document().blockCount() > 1000:
            cursor = self.log_output.textCursor()
            cursor.movePosition(cursor.Start)
            cursor.movePosition(cursor.Down, cursor.KeepAnchor, 100)
            cursor.removeSelectedText()
        self.log_output.ensureCursorVisible()
        QApplication.processEvents()

    def scraping_finished(self):
        try:
            self.action_button.clicked.disconnect()
        except Exception:
            pass
        self.action_button.setText("🔄 Restart")
        self.action_button.setEnabled(True)
        self.action_button.setStyleSheet("""
            QPushButton {
                background-color: #1d3b2a;
                border: 1px solid #23533a;
                color: #c6f6d5;
            }
            QPushButton:hover { background-color: #204330; border-color: #2a6a48; }
            QPushButton:pressed { background-color: #193324; }
        """)
        self.action_button.clicked.connect(self.restart_view)

    def stop_scraping(self):
        if hasattr(self, 'keyword_thread') and self.keyword_thread.isRunning():
            self.keyword_thread.stop()
            self.keyword_thread.wait()
        
        if self.scraper_thread and self.scraper_thread.isRunning():
            self.action_button.setEnabled(False)
            self.action_button.setText("⏳ Stopping...")
            self.append_log("-" * 60)
            self.append_log("🛑 Stop requested by user. Finishing current task...")
            self.append_log("⏳ Please wait - do not close the application or click stop again.")
            self.scraper_thread.stop()
        else:
            self.append_log("❌ No active scraper to stop.")
            log_error("Stop requested but no active scraper thread")

    def restart_view(self):
        self.header_label.setText("")
        self.log_output.clear()
        self.keyword_bar.setMaximum(1); self.keyword_bar.setValue(0); self.keyword_bar.setFormat("0/0")
        self.post_bar.setMaximum(1); self.post_bar.setValue(0); self.post_bar.setFormat("0/0")
        self.subreddit_bar.setMaximum(1); self.subreddit_bar.setValue(0); self.subreddit_bar.setFormat("0/0")
        try:
            self.action_button.clicked.disconnect()
        except Exception:
            pass
        self.action_button.setText("🛑 Stop Scraping")
        self.action_button.setStyleSheet("""
            QPushButton {
                background-color: #3a1114;
                border: 1px solid #5a1c21;
                color: #ffd4d6;
            }
            QPushButton:hover { background-color: #471519; border-color: #6d242a; }
            QPushButton:pressed { background-color: #2c0c0f; }
            QPushButton:disabled {
                background-color: #11151d;
                color: #717a8c;
                border-color: #1a2030;
            }
        """)
        self.action_button.clicked.connect(self.stop_scraping)
        self.stack.setCurrentIndex(self.RUN_MODE_SCREEN)

    def setup_custom_keywords_screen(self):
        widget = QWidget()
        outer_layout = QVBoxLayout()
        outer_layout.setContentsMargins(12, 12, 12, 12)
        topbar = QHBoxLayout()
        btn_back = QPushButton("← Back")
        btn_back.setFixedHeight(40)
        btn_back.clicked.connect(lambda: self.stack.setCurrentIndex(self.PRESET_SELECT_SCREEN)) 
        topbar.addWidget(btn_back, 0, Qt.AlignLeft)
        topbar.addStretch()
        outer_layout.addLayout(topbar)
        layout = QVBoxLayout()
        layout.setContentsMargins(50, 50, 50, 50)
        layout.setSpacing(24)
        layout.addStretch(1)  
        content_layout = QVBoxLayout()
        content_layout.setSpacing(10)    
        instruction_label = QLabel("Configure Base Keywords")
        instruction_label.setAlignment(Qt.AlignCenter)
        instruction_label.setObjectName("SectionTitle")
        content_layout.addWidget(instruction_label)    
        info_container = QVBoxLayout()
        info_container.setSpacing(4)  
        info_label = QLabel("Enter keywords separated by commas.\nThese will be used to find trending related keywords via Google Trends.")
        info_label.setAlignment(Qt.AlignCenter)
        info_label.setObjectName("Muted")
        info_container.addWidget(info_label)
        self.keyword_error_label = QLabel()
        self.keyword_error_label.setAlignment(Qt.AlignCenter)
        self.keyword_error_label.setObjectName("Muted")
        self.keyword_error_label.setStyleSheet("color: #ef4444; font-size: 11px;")
        self.keyword_error_label.setVisible(False)
        info_container.addWidget(self.keyword_error_label)
        content_layout.addLayout(info_container)
        self.custom_keyword_input = QTextEdit()
        self.custom_keyword_input.setFixedHeight(100)
        self.custom_keyword_input.setPlainText("politics")
        self.custom_keyword_input.setPlaceholderText("Enter keywords separated by commas (e.g. politics, election, democracy)")
        self.custom_keyword_input.setStyleSheet("""
            QTextEdit {
                background-color: #0f131c;
                border: 1px solid #232a3a;
                border-radius: 10px;
                padding: 10px 12px;
                font-family: "Consolas", "Monaco", monospace;
                color: #e5e7eb;
            }
            QTextEdit:focus { border-color: #4f8cff; }
        """)
        content_layout.addWidget(self.custom_keyword_input)
        self.btn_continue_with_keywords = QPushButton("🔄 Fetch Related Keywords")
        self.btn_continue_with_keywords.clicked.connect(self.continue_with_custom_keywords)
        self.btn_continue_with_keywords.setMinimumHeight(44)
        content_layout.addWidget(self.btn_continue_with_keywords)
        layout.addLayout(content_layout)
        layout.addStretch(1)
        outer_layout.addLayout(layout)
        widget.setLayout(outer_layout)
        self.stack.addWidget(widget)

    def continue_with_custom_keywords(self):
        custom_text = self.custom_keyword_input.toPlainText().strip()
        self.custom_keyword_input.setStyleSheet("""
            QTextEdit {
                background-color: #0f131c;
                border: 1px solid #232a3a;
                border-radius: 10px;
                padding: 10px 12px;
            }
        """)
        self.keyword_error_label.setVisible(False)
        if not custom_text:
            self.show_keyword_error("Please enter at least one base keyword")
            return
        keywords = [kw.strip() for kw in custom_text.split(',') if kw.strip()]
        for kw in keywords:
            if not all(c.isalnum() or c.isspace() or c in "-_&" for c in kw):
                self.show_keyword_error(
                    "Only letters, numbers, spaces, hyphens ( - ), underscores ( _ ), and ampersands ( & ) allowed"
                )
                return
        self.fetch_keywords()
        self.stack.setCurrentIndex(self.KEYWORD_SELECT_SCREEN)

    def show_keyword_error(self, message):
        self.custom_keyword_input.setStyleSheet("""
            QTextEdit {
                background-color: #0f131c;
                border: 1px solid #ef4444;
                border-radius: 10px;
                padding: 10px 12px;
            }
        """)
        self.keyword_error_label.setText(message)
        self.keyword_error_label.setVisible(True)
        log_error(f"Keyword input error: {message}")

    def setup_keyword_select_screen(self):
        widget = QWidget()
        outer_layout = QVBoxLayout()
        outer_layout.setContentsMargins(12, 12, 12, 12)
        topbar = QHBoxLayout()
        btn_back = QPushButton("← Back")
        btn_back.setFixedHeight(40)
        btn_back.clicked.connect(lambda: self.stack.setCurrentIndex(self.CUSTOM_KEYWORDS_SCREEN))
        topbar.addWidget(btn_back, 0, Qt.AlignLeft)
        topbar.addStretch()
        outer_layout.addLayout(topbar)
        layout = QVBoxLayout()
        layout.setContentsMargins(30, 20, 30, 50)
        layout.setSpacing(16)
        title_label = QLabel("Select Keywords")
        title_label.setAlignment(Qt.AlignCenter)
        title_label.setObjectName("SectionTitle")
        layout.addWidget(title_label)
        self.keyword_label = QLabel()
        self.keyword_label.setAlignment(Qt.AlignCenter)
        self.keyword_label.setWordWrap(True)
        layout.addWidget(self.keyword_label)
        keyword_frame = QFrame()
        keyword_frame.setStyleSheet("""
            QFrame {
                background-color: #0f131c;
                border: 1px solid #232a3a;
                border-radius: 12px;
                padding: 15px;
            }
        """)
        keyword_frame_layout = QVBoxLayout(keyword_frame)
        keyword_frame_layout.setContentsMargins(0, 0, 0, 0)
        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.scroll.setStyleSheet("background: transparent; border: none;")
        self.keyword_container = QWidget()
        self.keyword_container.setStyleSheet("background: transparent;")
        self.keyword_grid = QGridLayout()
        self.keyword_grid.setSpacing(10)
        self.keyword_grid.setContentsMargins(10, 10, 10, 10)
        self.keyword_container.setLayout(self.keyword_grid)
        self.scroll.setWidget(self.keyword_container)
        keyword_frame_layout.addWidget(self.scroll)
        layout.addWidget(keyword_frame, 1)
        button_row = QHBoxLayout()
        button_row.setSpacing(10)
        self.btn_select_all = QPushButton("✅ Select All")
        self.btn_deselect_all = QPushButton("❌ Deselect All")
        self.btn_select_all.clicked.connect(self.select_all_keywords)
        self.btn_deselect_all.clicked.connect(self.deselect_all_keywords)
        button_row.addWidget(self.btn_select_all)
        button_row.addWidget(self.btn_deselect_all)
        layout.addLayout(button_row)
        self.btn_retry = QPushButton("🔄 Try Again Now")
        self.btn_retry.setMinimumHeight(44)
        self.btn_retry.setStyleSheet("""
            QPushButton {
                background-color: #3a1114;
                border: 1px solid #5a1c21;
                color: #ffd4d6;
            }
            QPushButton:hover { background-color: #471519; }
        """)

        def safe_retry():
            self.keyword_label.setText("🔄 Fetching trending keywords...\nPlease wait, this may take a moment.")
            self.keyword_label.setStyleSheet("color: #4f8cff;")
            self.btn_retry.setVisible(False)
            self.fetch_keywords()
        self.btn_retry.clicked.connect(safe_retry)
        self.btn_retry.setVisible(False)
        layout.addWidget(self.btn_retry)
        self.btn_confirm_keywords = QPushButton("✨ Confirm Selection")
        self.btn_confirm_keywords.setMinimumHeight(44)
        self.btn_confirm_keywords.clicked.connect(self.confirm_keywords)
        self.btn_confirm_keywords.setEnabled(False)
        self.btn_confirm_keywords.setStyleSheet("""
            QPushButton:disabled {
                background-color: #2d3748;
                color: #718096;
                border-color: #2d3748;
            }
        """)
        layout.addWidget(self.btn_confirm_keywords)
        outer_layout.addLayout(layout)
        widget.setLayout(outer_layout)
        self.stack.addWidget(widget)

    def setup_confirmation_screen(self):
        widget = QWidget()
        outer_layout = QVBoxLayout()
        outer_layout.setContentsMargins(12, 12, 12, 12)
        topbar = QHBoxLayout()
        btn_back = QPushButton("← Back")
        btn_back.setFixedHeight(40)
        def _go_back():
            if self.scrape_mode in ["keyword", "both"]:
                self.stack.setCurrentIndex(self.KEYWORD_SELECT_SCREEN) 
            else:
                self.stack.setCurrentIndex(self.PRESET_SELECT_SCREEN)  
        btn_back.clicked.connect(_go_back)
        topbar.addWidget(btn_back, 0, Qt.AlignLeft)
        topbar.addStretch()
        outer_layout.addLayout(topbar)
        layout = QVBoxLayout()
        layout.setContentsMargins(50, 50, 50, 50)
        layout.setSpacing(4)
        layout.addStretch(1)
        title_container = QVBoxLayout()
        title_container.setSpacing(4)
        title_container = self.create_title_with_logo()
        layout.addSpacing(-15)
        layout.addLayout(title_container)
        content_layout = QVBoxLayout()
        content_layout.setSpacing(12)
        instruction_label = QLabel("Confirm your configuration:")
        instruction_label.setAlignment(Qt.AlignCenter)
        instruction_label.setObjectName("Muted")
        instruction_label.setContentsMargins(0, 0, 0, 2)
        content_layout.addWidget(instruction_label)
        self.confirm_label = QLabel()
        self.confirm_label.setAlignment(Qt.AlignCenter)
        self.confirm_label.setWordWrap(True)
        self.confirm_label.setFixedWidth(300)
        self.confirm_label.adjustSize()
        self.confirm_label.setStyleSheet("""
            QLabel {
                background-color: #0f131c;
                border: 1px solid #232a3a;
                border-radius: 10px;
                padding: 6px 12px;
                font-family: "Consolas", "Monaco", monospace;
                color: #e5e7eb;
                font-size: 11px;
            }
        """)
        content_layout.addWidget(self.confirm_label, alignment=Qt.AlignHCenter)
        self.btn_configure_batch = QPushButton("⚙️ Configure Batch Size")
        self.btn_configure_batch.clicked.connect(self.go_to_batch_size_config)
        self.btn_configure_batch.setFixedWidth(300)
        self.btn_configure_batch.setFixedHeight(44)
        self.btn_configure_batch.setStyleSheet("""
            QPushButton {
                background-color: #2d1f3a;
                border: 1px solid #4a3564;
                color: #d6c7e7;
            }
            QPushButton:hover { background-color: #372849; border-color: #5d4277; }
            QPushButton:pressed { background-color: #241e2f; }
        """)
        content_layout.addWidget(self.btn_configure_batch, alignment=Qt.AlignHCenter)
        self.btn_start_scraper = QPushButton("🚀 Start Scraping")
        self.btn_start_scraper.clicked.connect(self.start_scraping)
        self.btn_start_scraper.setFixedWidth(300)
        self.btn_start_scraper.setFixedHeight(44)
        self.btn_start_scraper.setStyleSheet("""
            QPushButton {
                background-color: #1d3b2a;
                border: 1px solid #23533a;
                color: #c6f6d5;
            }
            QPushButton:hover { background-color: #204330; border-color: #2a6a48; }
            QPushButton:pressed { background-color: #193324; }
        """)
        content_layout.addWidget(self.btn_start_scraper, alignment=Qt.AlignHCenter)
        layout.addLayout(content_layout)
        layout.addStretch(1)
        outer_layout.addLayout(layout)
        widget.setLayout(outer_layout)
        self.stack.addWidget(widget)

    def setup_scraping_status_screen(self):
        widget = QWidget()
        layout = QVBoxLayout()
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(12)
        widget.setLayout(layout)
        title_label = QLabel("SupaScrapeR Progress")
        title_label.setAlignment(Qt.AlignCenter)
        title_label.setObjectName("SectionTitle")
        layout.addWidget(title_label)
        self.header_label = QLabel("")
        self.header_label.setTextFormat(Qt.RichText)
        self.header_label.setStyleSheet("""
            QLabel {
                font-size: 13px;
                font-weight: 600;
                color: #e5e7eb;
                background-color: #0f131c;
                border: 1px solid #232a3a;
                border-radius: 10px;
                padding: 10px 12px;
                margin-bottom: 6px;
            }
        """)
        layout.addWidget(self.header_label)
        self.log_output = QTextEdit()
        self.log_output.setReadOnly(True)
        self.log_output.setStyleSheet("""
            QTextEdit {
                background-color: #0b0e14;
                border: 1px solid #232a3a;
                border-radius: 12px;
                padding: 12px;
                font-family: "Consolas", "Monaco", "Courier New", monospace;
                font-size: 11px;
                line-height: 1.5;
            }
        """)
        layout.addWidget(self.log_output)
        layout.addSpacing(6)
        progress_container = QVBoxLayout()
        progress_container.setSpacing(10)
        keyword_widget = QWidget()
        keyword_widget.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
        keyword_layout = QVBoxLayout(keyword_widget)
        keyword_layout.setContentsMargins(0, 0, 0, 0)
        keyword_layout.setSpacing(4)
        self.keyword_label_progress = QLabel("Keywords Progress")
        self.keyword_label_progress.setObjectName("Muted")
        keyword_layout.addWidget(self.keyword_label_progress)
        self.keyword_bar = QProgressBar()
        self.keyword_bar.setFormat("%v/%m")
        self.keyword_bar.setTextVisible(True)
        self.keyword_bar.setMinimum(0)
        self.keyword_bar.setMaximum(1)
        self.keyword_bar.setValue(0)
        self.keyword_bar.setFixedHeight(22)
        self.keyword_bar.setStyleSheet("""
            QProgressBar { 
                height: 22px; 
                border-radius: 11px;
                background-color: #0f131c;
                border: 1px solid #232a3a;
                text-align: center;
                font-size: 11px;
                font-weight: 600;
                color: #e5e7eb;
            }
            QProgressBar::chunk { 
                background-color: #f59e0b; 
                border-top-left-radius: 10px;
                border-bottom-left-radius: 10px;
                border-top-right-radius: 10px;
                border-bottom-right-radius: 10px;
                margin: 0px;
            }
        """)
        keyword_layout.addWidget(self.keyword_bar)
        post_widget = QWidget()
        post_widget.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
        post_layout = QVBoxLayout(post_widget)
        post_layout.setContentsMargins(0, 0, 0, 0)
        post_layout.setSpacing(4)
        post_label = QLabel("Posts Progress")
        post_label.setObjectName("Muted")
        post_layout.addWidget(post_label)
        self.post_bar = QProgressBar()
        self.post_bar.setFormat("%v/%m")
        self.post_bar.setTextVisible(True)
        self.post_bar.setMinimum(0)
        self.post_bar.setMaximum(1)
        self.post_bar.setValue(0)
        self.post_bar.setFixedHeight(22)
        self.post_bar.setStyleSheet("""
            QProgressBar { 
                height: 22px; 
                border-radius: 11px;
                background-color: #0f131c;
                border: 1px solid #232a3a;
                text-align: center;
                font-size: 11px;
                font-weight: 600;
                color: #e5e7eb;
            }
            QProgressBar::chunk { 
                background-color: #22c55e; 
                border-top-left-radius: 10px;
                border-bottom-left-radius: 10px;
                border-top-right-radius: 10px;
                border-bottom-right-radius: 10px;
                margin: 0px;
            }
        """)
        post_layout.addWidget(self.post_bar)
        subreddit_widget = QWidget()
        subreddit_widget.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
        subreddit_layout = QVBoxLayout(subreddit_widget)
        subreddit_layout.setContentsMargins(0, 0, 0, 0)
        subreddit_layout.setSpacing(4)
        subreddit_label = QLabel("Subreddits Progress")
        subreddit_label.setObjectName("Muted")
        subreddit_layout.addWidget(subreddit_label)
        self.subreddit_bar = QProgressBar()
        self.subreddit_bar.setFormat("%v/%m")
        self.subreddit_bar.setTextVisible(True)
        self.subreddit_bar.setMinimum(0)
        self.subreddit_bar.setMaximum(1)
        self.subreddit_bar.setValue(0)
        self.subreddit_bar.setFixedHeight(22)
        self.subreddit_bar.setStyleSheet("""
            QProgressBar { 
                height: 22px; 
                border-radius: 11px;
                background-color: #0f131c;
                border: 1px solid #232a3a;
                text-align: center;
                font-size: 11px;
                font-weight: 600;
                color: #e5e7eb;
            }
            QProgressBar::chunk { 
                background-color: #4f8cff; 
                border-top-left-radius: 10px;
                border-bottom-left-radius: 10px;
                border-top-right-radius: 10px;
                border-bottom-right-radius: 10px;
                margin: 0px;
            }
        """)
        subreddit_layout.addWidget(self.subreddit_bar)
        progress_container.addWidget(keyword_widget)
        progress_container.addWidget(post_widget)
        progress_container.addWidget(subreddit_widget)
        layout.addLayout(progress_container)
        self.action_button = QPushButton("🛑 Stop Scraping")
        self.action_button.clicked.connect(self.stop_scraping)
        self.action_button.setMinimumHeight(44)
        self.action_button.setStyleSheet("""
            QPushButton {
                background-color: #3a1114;
                border: 1px solid #5a1c21;
                color: #ffd4d6;
            }
            QPushButton:hover { background-color: #471519; border-color: #6d242a; }
            QPushButton:pressed { background-color: #2c0c0f; }
            QPushButton:disabled {
                background-color: #11151d;
                color: #717a8c;
                border-color: #1a2030;
            }
        """)
        layout.addWidget(self.action_button)
        self.stack.addWidget(widget)

if __name__ == "__main__":
    if getattr(sys, 'frozen', False):
        application_path = sys._MEIPASS
    else:
        application_path = os.path.dirname(os.path.abspath(__file__))
    icon_path = resource_path("assets/supascraper-icon.ico")
    app = QApplication(sys.argv)
    if os.path.exists(icon_path):
        app.setWindowIcon(QIcon(icon_path))
    gui = SupaScrapeR()
    if os.path.exists(icon_path):
        gui.setWindowIcon(QIcon(icon_path))
    gui.show()
    sys.exit(app.exec_())