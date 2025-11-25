import sys
import json
import time
import traceback
import os
import re
from datetime import datetime, timezone
from threading import Thread
import praw
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from pytrends.request import TrendReq
from supabase import create_client
from cryptography.fernet import Fernet
NLP_AVAILABLE = False
nlp = None
inflect_engine = None
def initialize_nlp():
    global NLP_AVAILABLE, nlp, inflect_engine
    if NLP_AVAILABLE:
        return
    try:
        import spacy
        import inflect
        try:
            nlp = spacy.load("en_core_web_sm")
            inflect_engine = inflect.engine()
            NLP_AVAILABLE = True
        except Exception:
            NLP_AVAILABLE = False
    except ImportError:
        NLP_AVAILABLE = False
analyzer = SentimentIntensityAnalyzer()
initialize_nlp()
reddit = None
supabase_client = None
scraper_thread = None
is_running = False
is_paused = False
BROAD_SUBREDDITS = [
    "AskReddit", "news", "worldnews", "technology", "science",
    "todayilearned", "explainlikeimfive", "OutOfTheLoop", "NoStupidQuestions",
    "books", "television", "movies", "gaming", "sports", "nba", "soccer", "nfl",
    "food", "cooking", "DIY", "personalfinance", "investing", "cryptocurrency",
    "fitness", "health", "relationships", "travel", "photography", "art",
    "music", "videos", "funny", "pics", "gifs", "interestingasfuck",
    "mildlyinteresting", "dataisbeautiful", "space", "Futurology", "history"
]
CONCENTRATED_SUBREDDITS = [
    "AskReddit", "news", "worldnews", "technology", "science",
    "todayilearned", "explainlikeimfive", "IAmA", "bestof",
    "changemyview", "unpopularopinion", "TrueOffMyChest",
    "AmItheAsshole", "tifu", "LifeProTips"
]
def send_message(message):
    print(json.dumps(message))
    sys.stdout.flush()
initialize_nlp()
def log_error(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    send_message({"type": "error", "message": f"[{timestamp}] {message}"})
def get_sentiment(text):
    return analyzer.polarity_scores(text or "")["compound"]
def is_post_relevant(title, body, keyword_phrase, use_spacy=True):
    if not NLP_AVAILABLE:
        initialize_nlp()
    post_text = f"{title} {body}".lower()
    def find_entities_with_proximity(text, keyword_phrase):
        if not NLP_AVAILABLE or not nlp:
            return []
        doc = nlp(keyword_phrase)
        entities = []
        for ent in doc.ents:
            if ent.label_ in ["PERSON", "ORG", "GPE", "PRODUCT"]:
                entity_text = ent.text.lower()
                if ent.label_ == "PERSON" and len(entity_text.split()) > 1:
                    words = entity_text.split()
                    pattern = r'\b' + re.escape(words[0])
                    pattern += r'(?:\s+\w+)?\s+' + re.escape(words[1])
                    pattern += r'(?:\'?s)?\b'
                    if re.search(pattern, text, re.IGNORECASE):
                        entities.append(entity_text)
                else:
                    base_pattern = re.escape(entity_text)
                    pattern = r'\b' + base_pattern + r'(?:\'?s|s|ed|ing|er|est)?\b'
                    if re.search(pattern, text, re.IGNORECASE):
                        entities.append(entity_text)
        return entities
    def word_in_text_enhanced(word, text):
        if ' ' in word:
            return find_entities_with_proximity(text, word) or word.lower() in text.lower()
        forms = {word.lower()}
        if NLP_AVAILABLE and inflect_engine:
            try:
                plural_form = inflect_engine.plural(word)
                singular_form = inflect_engine.singular_noun(word) or word
                forms.add(plural_form.lower())
                forms.add(singular_form.lower())
                forms.add(f"{word.lower()}'s")
                forms.add(f"{singular_form.lower()}'s")
                forms.add(f"{word.lower()}s")
                forms.add(f"{singular_form.lower()}s")
            except:
                pass
        patterns = []
        for form in forms:
            base = re.escape(form)
            patterns.append(r"\b" + base + r"(?:'?s|ed|ing|er|est)?\b")
        combined = "|".join(patterns)
        return bool(re.search(combined, text, re.IGNORECASE))
    def get_sentences(text):
        sentences = re.split(r'[.!?]+', text)
        return [s.strip() for s in sentences if s.strip()]
    def words_in_same_sentence(words, text):
        sentences = get_sentences(text)
        for sentence in sentences:
            found_in_this_sentence = []
            for word in words:
                base = re.escape(word.lower())
                pattern = r"\b" + base + r"(?:'?s|s|ed|ing|er|est)?\b"
                if re.search(pattern, sentence, re.IGNORECASE):
                    found_in_this_sentence.append(word)
            if len(found_in_this_sentence) >= len(words):
                return True
            if len(words) >= 3 and len(found_in_this_sentence) >= len(words) - 1:
                return True
        return False
    def word_in_text_basic(word, text):
        if ' ' in word:
            words = word.split()
            return words_in_same_sentence(words, text)
        base = re.escape(word.lower())
        pattern = r"\b" + base + r"(?:'?s|s|ed|ing|er|est)?\b"
        return bool(re.search(pattern, text, re.IGNORECASE))
    keyword_units = []
    if use_spacy and NLP_AVAILABLE and nlp:
        doc = nlp(keyword_phrase)
        skip_indices = set()
        for ent in doc.ents:
            if ent.label_ in ["PERSON", "ORG", "GPE", "PRODUCT"]:
                keyword_units.append(ent.text.lower())
                for token in ent:
                    skip_indices.add(token.i)
        for i, token in enumerate(doc):
            if i not in skip_indices and token.text.lower() not in ['the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for'] and len(token.text) > 2:
                keyword_units.append(token.text.lower())
    else:
        words = keyword_phrase.lower().split()
        keyword_units = words
    if not keyword_units:
        keyword_units = keyword_phrase.lower().split()
    matched = []
    for unit in keyword_units:
        if use_spacy and NLP_AVAILABLE and nlp:
            if word_in_text_enhanced(unit, post_text):
                matched.append(unit)
        else:
            if word_in_text_basic(unit, post_text):
                matched.append(unit)
    if len(keyword_units) == 1:
        if use_spacy and NLP_AVAILABLE and nlp:
            is_relevant = word_in_text_enhanced(keyword_units[0], post_text)
        else:
            is_relevant = word_in_text_basic(keyword_units[0], post_text)
    elif len(keyword_units) == 2:
        if use_spacy and NLP_AVAILABLE and nlp:
            is_relevant = all(word_in_text_enhanced(unit, post_text) for unit in keyword_units)
        else:
            is_relevant = all(word_in_text_basic(unit, post_text) for unit in keyword_units)
    else:
        required_matches = len(keyword_units) - 1 if len(keyword_units) >= 3 else len(keyword_units)
        is_relevant = len(matched) >= required_matches
    return is_relevant, matched
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
def create_reddit_client(client_id, client_secret, user_agent):
    try:
        return praw.Reddit(
            client_id=client_id.strip(),
            client_secret=client_secret.strip(),
            user_agent=user_agent.strip()
        )
    except Exception as e:
        log_error(f"Failed to create Reddit client: {e}")
        raise
def test_reddit_connection(reddit_client):
    try:
        test_subreddit = reddit_client.subreddit('test')
        _ = test_subreddit.display_name
        return True, None
    except Exception as e:
        error_msg = str(e)
        if 'invalid_grant' in error_msg or 'unauthorized' in error_msg:
            return False, "Invalid Reddit API credentials"
        else:
            return False, f"Reddit connection failed: {error_msg}"
def test_supabase_connection(supabase_client):
    try:
        log_error("Testing Supabase connection...")
        response = supabase_client.table('reddit_posts').select("post_id").limit(1).execute()
        if hasattr(response, 'error') and response.error:
            log_error(f"Supabase query error: {response.error}")
            return False, f"Supabase error: {response.error}"
        log_error("Supabase connection successful")
        return True, None
    except Exception as e:
        error_msg = str(e).lower()
        log_error(f"Supabase connection exception: {e}")
        if 'invalid api key' in error_msg:
            return False, "Invalid Supabase service key"
        elif 'getaddrinfo failed' in error_msg or '11001' in error_msg:
            return False, "Network error: Cannot resolve Supabase URL. Check your internet connection and URL."
        elif 'timeout' in error_msg:
            return False, "Connection timeout: Supabase server not responding"
        else:
            return False, f"Supabase connection failed: {str(e)}"
class CredentialsManager:
    def __init__(self, data_folder):
        self.data_folder = data_folder
        self.credentials_path = os.path.join(data_folder, 'scraper_credentials.dat')
        self.key = self.get_or_create_key()
    def get_or_create_key(self):
        key_file = os.path.join(self.data_folder, '.scraper_key')
        if os.path.exists(key_file):
            with open(key_file, 'rb') as f:
                return f.read()
        key = Fernet.generate_key()
        os.makedirs(self.data_folder, exist_ok=True)
        with open(key_file, 'wb') as f:
            f.write(key)
        return key
    def save_credentials(self, supabase_url, service_key, reddit_client_id,
                        reddit_client_secret, reddit_user_agent):
        try:
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
            fernet = Fernet(self.key)
            decrypted_data = fernet.decrypt(encrypted_data)
            return json.loads(decrypted_data.decode('utf-8'))
        except Exception as e:
            log_error(f"Failed to load credentials: {e}")
            return None
    def delete_credentials(self):
        try:
            if os.path.exists(self.credentials_path):
                os.remove(self.credentials_path)
            key_file = os.path.join(self.data_folder, '.scraper_key')
            if os.path.exists(key_file):
                os.remove(key_file)
            return True
        except Exception as e:
            log_error(f"Failed to delete credentials: {e}")
            return False
def handle_login(message):
    global reddit, supabase_client
    try:
        credentials = message['credentials']
        data_folder = message['dataFolder']
        reddit = create_reddit_client(
            credentials['redditClientId'],
            credentials['redditClientSecret'],
            credentials['redditUserAgent']
        )
        success, error = test_reddit_connection(reddit)
        if not success:
            send_message({"type": "login-error", "error": error})
            return
        supabase_client = create_client(
            credentials['supabaseUrl'],
            credentials['serviceKey']
        )
        success, error = test_supabase_connection(supabase_client)
        if not success:
            send_message({"type": "login-error", "error": error})
            return
        if credentials.get('keepSignedIn'):
            cred_manager = CredentialsManager(data_folder)
            cred_manager.save_credentials(
                credentials['supabaseUrl'],
                credentials['serviceKey'],
                credentials['redditClientId'],
                credentials['redditClientSecret'],
                credentials['redditUserAgent']
            )
        send_message({
            "type": "login-success",
            "data": {
                "redditClientId": credentials['redditClientId']
            }
        })
    except Exception as e:
        send_message({"type": "login-error", "error": str(e)})
def handle_logout(message):
    global reddit, supabase_client
    reddit = None
    supabase_client = None
    data_folder = message.get('dataFolder')
    if data_folder:
        cred_manager = CredentialsManager(data_folder)
        cred_manager.delete_credentials()
    send_message({"type": "logout-success"})
def fetch_keywords(base_keywords):
    try:
        all_keywords = set()
        pytrend = TrendReq(timeout=(10,25), retries=2, backoff_factor=0.1)
        failed_keywords = []
        for base_keyword in base_keywords:
            try:
                pytrend.build_payload([base_keyword], timeframe='now 7-d', geo='US')
                related_queries = pytrend.related_queries()
                if (related_queries and
                    base_keyword in related_queries and
                    related_queries[base_keyword]['top'] is not None):
                    trending_keywords = related_queries[base_keyword]['top']['query'].tolist()
                    all_keywords.update([kw.lower().strip() for kw in trending_keywords])
                time.sleep(2)
            except Exception as e:
                error_msg = str(e)
                if 'response' in error_msg.lower() or '429' in error_msg:
                    error_msg = f"Rate limit reached for '{base_keyword}'"
                else:
                    error_msg = f"Could not fetch trends for '{base_keyword}'"
                log_error(error_msg)
                failed_keywords.append(base_keyword)
        if all_keywords:
            send_message({
                "type": "keywords-fetched",
                "data": list(all_keywords)
            })
        elif failed_keywords:
            send_message({
                "type": "keywords-error",
                "error": f"Google Trends unavailable for: {', '.join(failed_keywords)}"
            })
        else:
            send_message({
                "type": "keywords-error",
                "error": "No keywords could be fetched from Google Trends"
            })
    except Exception as e:
        send_message({
            "type": "keywords-error",
            "error": "Google Trends service is currently unavailable"
        })
def scrape_submission(submission, search_keyword=None, matched_words=None):
    try:
        if submission is None:
            send_message({
                "type": "scraper-log",
                "data": f"<b>Null Submission (Skipped):</b> Empty post data"
            })
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
            "live": False
        }
        if post_data["title"].strip().lower() in ["[deleted]", "[removed]"]:
            send_message({
                "type": "scraper-log",
                "data": f"<b>Deleted/Removed Post (Skipped):</b> {post_data['title'][:50]}"
            })
            return "skipped"
        submission.comment_sort = "top"
        submission.comments.replace_more(limit=0)
        comment_count = 0
        for comment in submission.comments:
            if comment_count >= 50:
                break
            if is_mod_or_bot_comment(comment):
                continue
            comment_text = comment.body if hasattr(comment, 'body') else ''
            post_data["comments"].append({
                "comment_id": comment.id if hasattr(comment, 'id') else f"comment_{comment_count}",
                "text": comment_text,
                "score": comment.score if hasattr(comment, 'score') else 0,
                "sentiment": get_sentiment(comment_text)
            })
            comment_count += 1
        if comment_count < 5:
            send_message({
                "type": "scraper-log",
                "data": f"<b>Not Enough Comments (Skipped):</b> {post_data['title'][:50]}"
            })
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
        try:
            response = supabase_client.table('reddit_posts').insert(insert_data).execute()
            if not getattr(response, "error", None):
                send_message({
                    "type": "scraper-log",
                    "data": f"<b>Saved Post:</b> {post_data['title'][:50]}..."
                })
                if search_keyword and matched_words:
                    send_message({
                        "type": "scraper-log",
                        "data": f"  → Matched: {', '.join(matched_words)}"
                    })
                return "saved"
        except Exception as e:
            error_str = str(e)
            if "unique" in error_str.lower():
                send_message({
                    "type": "scraper-log",
                    "data": f"<b>Duplicate Post (Skipped):</b> {post_data['title'][:50]}..."
                })
                return "skipped"
            else:
                log_error(f"Error inserting post: {e}")
                return "error"
    except Exception as e:
        log_error(f"Error processing submission: {e}")
        return "error"
def run_scraper(config):
    global is_running, is_paused
    is_running = True
    is_paused = False
    posts_saved = 0
    posts_skipped = 0
    posts_errored = 0
    run_infinite = config['runMode'] == 'infinite'
    scrape_mode = config['scrapeMode']
    keywords = config.get('keywords', [])
    keyword_batch_size = config.get('keywordBatchSize', 10)
    deepscan_batch_size = config.get('deepscanBatchSize', 25)
    broad_subreddits = config.get('broadSubreddits', BROAD_SUBREDDITS)
    concentrated_subreddits = config.get('concentratedSubreddits', CONCENTRATED_SUBREDDITS)
    while is_running:
        if scrape_mode in ['keyword', 'both']:
            total_subs = len(broad_subreddits)
            for sub_idx, subreddit_name in enumerate(broad_subreddits):
                if not is_running:
                    break
                send_message({
                    "type": "scraper-progress",
                    "data": {
                        "type": "subreddit",
                        "current": sub_idx,
                        "total": total_subs
                    }
                })
                total_keywords = len(keywords)
                for kw_idx, keyword in enumerate(keywords):
                    if not is_running:
                        break
                    while is_paused:
                        time.sleep(1)
                    send_message({
                        "type": "scraper-progress",
                        "data": {
                            "type": "keyword",
                            "current": kw_idx,
                            "total": total_keywords
                        }
                    })
                    send_message({
                        "type": "scraper-log",
                        "data": f"<hr style='border-color: #4f8cff; margin: 12px 0;'><b style='color: #4f8cff;'>→ Keyword: {keyword} | Subreddit: r/{subreddit_name}</b>"
                    })
                    time.sleep(0.1)
                    send_message({
                        "type": "scraper-progress",
                        "data": {
                            "type": "info",
                            "method": "Keyword Search",
                            "subreddit": f"r/{subreddit_name}",
                            "keyword": keyword,
                            "batchSize": str(keyword_batch_size)
                        }
                    })
                    try:
                        subreddit = reddit.subreddit(subreddit_name)
                        submissions = list(subreddit.search(keyword, limit=50))
                        valid_submissions = [post for post in submissions if post is not None]
                        total_posts = len(valid_submissions)
                        send_message({
                            "type": "scraper-progress",
                            "data": {
                                "type": "posts",
                                "current": 0,
                                "total": total_posts if total_posts > 0 else 1
                            }
                        })
                        for batch_start in range(0, len(valid_submissions), keyword_batch_size):
                            batch = valid_submissions[batch_start:batch_start + keyword_batch_size]
                            for idx, submission in enumerate(batch):
                                if not is_running:
                                    break
                                while is_paused:
                                    time.sleep(1)
                                current_post_idx = batch_start + idx + 1
                                send_message({
                                    "type": "scraper-progress",
                                    "data": {
                                        "type": "posts",
                                        "current": current_post_idx,
                                        "total": total_posts
                                    }
                                })
                                use_spacy = NLP_AVAILABLE and nlp
                                is_relevant, matched_words = is_post_relevant(
                                    submission.title or "",
                                    submission.selftext or "",
                                    keyword,
                                    use_spacy
                                )
                                if not is_relevant:
                                    send_message({
                                        "type": "scraper-log",
                                        "data": f"<b>Irrelevant Post (Skipped):</b> {submission.title[:50]}..."
                                    })
                                    total_words = len(keyword.split())
                                    send_message({
                                        "type": "scraper-log",
                                        "data": f"  → Matched only {len(matched_words)}/{total_words} words: {', '.join(matched_words) if matched_words else 'none'}"
                                    })
                                    continue
                                result = scrape_submission(submission, keyword, matched_words)
                                if result == "saved":
                                    posts_saved += 1
                                elif result == "skipped":
                                    posts_skipped += 1
                                else:
                                    posts_errored += 1
                                time.sleep(0.2)
                            time.sleep(0.1)
                    except Exception as e:
                        log_error(f"Error in keyword search: {e}")
                    time.sleep(0.4)
                send_message({
                    "type": "scraper-progress",
                    "data": {
                        "type": "keyword",
                        "current": total_keywords,
                        "total": total_keywords
                    }
                })
                time.sleep(0.8)
            send_message({
                "type": "scraper-progress",
                "data": {
                    "type": "subreddit",
                    "current": total_subs,
                    "total": total_subs
                }
            })
        if scrape_mode in ['both']:
            send_message({
                "type": "scraper-progress",
                "data": {
                    "type": "info",
                    "method": "DeepScan"
                }
            })
        if scrape_mode in ['deepscan', 'both']:
            total_subs = len(concentrated_subreddits)
            for sub_idx, subreddit_name in enumerate(concentrated_subreddits):
                if not is_running:
                    break
                send_message({
                    "type": "scraper-progress",
                    "data": {
                        "type": "subreddit",
                        "current": sub_idx,
                        "total": total_subs
                    }
                })
                send_message({
                    "type": "scraper-log",
                    "data": f"<hr style='border-color: #22c55e; margin: 12px 0;'><b style='color: #22c55e;'>→ DeepScan: r/{subreddit_name}</b>"
                })
                time.sleep(0.1)
                send_message({
                    "type": "scraper-progress",
                    "data": {
                        "type": "info",
                        "method": "DeepScan",
                        "subreddit": f"r/{subreddit_name}",
                        "keyword": "(none)",
                        "batchSize": str(deepscan_batch_size)
                    }
                })
                try:
                    subreddit = reddit.subreddit(subreddit_name)
                    submissions = list(subreddit.new(limit=100))
                    valid_submissions = [post for post in submissions if post is not None]
                    total_posts = len(valid_submissions)
                    send_message({
                        "type": "scraper-progress",
                        "data": {
                            "type": "posts",
                            "current": 0,
                            "total": total_posts if total_posts > 0 else 1
                        }
                    })
                    for batch_start in range(0, len(valid_submissions), deepscan_batch_size):
                        batch = valid_submissions[batch_start:batch_start + deepscan_batch_size]
                        for idx, submission in enumerate(batch):
                            if not is_running:
                                break
                            while is_paused:
                                time.sleep(0.5)
                                if not is_running:
                                    break
                            current_post_idx = batch_start + idx + 1
                            send_message({
                                "type": "scraper-progress",
                                "data": {
                                    "type": "posts",
                                    "current": current_post_idx,
                                    "total": total_posts
                                }
                            })
                            if submission.title.strip() == "" and submission.selftext.strip() == "":
                                send_message({
                                    "type": "scraper-log",
                                    "data": f"<b>Empty Post (Skipped):</b> Post {current_post_idx} has no title or content"
                                })
                                continue
                            if submission.num_comments < 5:
                                send_message({
                                    "type": "scraper-log",
                                    "data": f"<b>Low Engagement (Skipped):</b> {submission.title[:50]}... — Only {submission.num_comments} comments"
                                })
                                continue
                            result = scrape_submission(submission)
                            if result == "saved":
                                posts_saved += 1
                            elif result == "skipped":
                                posts_skipped += 1
                            else:
                                posts_errored += 1
                            time.sleep(0.2)
                        time.sleep(0.1)
                except Exception as e:
                    log_error(f"Error in deepscan: {e}")
                time.sleep(0.4)
            send_message({
                "type": "scraper-progress",
                "data": {
                    "type": "subreddit",
                    "current": total_subs,
                    "total": total_subs
                }
            })
        if not run_infinite:
            break
        else:
            send_message({
                "type": "scraper-log",
                "data": f"<hr style='border-color: #f59e0b; margin: 12px 0;'><b style='color: #f59e0b;'>Cycle complete, sleeping 10 minutes...</b>"
            })
            send_message({
                "type": "scraper-progress",
                "data": {
                    "type": "keyword",
                    "current": 0,
                    "total": 0
                }
            })
            send_message({
                "type": "scraper-progress",
                "data": {
                    "type": "posts",
                    "current": 0,
                    "total": 0
                }
            })
            send_message({
                "type": "scraper-progress",
                "data": {
                    "type": "subreddit",
                    "current": 0,
                    "total": 0
                }
            })
            for _ in range(600):
                if not is_running:
                    break
                time.sleep(1)
    send_message({"type": "scraper-finished"})
def handle_message(message):
    global scraper_thread, is_running, is_paused
    msg_type = message.get('type')
    if msg_type == 'login':
        handle_login(message)
    elif msg_type == 'logout':
        handle_logout(message)
    elif msg_type == 'check-nlp':
        initialize_nlp()
        send_message({
            "type": "nlp-status",
            "available": NLP_AVAILABLE
        })
        log_error(f"NLP status check: NLP_AVAILABLE={NLP_AVAILABLE}, nlp={nlp is not None}")
    elif msg_type == 'load-credentials':
        data_folder = message.get('dataFolder')
        cred_manager = CredentialsManager(data_folder)
        credentials = cred_manager.load_credentials()
        if credentials:
            message['credentials'] = {
                'supabaseUrl': credentials['supabase_url'],
                'serviceKey': credentials['service_key'],
                'redditClientId': credentials['reddit_client_id'],
                'redditClientSecret': credentials['reddit_client_secret'],
                'redditUserAgent': credentials['reddit_user_agent'],
                'keepSignedIn': True
            }
            handle_login(message)
    elif msg_type == 'fetch-keywords':
        keywords = message.get('keywords', [])
        thread = Thread(target=fetch_keywords, args=(keywords,))
        thread.start()
    elif msg_type == 'start-scraping':
        config = message.get('config')
        is_running = True
        scraper_thread = Thread(target=run_scraper, args=(config,))
        scraper_thread.start()
    elif msg_type == 'pause-scraping':
        is_paused = True
    elif msg_type == 'resume-scraping':
        is_paused = False
    elif msg_type == 'stop-scraping':
        is_running = False
        is_paused = False
        if scraper_thread:
            scraper_thread.join(timeout=5)
        send_message({"type": "scraper-stopped"})
def main():
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            message = json.loads(line.strip())
            handle_message(message)
        except json.JSONDecodeError:
            log_error(f"Invalid JSON received: {line}")
        except Exception as e:
            log_error(f"Error handling message: {e}")
if __name__ == "__main__":
    main()