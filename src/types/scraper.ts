export interface ScraperConfig {
preset_id: string | null
batch_size: number
runtime_mode: 'once' | 'infinite'
auto_stop_target: number | null
entity_recognition: boolean
sentiment_analysis: boolean
max_posts_per_keyword: number
max_posts_per_subreddit: number
filters: ScraperFilters
}
export interface ScraperFilters {
  min_comments: number
  min_score: number
  time_filter: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all'
  exclude_stickied: boolean
  exclude_over_18: boolean
  strict_keyword_matching: boolean
  count_entities_as_keywords: boolean
}
export interface ScraperProgress {
status: 'idle' | 'running' | 'paused' | 'stopped' | 'completed'
current_target: string
posts_collected: number
total_target: number
cpu_usage: number
ram_usage: number
elapsed_time: number
current_batch: number
total_batches: number
}
export interface ScraperLogEntry {
timestamp: string
type: 'success' | 'rejected' | 'error' | 'info'
message: string
post_id?: string
reason?: string
}
export interface RecentActivity {
id: string
user_id: string
action_text: string
created_at: string
}
export interface PresetWithConfig {
id: string
user_id: string
name: string
description: string
keywords: string
subreddits: string
mode: string
config: any
created_at: string
updated_at: string
is_public: boolean
}
export interface ScraperStats {
total_posts: number
session_posts: number
total_presets: number
public_presets: number
public_preset_downloads: number
}