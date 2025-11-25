import { ScraperConfig } from '../types/scraper'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateScraperConfig(config: ScraperConfig): ValidationResult {
  const errors: string[] = []
  if (!config.preset_id) {
    errors.push('Please select a preset before running the scraper')
  }
  if (config.batch_size < 1 || config.batch_size > 100) {
    errors.push('Batch size must be between 1 and 100')
  }
  if (config.auto_stop_target !== null && config.auto_stop_target < 1) {
    errors.push('Auto-stop target must be at least 1 post')
  }
  if (config.max_posts_per_keyword < 1 || config.max_posts_per_keyword > 1000) {
    errors.push('Max posts per keyword must be between 1 and 1000')
  }
  if (config.max_posts_per_subreddit < 1 || config.max_posts_per_subreddit > 1000) {
    errors.push('Max posts per subreddit must be between 1 and 1000')
  }
  if (config.filters.min_comments < 0) {
    errors.push('Minimum comments cannot be negative')
  }
  if (config.filters.min_score < 0) {
    errors.push('Minimum score cannot be negative')
  }
  return {
    valid: errors.length === 0,
    errors
  }
}

export function shouldShowKeywordFields(presetMode: string): boolean {
  return presetMode === 'keyword' || presetMode === 'hybrid'
}

export function shouldShowDeepscanFields(presetMode: string): boolean {
  return presetMode === 'deepscan' || presetMode === 'hybrid'
}