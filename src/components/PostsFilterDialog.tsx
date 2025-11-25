import { useState } from 'react'
import { X, ChevronDown, ChevronRight, ChevronLeft, Calendar } from 'lucide-react'

export interface PostsFilterState {
  searchQuery: string
  subreddit: string
  keyword: string
  preset: string
  author: string
  sentiment: { positive: boolean; negative: boolean; neutral: boolean }
  minScore: string
  minComments: string
  searchMode: { keyword: boolean; deepscan: boolean; hybrid: boolean }
  dateRange: {
    scrapedStart: string
    scrapedEnd: string
    publishedStart: string
    publishedEnd: string
  }
}

interface PostsFilterDialogProps {
  onClose: () => void
  onApply: (filters: PostsFilterState) => void
  initialFilters: PostsFilterState
  presetMap: {[key: string]: string}
}

interface CalendarPickerProps {
  selectedDate: Date | null
  onSelect: (date: Date) => void
  minDate?: Date
  maxDate?: Date
}

function CalendarPicker({ selectedDate, onSelect, minDate, maxDate }: CalendarPickerProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date())
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    const days: (Date | null)[] = []
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }
    return days
  }
  const isDateDisabled = (date: Date) => {
    if (minDate && date < minDate) return true
    if (maxDate && date > maxDate) return true
    return false
  }
  const isSameDay = (date1: Date | null, date2: Date | null) => {
    if (!date1 || !date2) return false
    return date1.getDate() === date2.getDate() && date1.getMonth() === date2.getMonth() && date1.getFullYear() === date2.getFullYear()
  }
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }
  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }
  const days = getDaysInMonth(currentMonth)
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={goToPreviousMonth} className="p-1 hover:bg-secondary rounded text-muted-foreground">
          <ChevronLeft size={20} />
        </button>
        <span className="font-semibold">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
        <button type="button" onClick={goToNextMonth} className="p-1 hover:bg-secondary rounded text-muted-foreground">
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {daysOfWeek.map(day => (
          <div key={day} className="text-center text-xs text-muted-foreground py-1">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} />
          }
          const disabled = isDateDisabled(day)
          const selected = isSameDay(day, selectedDate)
          return (
            <button
              type="button"
              key={index}
              onClick={() => !disabled && onSelect(day)}
              disabled={disabled}
              className={`p-2 text-sm rounded transition-colors ${
                selected ? 'bg-primary text-primary-foreground' : disabled ? 'text-muted-foreground opacity-30 cursor-not-allowed' : 'hover:bg-secondary'
              }`}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function PostsFilterDialog({ onClose, onApply, initialFilters, presetMap }: PostsFilterDialogProps) {
  const [filters, setFilters] = useState<PostsFilterState>(initialFilters)
  const [expandedSections, setExpandedSections] = useState({
    search: false,
    sentiment: false,
    searchMode: false,
    metrics: false,
    dates: false
  })
  const [activeCalendar, setActiveCalendar] = useState<string | null>(null)

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const handleApply = () => {
    onApply(filters)
    onClose()
  }

  const handleClear = () => {
    setFilters({
      searchQuery: '',
      subreddit: '',
      keyword: '',
      preset: '',
      author: '',
      sentiment: { positive: false, negative: false, neutral: false },
      minScore: '',
      minComments: '',
      searchMode: { keyword: false, deepscan: false, hybrid: false },
      dateRange: {
        scrapedStart: '',
        scrapedEnd: '',
        publishedStart: '',
        publishedEnd: ''
      }
    })
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const parseDateToString = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const searchCount = [filters.searchQuery, filters.subreddit, filters.keyword, filters.preset, filters.author].filter(v => v.trim()).length
  const sentimentCount = Object.values(filters.sentiment).filter(Boolean).length
  const searchModeCount = Object.values(filters.searchMode).filter(Boolean).length
  const metricsCount = [filters.minScore, filters.minComments].filter(v => v.trim()).length
  const datesCount = [filters.dateRange.scrapedStart, filters.dateRange.scrapedEnd, filters.dateRange.publishedStart, filters.dateRange.publishedEnd].filter(v => v.trim()).length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border p-6 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Filter Posts</h2>
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
                {searchCount > 0 && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{searchCount}</span>
                )}
              </div>
            </button>
            {expandedSections.search && (
              <div className="p-4 pt-0 space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Title or Body</label>
                  <input
                    type="text"
                    value={filters.searchQuery}
                    onChange={(e) => setFilters({...filters, searchQuery: e.target.value})}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Search in title or body..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Subreddit</label>
                  <input
                    type="text"
                    value={filters.subreddit}
                    onChange={(e) => setFilters({...filters, subreddit: e.target.value})}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., technology"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Author</label>
                  <input
                    type="text"
                    value={filters.author}
                    onChange={(e) => setFilters({...filters, author: e.target.value})}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="u/username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Keyword Used</label>
                  <input
                    type="text"
                    value={filters.keyword}
                    onChange={(e) => setFilters({...filters, keyword: e.target.value})}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Search keyword..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Preset Used</label>
                  <input
                    type="text"
                    value={filters.preset ? (presetMap[filters.preset] || '') : ''}
                    onChange={(e) => {
                      const inputValue = e.target.value
                      if (!inputValue) {
                        setFilters({...filters, preset: ''})
                      }
                    }}
                    list="preset-options"
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Preset name..."
                  />
                  <datalist id="preset-options">
                    {Object.entries(presetMap).map(([id, name]) => (
                      <option key={id} value={name} />
                    ))}
                  </datalist>
                </div>
              </div>
            )}
          </div>
          <div className="border border-border rounded-lg">
            <button
              onClick={() => toggleSection('sentiment')}
              className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors rounded-t-lg"
            >
              <div className="flex items-center gap-2">
                {expandedSections.sentiment ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                <span className="font-semibold">Sentiment</span>
                {sentimentCount > 0 && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{sentimentCount}</span>
                )}
              </div>
            </button>
            {expandedSections.sentiment && (
              <div className="p-4 pt-0 space-y-3">
                <label className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-colors">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={filters.sentiment.positive}
                      onChange={(e) => setFilters({...filters, sentiment: {...filters.sentiment, positive: e.target.checked}})}
                      className="peer sr-only"
                    />
                    <div className="w-5 h-5 border-2 border-border rounded bg-secondary/50 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                      {filters.sentiment.positive && (
                        <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span>Positive</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-colors">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={filters.sentiment.neutral}
                      onChange={(e) => setFilters({...filters, sentiment: {...filters.sentiment, neutral: e.target.checked}})}
                      className="peer sr-only"
                    />
                    <div className="w-5 h-5 border-2 border-border rounded bg-secondary/50 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                      {filters.sentiment.neutral && (
                        <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span>Neutral</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-colors">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={filters.sentiment.negative}
                      onChange={(e) => setFilters({...filters, sentiment: {...filters.sentiment, negative: e.target.checked}})}
                      className="peer sr-only"
                    />
                    <div className="w-5 h-5 border-2 border-border rounded bg-secondary/50 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                      {filters.sentiment.negative && (
                        <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span>Negative</span>
                </label>
              </div>
            )}
          </div>
          <div className="border border-border rounded-lg">
            <button
              onClick={() => toggleSection('searchMode')}
              className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors rounded-t-lg"
            >
              <div className="flex items-center gap-2">
                {expandedSections.searchMode ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                <span className="font-semibold">Search Mode</span>
                {searchModeCount > 0 && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{searchModeCount}</span>
                )}
              </div>
            </button>
            {expandedSections.searchMode && (
              <div className="p-4 pt-0 space-y-3">
                <label className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-colors">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={filters.searchMode.keyword}
                      onChange={(e) => setFilters({...filters, searchMode: {...filters.searchMode, keyword: e.target.checked}})}
                      className="peer sr-only"
                    />
                    <div className="w-5 h-5 border-2 border-border rounded bg-secondary/50 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                      {filters.searchMode.keyword && (
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
                      checked={filters.searchMode.deepscan}
                      onChange={(e) => setFilters({...filters, searchMode: {...filters.searchMode, deepscan: e.target.checked}})}
                      className="peer sr-only"
                    />
                    <div className="w-5 h-5 border-2 border-border rounded bg-secondary/50 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                      {filters.searchMode.deepscan && (
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
                      checked={filters.searchMode.hybrid}
                      onChange={(e) => setFilters({...filters, searchMode: {...filters.searchMode, hybrid: e.target.checked}})}
                      className="peer sr-only"
                    />
                    <div className="w-5 h-5 border-2 border-border rounded bg-secondary/50 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                      {filters.searchMode.hybrid && (
                        <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span>Hybrid</span>
                </label>
              </div>
            )}
          </div>
          <div className="border border-border rounded-lg">
            <button
              onClick={() => toggleSection('metrics')}
              className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors rounded-t-lg"
            >
              <div className="flex items-center gap-2">
                {expandedSections.metrics ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                <span className="font-semibold">Post Metrics</span>
                {metricsCount > 0 && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{metricsCount}</span>
                )}
              </div>
            </button>
            {expandedSections.metrics && (
              <div className="p-4 pt-0 space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Minimum Score</label>
                  <input
                    type="number"
                    value={filters.minScore}
                    onChange={(e) => setFilters({...filters, minScore: e.target.value})}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Minimum Comments</label>
                  <input
                    type="number"
                    value={filters.minComments}
                    onChange={(e) => setFilters({...filters, minComments: e.target.value})}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="border border-border rounded-lg">
            <button
              onClick={() => toggleSection('dates')}
              className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors rounded-t-lg"
            >
              <div className="flex items-center gap-2">
                {expandedSections.dates ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                <span className="font-semibold">Date Ranges</span>
                {datesCount > 0 && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{datesCount}</span>
                )}
              </div>
            </button>
            {expandedSections.dates && (
              <div className="p-4 pt-0 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Scraped Date Range (when collected)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="relative">
                        <input
                          type="text"
                          value={formatDate(filters.dateRange.scrapedStart)}
                          readOnly
                          onClick={() => setActiveCalendar(activeCalendar === 'scrapedStart' ? null : 'scrapedStart')}
                          className="w-full px-4 py-2 pr-10 bg-background border border-border rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="Start date"
                        />
                        <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      </div>
                      {activeCalendar === 'scrapedStart' && (
                        <div className="mt-2">
                          <CalendarPicker
                            selectedDate={filters.dateRange.scrapedStart ? new Date(filters.dateRange.scrapedStart) : null}
                            onSelect={(date) => {
                              setFilters({...filters, dateRange: {...filters.dateRange, scrapedStart: parseDateToString(date)}})
                              setActiveCalendar(null)
                            }}
                            maxDate={new Date()}
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="relative">
                        <input
                          type="text"
                          value={formatDate(filters.dateRange.scrapedEnd)}
                          readOnly
                          onClick={() => setActiveCalendar(activeCalendar === 'scrapedEnd' ? null : 'scrapedEnd')}
                          className="w-full px-4 py-2 pr-10 bg-background border border-border rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="End date"
                        />
                        <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      </div>
                      {activeCalendar === 'scrapedEnd' && (
                        <div className="mt-2">
                          <CalendarPicker
                            selectedDate={filters.dateRange.scrapedEnd ? new Date(filters.dateRange.scrapedEnd) : null}
                            onSelect={(date) => {
                              setFilters({...filters, dateRange: {...filters.dateRange, scrapedEnd: parseDateToString(date)}})
                              setActiveCalendar(null)
                            }}
                            minDate={filters.dateRange.scrapedStart ? new Date(filters.dateRange.scrapedStart) : undefined}
                            maxDate={new Date()}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Published Date Range (when posted)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="relative">
                        <input
                          type="text"
                          value={formatDate(filters.dateRange.publishedStart)}
                          readOnly
                          onClick={() => setActiveCalendar(activeCalendar === 'publishedStart' ? null : 'publishedStart')}
                          className="w-full px-4 py-2 pr-10 bg-background border border-border rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="Start date"
                        />
                        <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      </div>
                      {activeCalendar === 'publishedStart' && (
                        <div className="mt-2">
                          <CalendarPicker
                            selectedDate={filters.dateRange.publishedStart ? new Date(filters.dateRange.publishedStart) : null}
                            onSelect={(date) => {
                              setFilters({...filters, dateRange: {...filters.dateRange, publishedStart: parseDateToString(date)}})
                              setActiveCalendar(null)
                            }}
                            maxDate={new Date()}
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="relative">
                        <input
                          type="text"
                          value={formatDate(filters.dateRange.publishedEnd)}
                          readOnly
                          onClick={() => setActiveCalendar(activeCalendar === 'publishedEnd' ? null : 'publishedEnd')}
                          className="w-full px-4 py-2 pr-10 bg-background border border-border rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="End date"
                        />
                        <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      </div>
                      {activeCalendar === 'publishedEnd' && (
                        <div className="mt-2">
                          <CalendarPicker
                            selectedDate={filters.dateRange.publishedEnd ? new Date(filters.dateRange.publishedEnd) : null}
                            onSelect={(date) => {
                              setFilters({...filters, dateRange: {...filters.dateRange, publishedEnd: parseDateToString(date)}})
                              setActiveCalendar(null)
                            }}
                            minDate={filters.dateRange.publishedStart ? new Date(filters.dateRange.publishedStart) : undefined}
                            maxDate={new Date()}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="sticky bottom-0 bg-card border-t border-border p-6 z-10">
          <div className="flex gap-3">
            <button
              onClick={handleClear}
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