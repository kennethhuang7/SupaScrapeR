import { useState, useEffect } from 'react'
import { X, ChevronDown, ChevronRight } from 'lucide-react'
interface FilterDialogProps {
  onClose: () => void
  onApply: (filters: FilterState) => void
  initialFilters: FilterState
  showAuthorSearch?: boolean
  showPresetSourceFilter?: boolean
}
export interface FilterState {
  searchTitle: string
  searchDescription: string
  searchAuthor: string
  modes: {
    keyword: boolean
    deepscan: boolean
    both: boolean
  }
  presetSource?: {
    created: boolean
    downloaded: boolean
  }
  keywords: {
    include: string
    exclude: string
  }
  subreddits: {
    include: string
    exclude: string
  }
  subredditsBoth: {
    keywordInclude: string
    keywordExclude: string
    deepscanInclude: string
    deepscanExclude: string
  }
}
export default function FilterDialog({ onClose, onApply, initialFilters, showAuthorSearch = true, showPresetSourceFilter = false }: FilterDialogProps) {
  const [filters, setFilters] = useState<FilterState>(initialFilters)
  const [expandedSections, setExpandedSections] = useState({
    search: false,
    mode: false,
    presetSource: false,
    keywords: false,
    subreddits: false
  })
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }
  const hasSearchText = filters.searchTitle.trim().length > 0 || 
                        filters.searchDescription.trim().length > 0 || 
                        (showAuthorSearch && filters.searchAuthor.trim().length > 0)
  const selectedModesCount = Object.values(filters.modes).filter(Boolean).length
  const selectedPresetSourceCount = filters.presetSource ? Object.values(filters.presetSource).filter(Boolean).length : 0
  const isBothModeSelected = filters.modes.both
  const isKeywordApplicable = filters.modes.keyword || filters.modes.both
  const keywordCount = [
    filters.keywords.include.trim(),
    filters.keywords.exclude.trim()
  ].filter(v => v.length > 0).length
  const subredditCount = isBothModeSelected
    ? [
        filters.subredditsBoth.keywordInclude.trim(),
        filters.subredditsBoth.keywordExclude.trim(),
        filters.subredditsBoth.deepscanInclude.trim(),
        filters.subredditsBoth.deepscanExclude.trim()
      ].filter(v => v.length > 0).length
    : [
        filters.subreddits.include.trim(),
        filters.subreddits.exclude.trim()
      ].filter(v => v.length > 0).length
  const handleClearAll = () => {
    setFilters({
      searchTitle: '',
      searchDescription: '',
      searchAuthor: '',
      modes: { keyword: false, deepscan: false, both: false },
      presetSource: showPresetSourceFilter ? { created: false, downloaded: false } : undefined,
      keywords: { include: '', exclude: '' },
      subreddits: { include: '', exclude: '' },
      subredditsBoth: {
        keywordInclude: '',
        keywordExclude: '',
        deepscanInclude: '',
        deepscanExclude: ''
      }
    })
  }
  const handleApply = () => {
    onApply(filters)
    onClose()
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border p-6 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Filter Presets</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X size={24} />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="border border-border rounded-lg">
            <button
              onClick={() => toggleSection('search')}
              className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors rounded-t-lg"
            >
              <div className="flex items-center gap-2">
                {expandedSections.search ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                <span className="font-semibold">Search</span>
                {hasSearchText && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                    {[filters.searchTitle, filters.searchDescription, filters.searchAuthor].filter(v => v.trim()).length}
                  </span>
                )}
              </div>
            </button>
            {expandedSections.search && (
              <div className="p-4 pt-0 space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Search by Title</label>
                  <input
                    type="text"
                    value={filters.searchTitle}
                    onChange={(e) => setFilters({ ...filters, searchTitle: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter title..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Search by Description</label>
                  <input
                    type="text"
                    value={filters.searchDescription}
                    onChange={(e) => setFilters({ ...filters, searchDescription: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter description..."
                  />
                </div>
                {showAuthorSearch && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Search by Author</label>
                    <input
                      type="text"
                      value={filters.searchAuthor}
                      onChange={(e) => setFilters({ ...filters, searchAuthor: e.target.value })}
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Enter username..."
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="border border-border rounded-lg">
            <button
              onClick={() => toggleSection('mode')}
              className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors rounded-t-lg"
            >
              <div className="flex items-center gap-2">
                {expandedSections.mode ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                <span className="font-semibold">Mode</span>
                {selectedModesCount > 0 && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{selectedModesCount}</span>
                )}
              </div>
            </button>
            {expandedSections.mode && (
              <div className="p-4 pt-0 space-y-3">
                <label className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-colors">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={filters.modes.keyword}
                      onChange={(e) => setFilters({ ...filters, modes: { ...filters.modes, keyword: e.target.checked } })}
                      className="peer sr-only"
                    />
                    <div className="w-5 h-5 border-2 border-border rounded bg-secondary/50 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                      {filters.modes.keyword && (
                        <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span>Keyword</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-colors">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={filters.modes.deepscan}
                      onChange={(e) => setFilters({ ...filters, modes: { ...filters.modes, deepscan: e.target.checked } })}
                      className="peer sr-only"
                    />
                    <div className="w-5 h-5 border-2 border-border rounded bg-secondary/50 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                      {filters.modes.deepscan && (
                        <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span>DeepScan</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-colors">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={filters.modes.both}
                      onChange={(e) => setFilters({ ...filters, modes: { ...filters.modes, both: e.target.checked } })}
                      className="peer sr-only"
                    />
                    <div className="w-5 h-5 border-2 border-border rounded bg-secondary/50 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                      {filters.modes.both && (
                        <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span>Keyword & DeepScan</span>
                </label>
              </div>
            )}
          </div>
          {showPresetSourceFilter && (
            <div className="border border-border rounded-lg">
              <button
                onClick={() => toggleSection('presetSource')}
                className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors rounded-t-lg"
              >
                <div className="flex items-center gap-2">
                  {expandedSections.presetSource ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <span className="font-semibold">Preset Source</span>
                  {selectedPresetSourceCount > 0 && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{selectedPresetSourceCount}</span>
                  )}
                </div>
              </button>
              {expandedSections.presetSource && (
                <div className="p-4 pt-0 space-y-3">
                  <label className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-colors">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={filters.presetSource?.created || false}
                        onChange={(e) => setFilters({ ...filters, presetSource: { ...filters.presetSource, created: e.target.checked, downloaded: filters.presetSource?.downloaded || false } })}
                        className="peer sr-only"
                      />
                      <div className="w-5 h-5 border-2 border-border rounded bg-secondary/50 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                        {filters.presetSource?.created && (
                          <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span>Created by Me</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-colors">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={filters.presetSource?.downloaded || false}
                        onChange={(e) => setFilters({ ...filters, presetSource: { created: filters.presetSource?.created || false, downloaded: e.target.checked } })}
                        className="peer sr-only"
                      />
                      <div className="w-5 h-5 border-2 border-border rounded bg-secondary/50 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                        {filters.presetSource?.downloaded && (
                          <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span>Downloaded from Community</span>
                  </label>
                </div>
              )}
            </div>
          )}
          <div className={`border border-border rounded-lg ${!isKeywordApplicable ? 'opacity-50' : ''}`}>
            <button
              onClick={() => isKeywordApplicable && toggleSection('keywords')}
              disabled={!isKeywordApplicable}
              className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors rounded-t-lg disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <div className="flex items-center gap-2">
                {expandedSections.keywords ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                <span className="font-semibold">Keywords</span>
                {keywordCount > 0 && isKeywordApplicable && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{keywordCount}</span>
                )}
              </div>
            </button>
            {expandedSections.keywords && isKeywordApplicable && (
              <div className="p-4 pt-0 space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Include Keywords</label>
                  <input
                    type="text"
                    value={filters.keywords.include}
                    onChange={(e) => setFilters({ ...filters, keywords: { ...filters.keywords, include: e.target.value } })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="AI, python, react (comma-separated)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Separate multiple keywords with commas</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Exclude Keywords</label>
                  <input
                    type="text"
                    value={filters.keywords.exclude}
                    onChange={(e) => setFilters({ ...filters, keywords: { ...filters.keywords, exclude: e.target.value } })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="beginner, tutorial (comma-separated)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Separate multiple keywords with commas</p>
                </div>
              </div>
            )}
          </div>
          <div className="border border-border rounded-lg">
            <button
              onClick={() => toggleSection('subreddits')}
              className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors rounded-t-lg"
            >
              <div className="flex items-center gap-2">
                {expandedSections.subreddits ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                <span className="font-semibold">Subreddits</span>
                {subredditCount > 0 && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{subredditCount}</span>
                )}
              </div>
            </button>
            {expandedSections.subreddits && (
              <div className="p-4 pt-0 space-y-3">
                {isBothModeSelected ? (
                  <>
                    <div className="space-y-3 p-3 bg-secondary/20 rounded-lg">
                      <p className="text-sm font-semibold text-muted-foreground">Keyword Subreddits</p>
                      <div>
                        <label className="block text-sm font-medium mb-2">Include</label>
                        <input
                          type="text"
                          value={filters.subredditsBoth.keywordInclude}
                          onChange={(e) => setFilters({ ...filters, subredditsBoth: { ...filters.subredditsBoth, keywordInclude: e.target.value } })}
                          className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="technology, programming (comma-separated)"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Separate multiple subreddits with commas</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Exclude</label>
                        <input
                          type="text"
                          value={filters.subredditsBoth.keywordExclude}
                          onChange={(e) => setFilters({ ...filters, subredditsBoth: { ...filters.subredditsBoth, keywordExclude: e.target.value } })}
                          className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="learnprogramming (comma-separated)"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Separate multiple subreddits with commas</p>
                      </div>
                    </div>
                    <div className="space-y-3 p-3 bg-secondary/20 rounded-lg">
                      <p className="text-sm font-semibold text-muted-foreground">DeepScan Subreddits</p>
                      <div>
                        <label className="block text-sm font-medium mb-2">Include</label>
                        <input
                          type="text"
                          value={filters.subredditsBoth.deepscanInclude}
                          onChange={(e) => setFilters({ ...filters, subredditsBoth: { ...filters.subredditsBoth, deepscanInclude: e.target.value } })}
                          className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="AskReddit, science (comma-separated)"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Separate multiple subreddits with commas</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Exclude</label>
                        <input
                          type="text"
                          value={filters.subredditsBoth.deepscanExclude}
                          onChange={(e) => setFilters({ ...filters, subredditsBoth: { ...filters.subredditsBoth, deepscanExclude: e.target.value } })}
                          className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="politics (comma-separated)"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Separate multiple subreddits with commas</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Include Subreddits</label>
                      <input
                        type="text"
                        value={filters.subreddits.include}
                        onChange={(e) => setFilters({ ...filters, subreddits: { ...filters.subreddits, include: e.target.value } })}
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="technology, programming (comma-separated)"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Separate multiple subreddits with commas</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Exclude Subreddits</label>
                      <input
                        type="text"
                        value={filters.subreddits.exclude}
                        onChange={(e) => setFilters({ ...filters, subreddits: { ...filters.subreddits, exclude: e.target.value } })}
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="learnprogramming (comma-separated)"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Separate multiple subreddits with commas</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="sticky bottom-0 bg-card border-t border-border p-6 z-10">
          <div className="flex gap-3">
            <button
              onClick={handleClearAll}
              className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg font-medium transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={handleApply}
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}