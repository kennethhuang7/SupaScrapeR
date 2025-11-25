import React from 'react'
import { X, HelpCircle } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { ScraperFilters } from '@/types/scraper'

interface FilterSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  filters: ScraperFilters
  onSave: (filters: ScraperFilters) => void
  entityRecognitionEnabled: boolean
  onEntityRecognitionChange: (enabled: boolean) => void
}

export default function FilterSettingsModal({
  isOpen,
  onClose,
  filters,
  onSave,
  entityRecognitionEnabled,
  onEntityRecognitionChange
}: FilterSettingsModalProps) {
  const [localFilters, setLocalFilters] = React.useState<ScraperFilters>(filters)

  React.useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  React.useEffect(() => {
    setLocalFilters(prev => ({
      ...prev,
      count_entities_as_keywords: entityRecognitionEnabled
    }))
  }, [entityRecognitionEnabled])

  const handleSave = () => {
    onSave(localFilters)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-background border border-border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Filter Settings</h2>
            <p className="text-sm text-muted-foreground mt-1">Customize post filtering and keyword matching</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Basic Post Filters</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-medium">Minimum Comments</label>
                  <div className="group relative">
                    <HelpCircle size={14} className="text-muted-foreground cursor-help" />
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-[#0a0f1a] border-2 border-border rounded-lg text-xs shadow-2xl z-10 animate-in fade-in duration-200">
                      Minimum number of comments required. Set to 0 to disable this filter.
                    </div>
                  </div>
                </div>
                <input
                  type="number"
                  value={localFilters.min_comments}
                  onChange={(e) => setLocalFilters({...localFilters, min_comments: parseInt(e.target.value) || 0})}
                  className="w-full px-4 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  style={{ colorScheme: 'dark' }}
                  min="0"
                />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-medium">Minimum Score</label>
                  <div className="group relative">
                    <HelpCircle size={14} className="text-muted-foreground cursor-help" />
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-[#0a0f1a] border-2 border-border rounded-lg text-xs shadow-2xl z-10 animate-in fade-in duration-200">
                      Post score is upvotes minus downvotes on Reddit. Set to 0 to disable this filter.
                    </div>
                  </div>
                </div>
                <input
                  type="number"
                  value={localFilters.min_score}
                  onChange={(e) => setLocalFilters({...localFilters, min_score: parseInt(e.target.value) || 0})}
                  className="w-full px-4 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  style={{ colorScheme: 'dark' }}
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Time Filter</label>
                <CustomSelect
                  value={localFilters.time_filter}
                  onChange={(value) => setLocalFilters({...localFilters, time_filter: value as any})}
                  options={[
                    { value: 'hour', label: 'Past Hour' },
                    { value: 'day', label: 'Past Day' },
                    { value: 'week', label: 'Past Week' },
                    { value: 'month', label: 'Past Month' },
                    { value: 'year', label: 'Past Year' },
                    { value: 'all', label: 'All Time' }
                  ]}
                />
              </div>
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Exclude Stickied Posts</span>
                    <div className="group relative">
                      <HelpCircle size={14} className="text-muted-foreground cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-[#0a0f1a] border-2 border-border rounded-lg text-xs shadow-2xl z-10 animate-in fade-in duration-200">
                        Stickied posts are pinned to the top of a subreddit by moderators
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={localFilters.exclude_stickied}
                    onCheckedChange={(checked) => setLocalFilters({...localFilters, exclude_stickied: checked})}
                  />
                </label>
                <label className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Exclude NSFW Posts</span>
                    <div className="group relative">
                      <HelpCircle size={14} className="text-muted-foreground cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-[#0a0f1a] border-2 border-border rounded-lg text-xs shadow-2xl z-10 animate-in fade-in duration-200">
                        Filter out posts marked "Not Safe For Work"
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={localFilters.exclude_over_18}
                    onCheckedChange={(checked) => setLocalFilters({...localFilters, exclude_over_18: checked})}
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-6">
            <h3 className="text-lg font-semibold mb-2">Keyword Matching</h3>
            <p className="text-sm text-muted-foreground mb-4">Configure how keywords are matched in post titles</p>
            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">Require All Keywords</span>
                    <div className="group relative">
                      <HelpCircle size={14} className="text-muted-foreground cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 p-3 bg-[#0a0f1a] border-2 border-border rounded-lg text-xs shadow-2xl z-10 animate-in fade-in duration-200">
                        <strong>OFF (Flexible):</strong> For 3+ keywords, allows 1 to be missing. For 1-2 keywords, all must match.
                        <br /><br />
                        <strong>ON (Strict):</strong> All keywords must always be present in the post title.
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Strict vs. flexible keyword matching</p>
                </div>
                <Switch
                  checked={localFilters.strict_keyword_matching}
                  onCheckedChange={(checked) => setLocalFilters({...localFilters, strict_keyword_matching: checked})}
                />
              </label>
              <label className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">Count Entities as Keywords</span>
                    <div className="group relative">
                      <HelpCircle size={14} className="text-muted-foreground cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 p-3 bg-[#0a0f1a] border-2 border-border rounded-lg text-xs shadow-2xl z-10 animate-in fade-in duration-200">
                        When enabled, detected names and organizations count toward keyword matching. This setting is synced with Entity Recognition in your main config.
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Synced with Entity Recognition setting</p>
                </div>
                <Switch
                  checked={localFilters.count_entities_as_keywords}
                  onCheckedChange={(checked) => {
                    setLocalFilters({...localFilters, count_entities_as_keywords: checked})
                    onEntityRecognitionChange(checked)
                  }}
                />
              </label>
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-background border-t border-border p-6 flex gap-4">
          <button
            onClick={() => {
              setLocalFilters(filters)
              onClose()
            }}
            className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 border border-border rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 btn-gradient text-white font-medium rounded-lg hover:scale-105 transition-all"
          >
            Save Filters
          </button>
        </div>
      </div>
    </div>
  )
}