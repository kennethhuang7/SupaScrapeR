import { useState, useEffect } from 'react'
import { TrendingUp, Users, Download, FileText, BarChart3, Activity, Calendar, Maximize2, Minimize2, ChevronLeft, ChevronRight } from 'lucide-react'
import { getScraperStats, getPersonalPostsOverTime, getSupabase } from '@/lib/supabase'
import { ScraperStats } from '@/types/scraper'
import { AuthService } from '@/services/auth'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useNavigate } from 'react-router-dom'

type TimeRange = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL' | 'CUSTOM'

interface CalendarPickerProps {
  selectedDate: Date | null
  onSelect: (date: Date) => void
  minDate?: Date
  maxDate?: Date
}

interface TopItem {
  name: string
  count: number
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
        <button onClick={goToPreviousMonth} className="p-1 hover:bg-secondary rounded">
          <ChevronLeft size={20} />
        </button>
        <span className="font-semibold">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
        <button onClick={goToNextMonth} className="p-1 hover:bg-secondary rounded">
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

export default function StatisticsPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<ScraperStats>({
    total_posts: 0,
    session_posts: 0,
    total_presets: 0,
    public_presets: 0,
    public_preset_downloads: 0
  })
  const [chartData, setChartData] = useState<{ date: string; count: number }[]>([])
  const [timeRange, setTimeRange] = useState<TimeRange>('1M')
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null)
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null)
  const [showStartCalendar, setShowStartCalendar] = useState(false)
  const [showEndCalendar, setShowEndCalendar] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const [topSubreddits, setTopSubreddits] = useState<TopItem[]>([])
  const [topKeywords, setTopKeywords] = useState<TopItem[]>([])
  const [topPresets, setTopPresets] = useState<TopItem[]>([])
  const [recentActivity, setRecentActivity] = useState<any[]>([])

  useEffect(() => {
    loadStatistics()
    loadAnalytics()
  }, [])

  useEffect(() => {
    if (user?.id && timeRange !== 'CUSTOM') {
      loadChartData()
    }
  }, [timeRange, user])

  const loadStatistics = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser()
      if (currentUser?.id) {
        setUser(currentUser)
        const scraperStats = await getScraperStats(currentUser.id)
        setStats(scraperStats)
        setLoading(false)
      }
    } catch (error) {
      console.error('Failed to load statistics:', error)
      setLoading(false)
    }
  }

  const loadAnalytics = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser()
      if (!currentUser?.id) return
      const supabase = getSupabase(currentUser.id)
      const { data: subredditData } = await supabase
        .from('reddit_posts')
        .select('subreddit')
      const subredditCounts: { [key: string]: number } = {}
      subredditData?.forEach(post => {
        if (post.subreddit) {
          subredditCounts[post.subreddit] = (subredditCounts[post.subreddit] || 0) + 1
        }
      })
      const topSubs = Object.entries(subredditCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
      setTopSubreddits(topSubs)
      const { data: keywordData } = await supabase
        .from('reddit_posts')
        .select('keyword_used')
      const keywordCounts: { [key: string]: number } = {}
      keywordData?.forEach(post => {
        if (post.keyword_used) {
          keywordCounts[post.keyword_used] = (keywordCounts[post.keyword_used] || 0) + 1
        }
      })
      const topKws = Object.entries(keywordCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
      setTopKeywords(topKws)
      const { data: presetData } = await supabase
        .from('reddit_posts')
        .select('preset_id, preset_name')
      const presetCounts: { [key: string]: { name: string, count: number } } = {}
      presetData?.forEach(post => {
        if (post.preset_id) {
          if (!presetCounts[post.preset_id]) {
            presetCounts[post.preset_id] = { name: post.preset_name || 'Unknown', count: 0 }
          }
          presetCounts[post.preset_id].count++
        }
      })
      const topPres = Object.entries(presetCounts)
        .map(([id, data]) => ({ name: data.name, count: data.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
      setTopPresets(topPres)
      const { data: activityData } = await supabase
        .from('reddit_posts')
        .select('id, title, subreddit, collected_at')
        .order('collected_at', { ascending: false })
        .limit(10)
      setRecentActivity(activityData || [])
    } catch (error) {
      console.error('Failed to load analytics:', error)
    }
  }

  const loadChartData = async () => {
    setChartLoading(true)
    try {
      const data = await getPersonalPostsOverTime(timeRange as '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL')
      setChartData(data)
    } catch (error) {
      console.error('Failed to load chart data:', error)
    } finally {
      setChartLoading(false)
    }
  }

  const loadCustomRangeData = async () => {
    if (!customStartDate || !customEndDate) {
      return
    }
    setChartLoading(true)
    try {
      const data = await getPersonalPostsOverTime('ALL')
      const start = new Date(customStartDate)
      const end = new Date(customEndDate)
      end.setHours(23, 59, 59, 999)
      const filtered = data.filter(item => {
        const itemDate = new Date(item.date)
        return itemDate >= start && itemDate <= end
      })
      setChartData(filtered)
    } catch (error) {
      console.error('Failed to load custom range data:', error)
    } finally {
      setChartLoading(false)
    }
  }

  const handleCustomRangeApply = () => {
    if (!customStartDate || !customEndDate) {
      return
    }
    if (customStartDate > customEndDate) {
      alert('Start date must be before end date')
      return
    }
    setTimeRange('CUSTOM')
    setShowCustomPicker(false)
    loadCustomRangeData()
  }

  const formatDate = (date: Date | null) => {
    if (!date) return ''
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatXAxis = (value: string) => {
    const date = new Date(value)
    if (timeRange === '1D') {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
    } else if (timeRange === '1W' || timeRange === '1M' || timeRange === 'CUSTOM') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    }
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const date = new Date(payload[0].payload.date)
      let formattedDate = ''
      if (timeRange === '1D') {
        formattedDate = date.toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          hour: 'numeric', 
          hour12: true 
        })
      } else {
        formattedDate = date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        })
      }
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm text-muted-foreground mb-1">{formattedDate}</p>
          <p className="text-lg font-bold text-primary">{payload[0].value} posts</p>
        </div>
      )
    }
    return null
  }

  const handleFilterClick = (type: 'subreddit' | 'keyword' | 'preset', value: string) => {
    navigate(`/posts?${type}=${encodeURIComponent(value)}`)
  }

  const ChartComponent = ({ fullscreen = false }) => (
    <div className={fullscreen ? 'p-8' : ''}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className={`font-bold ${fullscreen ? 'text-3xl' : 'text-xl'}`}>Posts Collected Over Time</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {(() => {
              const now = new Date()
              let startDate: Date
              let endDate = now
              switch (timeRange) {
                case '1D':
                  startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
                  return `Showing data for ${formatDate(startDate)}`
                case '1W':
                  startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                  return `Showing data from ${formatDate(startDate)} to ${formatDate(endDate)}`
                case '1M':
                  startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                  return `Showing data from ${formatDate(startDate)} to ${formatDate(endDate)}`
                case '3M':
                  startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
                  return `Showing data from ${formatDate(startDate)} to ${formatDate(endDate)}`
                case '1Y':
                  startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
                  return `Showing data from ${formatDate(startDate)} to ${formatDate(endDate)}`
                case 'ALL':
                  return 'Showing all-time data'
                case 'CUSTOM':
                  if (customStartDate && customEndDate) {
                    return `Showing data from ${formatDate(customStartDate)} to ${formatDate(customEndDate)}`
                  }
                  return 'Select a custom date range'
                default:
                  return 'Track your scraping activity and growth'
              }
            })()}
          </p>
        </div>
        <div className="flex gap-2 relative">
          {(['1D', '1W', '1M', '3M', '1Y', 'ALL'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-secondary/80 text-foreground'
              }`}
            >
              {range}
            </button>
          ))}
          <button
            onClick={() => setShowCustomPicker(!showCustomPicker)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
              timeRange === 'CUSTOM'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80 text-foreground'
            }`}
          >
            <Calendar size={14} />
            Custom
          </button>
          {!fullscreen && (
            <button
              onClick={() => setIsFullscreen(true)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-secondary hover:bg-secondary/80 text-foreground flex items-center gap-1"
            >
              <Maximize2 size={14} />
            </button>
          )}
          {fullscreen && (
            <button
              onClick={() => setIsFullscreen(false)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-secondary hover:bg-secondary/80 text-foreground flex items-center gap-1"
            >
              <Minimize2 size={14} />
            </button>
          )}
          {showCustomPicker && (
            <div className="absolute top-12 right-0 bg-card border border-border rounded-lg shadow-lg p-4 z-50 min-w-[300px]">
              <h3 className="font-semibold mb-3">Custom Date Range</h3>
              <div className="space-y-3">
                <div className="relative">
                  <label className="block text-sm font-medium mb-1">From</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formatDate(customStartDate)}
                      readOnly
                      onClick={() => {
                        setShowStartCalendar(!showStartCalendar)
                        setShowEndCalendar(false)
                      }}
                      className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Select start date"
                    />
                    <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  </div>
                  {showStartCalendar && (
                    <div className="absolute top-full mt-1 z-50">
                      <CalendarPicker
                        selectedDate={customStartDate}
                        onSelect={(date) => {
                          setCustomStartDate(date)
                          setShowStartCalendar(false)
                        }}
                        maxDate={new Date()}
                      />
                    </div>
                  )}
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium mb-1">To</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formatDate(customEndDate)}
                      readOnly
                      onClick={() => {
                        setShowEndCalendar(!showEndCalendar)
                        setShowStartCalendar(false)
                      }}
                      className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Select end date"
                    />
                    <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  </div>
                  {showEndCalendar && (
                    <div className="absolute top-full mt-1 z-50">
                      <CalendarPicker
                        selectedDate={customEndDate}
                        onSelect={(date) => {
                          setCustomEndDate(date)
                          setShowEndCalendar(false)
                        }}
                        minDate={customStartDate || undefined}
                        maxDate={new Date()}
                      />
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setShowCustomPicker(false)
                      setCustomStartDate(null)
                      setCustomEndDate(null)
                      setShowStartCalendar(false)
                      setShowEndCalendar(false)
                    }}
                    className="flex-1 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCustomRangeApply}
                    disabled={!customStartDate || !customEndDate}
                    className="flex-1 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {chartLoading ? (
        <div className="flex items-center justify-center py-32">
          <Activity className="w-8 h-8 text-primary animate-pulse" />
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <BarChart3 className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No data available for this time range</p>
            <p className="text-xs text-muted-foreground mt-2">Start scraping to see your activity here</p>
          </div>
        </div>
      ) : (
        <div className="relative">
          <ResponsiveContainer width="100%" height={fullscreen ? 600 : 400}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatXAxis}
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '12px' }}
              />
              <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 1000 }} />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 animate-fade-in">
        <div className="text-center">
          <Activity className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading statistics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">Statistics</h1>
        <p className="text-muted-foreground mt-1">View your scraping performance and analytics</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="glass-card rounded-xl p-6 card-hover">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <FileText className="text-blue-500" size={24} />
            </div>
            <TrendingUp className="text-green-500" size={20} />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Posts</h3>
          <p className="text-3xl font-bold">{stats.total_posts.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2">All time scraped posts</p>
        </div>
        <div className="glass-card rounded-xl p-6 card-hover">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
              <BarChart3 className="text-green-500" size={24} />
            </div>
            <TrendingUp className="text-green-500" size={20} />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Presets</h3>
          <p className="text-3xl font-bold">{stats.total_presets}</p>
          <p className="text-xs text-muted-foreground mt-2">Saved configurations</p>
        </div>
        <div className="glass-card rounded-xl p-6 card-hover">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <Users className="text-purple-500" size={24} />
            </div>
            <TrendingUp className="text-purple-500" size={20} />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground mb-1">Public Presets</h3>
          <p className="text-3xl font-bold">{stats.public_presets}</p>
          <p className="text-xs text-muted-foreground mt-2">Shared with community</p>
        </div>
        <div className="glass-card rounded-xl p-6 card-hover">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center">
              <Download className="text-orange-500" size={24} />
            </div>
            <TrendingUp className="text-orange-500" size={20} />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground mb-1">Preset Downloads</h3>
          <p className="text-3xl font-bold">{stats.public_preset_downloads}</p>
          <p className="text-xs text-muted-foreground mt-2">Total downloads of your presets</p>
        </div>
      </div>
      <div className="glass-card rounded-xl p-6 mb-6">
        <ChartComponent />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-bold mb-2">Recent Activity</h2>
          <p className="text-sm text-muted-foreground mb-6">Your latest scraping sessions</p>
          {recentActivity.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Activity className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No recent activity</p>
                <p className="text-xs text-muted-foreground mt-2">Start scraping to see activity here</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">r/{activity.subreddit}</p>
                  </div>
                  <span className="text-xs text-muted-foreground ml-2">
                    {new Date(activity.collected_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-bold mb-2">Top Performing Subreddits</h2>
          <p className="text-sm text-muted-foreground mb-6">See which communities yield the most data</p>
          {topSubreddits.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <TrendingUp className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No subreddit data yet</p>
                <p className="text-xs text-muted-foreground mt-2">Start scraping to see your top subreddits</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {topSubreddits.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleFilterClick('subreddit', item.name)}
                  className="w-full flex items-center justify-between p-3 bg-secondary/30 rounded-lg hover:bg-primary/20 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">#{idx + 1}</span>
                    <span className="text-sm font-medium">r/{item.name}</span>
                  </div>
                  <span className="text-sm text-primary font-semibold">{item.count} posts</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-bold mb-2">Top Keywords</h2>
          <p className="text-sm text-muted-foreground mb-6">Most successful keywords from your searches</p>
          {topKeywords.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <BarChart3 className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No keyword data yet</p>
                <p className="text-xs text-muted-foreground mt-2">Start scraping with keywords to see results</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {topKeywords.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleFilterClick('keyword', item.name)}
                  className="w-full flex items-center justify-between p-3 bg-secondary/30 rounded-lg hover:bg-primary/20 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">#{idx + 1}</span>
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <span className="text-sm text-primary font-semibold">{item.count} posts</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-bold mb-2">Preset Performance</h2>
          <p className="text-sm text-muted-foreground mb-6">Track your most used configurations</p>
          {topPresets.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Users className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No preset data yet</p>
                <p className="text-xs text-muted-foreground mt-2">Start scraping to see preset performance</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {topPresets.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleFilterClick('preset', item.name)}
                  className="w-full flex items-center justify-between p-3 bg-secondary/30 rounded-lg hover:bg-primary/20 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">#{idx + 1}</span>
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <span className="text-sm text-primary font-semibold">{item.count} posts</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {isFullscreen && (
        <div className="fixed inset-0 bg-black/90 z-50 animate-fade-in" style={{ paddingTop: '32px' }}>
          <div className="w-full h-full flex items-center justify-center px-8">
            <div className="glass-card rounded-xl w-full max-h-[calc(100vh-64px)] overflow-y-auto">
              <ChartComponent fullscreen />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}