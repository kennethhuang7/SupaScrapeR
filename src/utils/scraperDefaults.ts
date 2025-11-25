import { ScraperConfig, ScraperFilters } from '../types/scraper'
export const DEFAULT_FILTERS: ScraperFilters = {
  min_comments: 0,
  min_score: 0,
  time_filter: 'all',
  exclude_stickied: false,
  exclude_over_18: false,
  strict_keyword_matching: false,
  count_entities_as_keywords: false
}
export const DEFAULT_SCRAPER_CONFIG: ScraperConfig = {
  preset_id: null,
  batch_size: 10,
  runtime_mode: 'once',
  auto_stop_target: null,
  entity_recognition: false,
  sentiment_analysis: true,
  max_posts_per_keyword: 50,
  max_posts_per_subreddit: 50,
  filters: { ...DEFAULT_FILTERS }
}
export function getDefaultConfig(): ScraperConfig {
  return JSON.parse(JSON.stringify(DEFAULT_SCRAPER_CONFIG))
}