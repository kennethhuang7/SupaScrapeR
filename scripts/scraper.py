import sys
import json
import praw
import time
import psutil
import os
import signal
from datetime import datetime
from textblob import TextBlob
import spacy
from supabase import create_client, Client
from prawcore.exceptions import ResponseException, RequestException, Forbidden
nlp = None
stop_requested = False
def signal_handler(sig, frame):
    global stop_requested
    stop_requested = True
    log_message("info", "Stop signal received - finishing current operation...")
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)
class RateLimiter:
    def __init__(self, requests_per_minute):
        self.requests_per_minute = requests_per_minute
        self.min_interval = 60.0 / requests_per_minute if requests_per_minute > 0 else 0
        self.last_request_time = 0
    def wait_if_needed(self):
        if self.min_interval <= 0:
            return
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        if time_since_last < self.min_interval:
            sleep_time = self.min_interval - time_since_last
            time.sleep(sleep_time)
        self.last_request_time = time.time()
def load_spacy_model():
    global nlp
    try:
        nlp = spacy.load("en_core_web_sm")
    except OSError:
        nlp = None
def log_message(msg_type, message, post_id=None, reason=None):
    timestamp = datetime.now().strftime("%H:%M:%S")
    log_entry = {
        "timestamp": timestamp,
        "type": msg_type,
        "message": message
    }
    if post_id:
        log_entry["post_id"] = post_id
    if reason:
        log_entry["reason"] = reason
    print(json.dumps({"type": "log", "data": log_entry}), flush=True)
def send_rate_limit_warning(wait_time):
    warning_data = {
        "wait_time": wait_time,
        "message": f"Reddit API rate limit reached. Pausing for {wait_time} seconds..."
    }
    print(json.dumps({"type": "rate_limit", "data": warning_data}), flush=True)
def send_progress(status, current_target, posts_collected, total_target, cpu_usage, ram_usage, elapsed_time, current_keyword, total_keywords, current_subreddit, total_subreddits, current_iteration_posts, max_iteration_posts, mode):
    progress_data = {
        "status": status,
        "current_target": current_target,
        "posts_collected": posts_collected,
        "total_target": total_target,
        "cpu_usage": cpu_usage,
        "ram_usage": ram_usage,
        "elapsed_time": elapsed_time,
        "current_keyword": current_keyword,
        "total_keywords": total_keywords,
        "current_subreddit": current_subreddit,
        "total_subreddits": total_subreddits,
        "current_iteration_posts": current_iteration_posts,
        "max_iteration_posts": max_iteration_posts,
        "mode": mode
    }
    print(json.dumps({"type": "progress", "data": progress_data}), flush=True)
def get_system_metrics():
    cpu_percent = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()
    ram_percent = memory.percent
    return cpu_percent, ram_percent
def analyze_sentiment(text):
    try:
        blob = TextBlob(text)
        polarity = blob.sentiment.polarity
        if polarity > 0.1:
            return polarity, "positive"
        elif polarity < -0.1:
            return polarity, "negative"
        else:
            return polarity, "neutral"
    except:
        return 0.0, "neutral"
def extract_entities(text):
    global nlp
    if nlp is None:
        return []
    try:
        doc = nlp(text[:10000])
        entities = []
        for ent in doc.ents:
            if ent.label_ in ["PERSON", "ORG", "GPE", "PRODUCT"]:
                entities.append({
                    "text": ent.text,
                    "label": ent.label_
                })
        return entities
    except:
        return []
def scrape_comments(post, max_comments=5, enable_sentiment=True):
    comments_data = []
    try:
        post.comments.replace_more(limit=0)
        bot_keywords = ['bot', 'moderator', 'automod', 'automoderator']
        for comment in post.comments.list()[:max_comments * 3]:
            if len(comments_data) >= max_comments:
                break
            if comment.author is None:
                continue
            author_name = str(comment.author).lower()
            if any(keyword in author_name for keyword in bot_keywords):
                continue
            if comment.stickied or comment.distinguished:
                continue
            comment_sentiment_score = 0.0
            comment_sentiment_label = "neutral"
            if enable_sentiment:
                comment_sentiment_score, comment_sentiment_label = analyze_sentiment(comment.body)
            comments_data.append({
                "author": str(comment.author),
                "body": comment.body,
                "score": comment.score,
                "created_utc": datetime.fromtimestamp(comment.created_utc).isoformat(),
                "sentiment_score": comment_sentiment_score,
                "sentiment_label": comment_sentiment_label
            })
    except Exception as e:
        log_message("error", f"Failed to scrape comments: {str(e)}")
    return comments_data
def check_keyword_match(title, keyword, strict_mode, count_entities, entity_recognition_enabled):
    title_lower = title.lower()
    keyword_lower = keyword.strip().lower()
    keyword_words = [w.strip() for w in keyword_lower.split() if w.strip()]
    matched_keywords = set()
    for word in keyword_words:
        if word in title_lower:
            matched_keywords.add(word)
    entity_merge_info = []
    if count_entities and entity_recognition_enabled:
        detected_entities = extract_entities(title)
        for entity in detected_entities:
            entity_text = entity.get('text', '').lower()
            keywords_in_entity = [kw for kw in matched_keywords if kw in entity_text]
            if len(keywords_in_entity) >= 2:
                entity_merge_info.append({
                    "entity": entity.get('text'),
                    "merged_keywords": list(keywords_in_entity),
                    "label": entity.get('label')
                })
                for kw in keywords_in_entity[1:]:
                    matched_keywords.discard(kw)
    total_matched = len(matched_keywords)
    total_required = len(keyword_words)
    missing_keywords = [kw for kw in keyword_words if kw not in matched_keywords]
    if strict_mode:
        passes = total_matched >= total_required
    else:
        if total_required <= 2:
            passes = total_matched >= total_required
        else:
            passes = total_matched >= (total_required - 1)
    match_result = {
        "matched": passes,
        "matched_count": total_matched,
        "total_required": total_required,
        "matched_keywords": list(matched_keywords),
        "missing_keywords": missing_keywords,
        "entity_merges": entity_merge_info
    }
    return passes, match_result
def apply_filters(post, filters):
    if filters.get('min_comments', 0) > 0 and post.num_comments < filters['min_comments']:
        return False, f"Comments below minimum ({post.num_comments} < {filters['min_comments']})"
    if filters.get('min_score', 0) > 0 and post.score < filters['min_score']:
        return False, f"Score below minimum ({post.score} < {filters['min_score']})"
    if filters.get('exclude_stickied', False) and post.stickied:
        return False, "Post is stickied"
    if filters.get('exclude_over_18', False) and post.over_18:
        return False, "Post is NSFW"
    return True, ""
def categorize_and_log_error(error, context=""):
    error_type = type(error).__name__
    error_msg = str(error)
    if isinstance(error, ResponseException):
        status_code = error.response.status_code
        if status_code == 401:
            log_message("error", f"[CREDENTIALS ERROR] Invalid Reddit API credentials - Check your Client ID and Secret in Settings. {context}")
        elif status_code == 403:
            log_message("error", f"[PERMISSION ERROR] Access forbidden - Subreddit may be private, banned, or require special permissions. {context}")
        elif status_code == 404:
            log_message("error", f"[NOT FOUND] Subreddit does not exist. {context}")
        elif status_code == 429:
            log_message("error", f"[RATE LIMIT] Reddit API rate limit exceeded - Automatic retry in progress. {context}")
        elif status_code >= 500:
            log_message("error", f"[REDDIT SERVER ERROR] Reddit's servers are having issues (Error {status_code}). {context}")
        else:
            log_message("error", f"[API ERROR] Reddit API error {status_code}: {error_msg}. {context}")
    elif isinstance(error, RequestException):
        if "timeout" in error_msg.lower():
            log_message("error", f"[NETWORK ERROR] Request timed out - Check your internet connection. {context}")
        elif "connection" in error_msg.lower():
            log_message("error", f"[NETWORK ERROR] Connection failed - Check your internet connection. {context}")
        else:
            log_message("error", f"[NETWORK ERROR] Network request failed: {error_msg}. {context}")
    elif isinstance(error, Forbidden):
        log_message("error", f"[PERMISSION ERROR] Access denied - Subreddit is private, banned, or you lack permissions. {context}")
    elif "supabase" in error_msg.lower() or "postgrest" in error_msg.lower():
        log_message("error", f"[DATABASE ERROR] Failed to save to Supabase - Check your database connection in Settings. {context}")
    else:
        log_message("error", f"[UNKNOWN ERROR] {error_msg}. {context}")
def handle_reddit_request(func, *args, max_retries=3, **kwargs):
    for attempt in range(max_retries):
        try:
            return func(*args, **kwargs)
        except ResponseException as e:
            if e.response.status_code == 429:
                retry_after = int(e.response.headers.get('Retry-After', 60))
                wait_time = min(retry_after, 300)
                log_message("error", f"[RATE LIMIT] Reddit API rate limit hit. Waiting {wait_time}s before retry {attempt + 1}/{max_retries}")
                send_rate_limit_warning(wait_time)
                time.sleep(wait_time)
                if attempt == max_retries - 1:
                    categorize_and_log_error(e, "Max retries reached")
                    raise
            elif e.response.status_code == 403:
                categorize_and_log_error(e, "Check credentials or subreddit permissions")
                raise
            elif e.response.status_code == 401:
                categorize_and_log_error(e, "Verify your Reddit API credentials in Settings")
                raise
            else:
                categorize_and_log_error(e)
                raise
        except RequestException as e:
            wait_time = min(30 * (attempt + 1), 120)
            if attempt < max_retries - 1:
                log_message("error", f"[NETWORK ERROR] Connection issue - Retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
            else:
                categorize_and_log_error(e, "Max retries reached - check your internet connection")
            time.sleep(wait_time)
            if attempt == max_retries - 1:
                raise
        except Forbidden as e:
            categorize_and_log_error(e)
            raise
        except Exception as e:
            categorize_and_log_error(e)
            raise
    return None
def increment_total_posts(supabase: Client, user_id: str, count: int):
    try:
        result = supabase.rpc('increment_total_posts', {'user_id_param': user_id, 'count_param': count}).execute()
    except Exception as e:
        categorize_and_log_error(e, "Failed to update total posts count")
def add_recent_activity(supabase: Client, user_id: str, activity_text: str):
    try:
        supabase.table('recent_activities').insert({
            'user_id': user_id,
            'action_text': activity_text
        }).execute()
    except Exception as e:
        categorize_and_log_error(e, "Failed to add recent activity")
def log_empty_results(subreddit_name, keyword=None, mode="search"):
    if keyword:
        log_message("info", f"No posts found for keyword '{keyword}' in r/{subreddit_name}")
    else:
        log_message("info", f"r/{subreddit_name} returned 0 posts in {mode} mode")
def scrape_keyword_mode(reddit, subreddit_list, keywords, config, filters, start_time, supabase, user_id, preset, rate_limiter):
    global stop_requested
    if isinstance(keywords, list):
        keyword_list = [k.strip() for k in keywords if k.strip()]
    else:
        keyword_list = [k.strip() for k in str(keywords).split(',') if k.strip()]
    posts_collected = 0
    auto_stop_target = config.get('auto_stop_target') or config.get('autoStopTarget')
    max_posts_per_keyword = config.get('max_posts_per_keyword', 50)
    scrape_comments_enabled = config.get('scrape_comments') or config.get('scrapeComments', False)
    max_comments = config.get('max_comments_per_post') or config.get('maxCommentsPerPost', 5)
    time_filter = filters.get('time_filter', 'all')
    total_keywords = len(keyword_list)
    total_subreddits = len(subreddit_list)
    for keyword_idx, keyword in enumerate(keyword_list):
        if stop_requested:
            log_message("info", "Scraping stopped by user")
            break
        for subreddit_idx, subreddit_name in enumerate(subreddit_list):
            if stop_requested:
                log_message("info", "Scraping stopped by user")
                break
            current_iteration_posts = 0
            cpu, ram = get_system_metrics()
            elapsed = int(time.time() - start_time)
            send_progress("running", f"r/{subreddit_name}: {keyword}", posts_collected, auto_stop_target or 5000, cpu, ram, elapsed, keyword_idx, total_keywords, subreddit_idx, total_subreddits, current_iteration_posts, max_posts_per_keyword, "keyword")
            try:
                rate_limiter.wait_if_needed()
                subreddit = reddit.subreddit(subreddit_name)
                posts_generator = handle_reddit_request(
                    lambda: list(subreddit.search(keyword, limit=max_posts_per_keyword, time_filter=time_filter))
                )
                if posts_generator is None:
                    log_message("error", f"Failed to retrieve posts from r/{subreddit_name}")
                    continue
                if len(posts_generator) == 0:
                    log_empty_results(subreddit_name, keyword)
                    continue
                for post in posts_generator:
                    if stop_requested:
                        log_message("info", "Scraping stopped by user")
                        return posts_collected
                    if auto_stop_target is not None and posts_collected >= auto_stop_target:
                        log_message("info", f"Reached auto-stop target of {auto_stop_target} posts")
                        return posts_collected
                    passes_filter, reason = apply_filters(post, filters)
                    if not passes_filter:
                        log_message("rejected", 
                            f"❌ REJECTED: \"{post.title[:60]}...\"\n              - Reason: {reason}",
                            post.id, 
                            reason)
                        continue
                    match_passes, match_info = check_keyword_match(
                        post.title,
                        keyword,
                        filters.get('strict_keyword_matching', False),
                        filters.get('count_entities_as_keywords', False),
                        config.get('entity_recognition', False)
                    )
                    if not match_passes:
                        matched_str = ", ".join([f'"{k}"' for k in match_info["matched_keywords"]]) if match_info["matched_keywords"] else "none"
                        missing_str = ", ".join([f'"{k}"' for k in match_info["missing_keywords"]]) if match_info["missing_keywords"] else "none"
                        log_message("rejected", 
                            f"❌ REJECTED: \"{post.title[:60]}...\"\n              - Reason: Keyword match failed ({match_info['matched_count']}/{match_info['total_required']} keywords found)\n              - Matched: {matched_str} | Missing: {missing_str}",
                            post.id, 
                            f"Keyword mismatch: {match_info['matched_count']}/{match_info['total_required']}")
                        continue
                    sentiment_score = 0.0
                    sentiment_label = "neutral"
                    if config.get('sentiment_analysis', True):
                        sentiment_score, sentiment_label = analyze_sentiment(post.title + " " + (post.selftext or ""))
                    entities_data = []
                    if config.get('entity_recognition', False):
                        entities_data = extract_entities(post.title + " " + (post.selftext or ""))
                    comments_data = []
                    if scrape_comments_enabled:
                        comments_data = scrape_comments(post, max_comments, config.get('sentiment_analysis', True))
                    keywords_found = ", ".join(match_info["matched_keywords"]) if match_info["matched_keywords"] else keyword
                    post_data = {
                        "post_id": post.id,
                        "title": post.title,
                        "body": post.selftext or "",
                        "author": str(post.author) if post.author else "[deleted]",
                        "subreddit": post.subreddit.display_name,
                        "url": post.url,
                        "created_utc": datetime.fromtimestamp(post.created_utc).isoformat(),
                        "score": post.score,
                        "num_comments": post.num_comments,
                        "upvote_ratio": post.upvote_ratio,
                        "permalink": f"https://reddit.com{post.permalink}",
                        "link_flair_text": post.link_flair_text or "",
                        "over_18": post.over_18,
                        "spoiler": post.spoiler,
                        "stickied": post.stickied,
                        "sentiment_score": sentiment_score,
                        "sentiment_label": sentiment_label,
                        "entities": entities_data,
                        "comments": comments_data,
                        "keywords_found": keywords_found,
                        "collected_at": datetime.utcnow().isoformat() + 'Z',
                        "search_mode": "keyword",
                        "batch_id": f"batch_{int(time.time())}",
                        "preset_name": preset.get('name', 'Unknown'),
                        "preset_id": preset.get('id', ''),
                        "keyword_used": keyword
                    }
                    try:
                        supabase.table('reddit_posts').insert(post_data).execute()
                        entity_info = ""
                        if match_info.get("entity_merges"):
                            merged_entities = []
                            for merge in match_info["entity_merges"]:
                                merged_entities.append(f"\"{merge['entity']}\" ({merge['label']})")
                            entity_info = f"\n              - Entities merged: {', '.join(merged_entities)}"
                        matched_kw_str = ", ".join([f'"{k}"' for k in match_info["matched_keywords"]])
                        log_message("success", 
                            f"✅ ACCEPTED: \"{post.title[:60]}...\"\n              - Matched {match_info['matched_count']}/{match_info['total_required']} keywords: {matched_kw_str}\n              - Score: {post.score} | Comments: {post.num_comments}{entity_info}",
                            post.id)
                        current_iteration_posts += 1
                        posts_collected += 1
                        cpu, ram = get_system_metrics()
                        elapsed = int(time.time() - start_time)
                        send_progress("running", f"r/{subreddit_name}: {keyword}", posts_collected, auto_stop_target or 5000, cpu, ram, elapsed, keyword_idx, total_keywords, subreddit_idx, total_subreddits, current_iteration_posts, max_posts_per_keyword, "keyword")
                    except Exception as e:
                        categorize_and_log_error(e, f"Failed to save post '{post.title[:30]}...' to database")
            except Forbidden as e:
                categorize_and_log_error(e, f"r/{subreddit_name}")
                continue
            except Exception as e:
                categorize_and_log_error(e, f"r/{subreddit_name}")
                continue
            if current_iteration_posts > 0:
                log_message("info", f"r/{subreddit_name} + '{keyword}': {current_iteration_posts} posts collected")
            cpu, ram = get_system_metrics()
            elapsed = int(time.time() - start_time)
            send_progress("running", f"Completed r/{subreddit_name}: {keyword}", posts_collected, auto_stop_target or 5000, cpu, ram, elapsed, keyword_idx, total_keywords, subreddit_idx + 1, total_subreddits, 0, 0, "keyword")
        cpu, ram = get_system_metrics()
        elapsed = int(time.time() - start_time)
        send_progress("running", f"Completed keyword: {keyword}", posts_collected, auto_stop_target or 5000, cpu, ram, elapsed, keyword_idx + 1, total_keywords, 0, total_subreddits, 0, 0, "keyword")
    return posts_collected
def scrape_deepscan_mode(reddit, subreddit_list, config, filters, start_time, supabase, user_id, preset, rate_limiter):
    global stop_requested
    posts_collected = 0
    auto_stop_target = config.get('auto_stop_target') or config.get('autoStopTarget')
    max_posts_per_subreddit = config.get('max_posts_per_subreddit', 50)
    scrape_comments_enabled = config.get('scrape_comments') or config.get('scrapeComments', False)
    max_comments = config.get('max_comments_per_post') or config.get('maxCommentsPerPost', 5)
    time_filter = filters.get('time_filter', 'all')
    total_subreddits = len(subreddit_list)
    for subreddit_idx, subreddit_name in enumerate(subreddit_list):
        if stop_requested:
            log_message("info", "Scraping stopped by user")
            break
        current_iteration_posts = 0
        cpu, ram = get_system_metrics()
        elapsed = int(time.time() - start_time)
        send_progress("running", f"r/{subreddit_name}", posts_collected, auto_stop_target or 5000, cpu, ram, elapsed, 0, 0, subreddit_idx, total_subreddits, current_iteration_posts, max_posts_per_subreddit, "deepscan")
        try:
            rate_limiter.wait_if_needed()
            subreddit = reddit.subreddit(subreddit_name)
            posts_generator = handle_reddit_request(
                lambda: list(subreddit.hot(limit=max_posts_per_subreddit))
            )
            if posts_generator is None:
                log_message("error", f"Failed to retrieve posts from r/{subreddit_name}")
                continue
            if len(posts_generator) == 0:
                log_empty_results(subreddit_name, mode="deepscan")
                continue
            for post in posts_generator:
                if stop_requested:
                    log_message("info", "Scraping stopped by user")
                    return posts_collected
                if auto_stop_target is not None and posts_collected >= auto_stop_target:
                    log_message("info", f"Reached auto-stop target of {auto_stop_target} posts")
                    break
                passes_filter, reason = apply_filters(post, filters)
                if not passes_filter:
                    log_message("rejected", 
                        f"❌ REJECTED: \"{post.title[:60]}...\"\n              - Reason: {reason}",
                        post.id, 
                        reason)
                    continue
                sentiment_score = 0.0
                sentiment_label = "neutral"
                if config.get('sentiment_analysis', True):
                    sentiment_score, sentiment_label = analyze_sentiment(post.title + " " + (post.selftext or ""))
                entities_data = []
                if config.get('entity_recognition', False):
                    entities_data = extract_entities(post.title + " " + (post.selftext or ""))
                comments_data = []
                if scrape_comments_enabled:
                    comments_data = scrape_comments(post, max_comments, config.get('sentiment_analysis', True))
                post_data = {
                    "post_id": post.id,
                    "title": post.title,
                    "body": post.selftext or "",
                    "author": str(post.author) if post.author else "[deleted]",
                    "subreddit": post.subreddit.display_name,
                    "url": post.url,
                    "created_utc": datetime.fromtimestamp(post.created_utc).isoformat(),
                    "score": post.score,
                    "num_comments": post.num_comments,
                    "upvote_ratio": post.upvote_ratio,
                    "permalink": f"https://reddit.com{post.permalink}",
                    "link_flair_text": post.link_flair_text or "",
                    "over_18": post.over_18,
                    "spoiler": post.spoiler,
                    "stickied": post.stickied,
                    "sentiment_score": sentiment_score,
                    "sentiment_label": sentiment_label,
                    "entities": entities_data,
                    "comments": comments_data,
                    "keywords_found": "",
                    "collected_at": datetime.utcnow().isoformat() + 'Z',
                    "search_mode": "deepscan",
                    "batch_id": f"batch_{int(time.time())}",
                    "preset_name": preset.get('name', 'Unknown'),
                    "preset_id": preset.get('id', ''),
                    "keyword_used": ""
                }
                try:
                    supabase.table('reddit_posts').insert(post_data).execute()
                    log_message("success", 
                        f"✅ ACCEPTED: \"{post.title[:60]}...\"\n              - Score: {post.score} | Comments: {post.num_comments}",
                        post.id)
                    current_iteration_posts += 1
                    posts_collected += 1
                    cpu, ram = get_system_metrics()
                    elapsed = int(time.time() - start_time)
                    send_progress("running", f"r/{subreddit_name}", posts_collected, auto_stop_target or 5000, cpu, ram, elapsed, 0, 0, subreddit_idx, total_subreddits, current_iteration_posts, max_posts_per_subreddit, "deepscan")
                except Exception as e:
                    categorize_and_log_error(e, f"Failed to save post '{post.title[:30]}...' to database")
        except Forbidden as e:
            categorize_and_log_error(e, f"r/{subreddit_name}")
            continue
        except Exception as e:
            categorize_and_log_error(e, f"r/{subreddit_name}")
            continue
        if current_iteration_posts > 0:
            log_message("info", f"r/{subreddit_name} complete: {current_iteration_posts} posts collected")
        cpu, ram = get_system_metrics()
        elapsed = int(time.time() - start_time)
        send_progress("running", f"Completed r/{subreddit_name}", posts_collected, auto_stop_target or 5000, cpu, ram, elapsed, 0, 0, subreddit_idx + 1, total_subreddits, 0, 0, "deepscan")
    return posts_collected
def scrape_hybrid_mode(reddit, subreddit_list, keywords, config, filters, start_time, supabase, user_id, preset, rate_limiter):
    global stop_requested
    if isinstance(keywords, list):
        keyword_list = [k.strip() for k in keywords if k.strip()]
    else:
        keyword_list = [k.strip() for k in str(keywords).split(',') if k.strip()]
    posts_collected = 0
    auto_stop_target = config.get('auto_stop_target') or config.get('autoStopTarget')
    max_posts_per_keyword = config.get('max_posts_per_keyword', 50)
    max_posts_per_subreddit = config.get('max_posts_per_subreddit', 50)
    scrape_comments_enabled = config.get('scrape_comments') or config.get('scrapeComments', False)
    max_comments = config.get('max_comments_per_post') or config.get('maxCommentsPerPost', 5)
    time_filter = filters.get('time_filter', 'all')
    total_keywords = len(keyword_list)
    total_subreddits = len(subreddit_list)
    for keyword_idx, keyword in enumerate(keyword_list):
        if stop_requested:
            log_message("info", "Scraping stopped by user")
            break
        for subreddit_idx, subreddit_name in enumerate(subreddit_list):
            if stop_requested:
                log_message("info", "Scraping stopped by user")
                break
            current_iteration_posts = 0
            cpu, ram = get_system_metrics()
            elapsed = int(time.time() - start_time)
            send_progress("running", f"r/{subreddit_name}: {keyword}", posts_collected, auto_stop_target or 5000, cpu, ram, elapsed, keyword_idx, total_keywords, subreddit_idx, total_subreddits, current_iteration_posts, max_posts_per_keyword, "hybrid")
            try:
                rate_limiter.wait_if_needed()
                subreddit = reddit.subreddit(subreddit_name)
                posts_generator = handle_reddit_request(
                    lambda: list(subreddit.search(keyword, limit=max_posts_per_keyword, time_filter=time_filter))
                )
                if posts_generator is None:
                    log_message("error", f"Failed to retrieve posts from r/{subreddit_name}")
                    continue
                if len(posts_generator) == 0:
                    log_empty_results(subreddit_name, keyword, mode="hybrid")
                    continue
                for post in posts_generator:
                    if stop_requested:
                        log_message("info", "Scraping stopped by user")
                        return posts_collected
                    if auto_stop_target is not None and posts_collected >= auto_stop_target:
                        log_message("info", f"Reached auto-stop target of {auto_stop_target} posts")
                        return posts_collected
                    passes_filter, reason = apply_filters(post, filters)
                    if not passes_filter:
                        log_message("rejected", 
                            f"❌ REJECTED: \"{post.title[:60]}...\"\n              - Reason: {reason}",
                            post.id, 
                            reason)
                        continue
                    match_passes, match_info = check_keyword_match(
                        post.title,
                        keyword,
                        filters.get('strict_keyword_matching', False),
                        filters.get('count_entities_as_keywords', False),
                        config.get('entity_recognition', False)
                    )
                    if not match_passes:
                        matched_str = ", ".join([f'"{k}"' for k in match_info["matched_keywords"]]) if match_info["matched_keywords"] else "none"
                        missing_str = ", ".join([f'"{k}"' for k in match_info["missing_keywords"]]) if match_info["missing_keywords"] else "none"
                        log_message("rejected", 
                            f"❌ REJECTED: \"{post.title[:60]}...\"\n              - Reason: Keyword match failed ({match_info['matched_count']}/{match_info['total_required']} keywords found)\n              - Matched: {matched_str} | Missing: {missing_str}",
                            post.id, 
                            f"Keyword mismatch: {match_info['matched_count']}/{match_info['total_required']}")
                        continue
                    sentiment_score = 0.0
                    sentiment_label = "neutral"
                    if config.get('sentiment_analysis', True):
                        sentiment_score, sentiment_label = analyze_sentiment(post.title + " " + (post.selftext or ""))
                    entities_data = []
                    if config.get('entity_recognition', False):
                        entities_data = extract_entities(post.title + " " + (post.selftext or ""))
                    comments_data = []
                    if scrape_comments_enabled:
                        comments_data = scrape_comments(post, max_comments, config.get('sentiment_analysis', True))
                    keywords_found = ", ".join(match_info["matched_keywords"]) if match_info["matched_keywords"] else keyword
                    post_data = {
                        "post_id": post.id,
                        "title": post.title,
                        "body": post.selftext or "",
                        "author": str(post.author) if post.author else "[deleted]",
                        "subreddit": post.subreddit.display_name,
                        "url": post.url,
                        "created_utc": datetime.fromtimestamp(post.created_utc).isoformat(),
                        "score": post.score,
                        "num_comments": post.num_comments,
                        "upvote_ratio": post.upvote_ratio,
                        "permalink": f"https://reddit.com{post.permalink}",
                        "link_flair_text": post.link_flair_text or "",
                        "over_18": post.over_18,
                        "spoiler": post.spoiler,
                        "stickied": post.stickied,
                        "sentiment_score": sentiment_score,
                        "sentiment_label": sentiment_label,
                        "entities": entities_data,
                        "comments": comments_data,
                        "keywords_found": keywords_found,
                        "collected_at": datetime.utcnow().isoformat() + 'Z',
                        "search_mode": "hybrid",
                        "batch_id": f"batch_{int(time.time())}",
                        "preset_name": preset.get('name', 'Unknown'),
                        "preset_id": preset.get('id', ''),
                        "keyword_used": keyword
                    }
                    try:
                        supabase.table('reddit_posts').insert(post_data).execute()
                        entity_info = ""
                        if match_info.get("entity_merges"):
                            merged_entities = []
                            for merge in match_info["entity_merges"]:
                                merged_entities.append(f"\"{merge['entity']}\" ({merge['label']})")
                            entity_info = f"\n              - Entities merged: {', '.join(merged_entities)}"
                        matched_kw_str = ", ".join([f'"{k}"' for k in match_info["matched_keywords"]])
                        log_message("success", 
                            f"✅ ACCEPTED: \"{post.title[:60]}...\"\n              - Matched {match_info['matched_count']}/{match_info['total_required']} keywords: {matched_kw_str}\n              - Score: {post.score} | Comments: {post.num_comments}{entity_info}",
                            post.id)
                        current_iteration_posts += 1
                        posts_collected += 1
                        cpu, ram = get_system_metrics()
                        elapsed = int(time.time() - start_time)
                        send_progress("running", f"r/{subreddit_name}: {keyword}", posts_collected, auto_stop_target or 5000, cpu, ram, elapsed, keyword_idx, total_keywords, subreddit_idx, total_subreddits, current_iteration_posts, max_posts_per_keyword, "hybrid")
                    except Exception as e:
                        categorize_and_log_error(e, f"Failed to save post '{post.title[:30]}...' to database")
            except Forbidden as e:
                categorize_and_log_error(e, f"r/{subreddit_name}")
                continue
            except Exception as e:
                categorize_and_log_error(e, f"r/{subreddit_name}")
                continue
            if current_iteration_posts > 0:
                log_message("info", f"r/{subreddit_name} + '{keyword}': {current_iteration_posts} posts collected")
            cpu, ram = get_system_metrics()
            elapsed = int(time.time() - start_time)
            send_progress("running", f"Completed r/{subreddit_name}: {keyword}", posts_collected, auto_stop_target or 5000, cpu, ram, elapsed, keyword_idx, total_keywords, subreddit_idx + 1, total_subreddits, 0, 0, "hybrid")
        cpu, ram = get_system_metrics()
        elapsed = int(time.time() - start_time)
        send_progress("running", f"Completed keyword: {keyword}", posts_collected, auto_stop_target or 5000, cpu, ram, elapsed, keyword_idx + 1, total_keywords, 0, total_subreddits, 0, 0, "hybrid")
    return posts_collected
def main():
    global stop_requested
    try:
        if len(sys.argv) < 2:
            log_message("error", "No configuration provided")
            sys.exit(1)
        data = json.loads(sys.argv[1])
        config = data.get('config', {})
        preset = data.get('preset', {})
        credentials = data.get('credentials', {})
        user_id = data.get('userId', '')
        if config.get('entity_recognition', False):
            load_spacy_model()
        reddit = praw.Reddit(
            client_id=credentials['client_id'],
            client_secret=credentials['client_secret'],
            user_agent=credentials['user_agent']
        )
        supabase: Client = create_client(
            credentials['supabase_url'],
            credentials['supabase_key']
        )
        rate_limit = config.get('rateLimit') or config.get('rate_limit', 60)
        rate_limiter = RateLimiter(rate_limit)
        log_message("info", f"Rate limit: {rate_limit} requests/minute")
        mode = preset.get('mode', 'keyword')
        subreddits = preset.get('subreddits', '')
        if isinstance(subreddits, list):
            subreddit_list = [s.strip() for s in subreddits if s.strip()]
        else:
            subreddit_list = [s.strip() for s in str(subreddits).split(',') if s.strip()]
        keywords = preset.get('keywords', '')
        if isinstance(keywords, list):
            keywords = ','.join(keywords)
        filters = config.get('filters', {})
        log_message("info", f"Starting scraper in {mode} mode")
        log_message("info", f"Subreddits: {', '.join(subreddit_list)}")
        if keywords:
            log_message("info", f"Keywords: {keywords}")
        auto_stop = config.get('auto_stop_target') or config.get('autoStopTarget')
        scrape_comments = config.get('scrape_comments') or config.get('scrapeComments', False)
        max_comments = config.get('max_comments_per_post') or config.get('maxCommentsPerPost', 5)
        if auto_stop:
            log_message("info", f"Auto-stop enabled: will stop at {auto_stop} posts")
        if scrape_comments:
            log_message("info", f"Comment scraping enabled: {max_comments} comments per post")
        start_time = time.time()
        posts_collected = 0
        if mode == 'keyword':
            posts_collected = scrape_keyword_mode(reddit, subreddit_list, keywords, config, filters, start_time, supabase, user_id, preset, rate_limiter)
        elif mode == 'deepscan':
            posts_collected = scrape_deepscan_mode(reddit, subreddit_list, config, filters, start_time, supabase, user_id, preset, rate_limiter)
        elif mode == 'hybrid':
            posts_collected = scrape_hybrid_mode(reddit, subreddit_list, keywords, config, filters, start_time, supabase, user_id, preset, rate_limiter)
        elapsed = int(time.time() - start_time)
        cpu, ram = get_system_metrics()
        send_progress("completed", "Scraping completed", posts_collected, posts_collected, cpu, ram, elapsed, 0, 0, 0, 0, 0, 0, mode)
        increment_total_posts(supabase, user_id, posts_collected)
        subreddit_names = ', '.join([f"r/{s}" for s in subreddit_list[:3]])
        if len(subreddit_list) > 3:
            subreddit_names += f" and {len(subreddit_list) - 3} more"
        activity_text = f"Scraped {posts_collected} posts from {subreddit_names}"
        if keywords:
            keyword_preview = keywords[:30] if len(keywords) > 30 else keywords
            activity_text += f" with keywords '{keyword_preview}...'" if len(keywords) > 30 else f" with keywords '{keywords}'"
        add_recent_activity(supabase, user_id, activity_text)
        if stop_requested:
            log_message("info", f"Scraping stopped by user: {posts_collected} posts collected in {elapsed}s")
            print(json.dumps({"type": "stopped", "data": {"total_posts": posts_collected, "elapsed_time": elapsed}}), flush=True)
        else:
            log_message("info", f"Scraping completed: {posts_collected} posts collected in {elapsed}s")
            print(json.dumps({"type": "complete", "data": {"total_posts": posts_collected, "elapsed_time": elapsed}}), flush=True)
    except Exception as e:
        log_message("error", f"Fatal error: {str(e)}")
        print(json.dumps({"type": "error", "data": {"message": str(e)}}), flush=True)
        sys.exit(1)
if __name__ == "__main__":
    main()