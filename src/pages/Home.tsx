import { useState, useEffect } from 'react'
import { Play, Square, Settings, BarChart3, Activity, Clock, Database, Maximize2, Plus, TrendingUp, Filter, Bell, BellOff, RefreshCw, HelpCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useScraperStore } from '@/stores/scraperStore'
import { getSupabase } from '@/lib/supabase'
import { AuthService } from '@/services/auth'
import { centralSupabase } from '@/lib/centralSupabase'
import { toast } from 'sonner'
import ScraperExpandedView from '@/components/features/ScraperExpandedView'
import { UpdateChecker } from '@/services/updateChecker'
import { getRecentActivities, getScraperStats, getScraperConfig, updateScraperConfig } from '@/lib/supabase'
import { ScraperConfig } from '@/types/scraper'
import { getDefaultConfig } from '@/utils/scraperDefaults'
import { getDecryptedCredentials } from '@/utils/scraperHelper'
import FilterSettingsModal from '@/components/FilterSettings'

export default function HomePage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [stats, setStats] = useState({
    status: 'Loading...',
    postsToday: '...',
    totalPosts: '...',
    totalPresets: '...',
    sessionStartTime: 0
  })
  const [sessionUptime, setSessionUptime] = useState('')
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [showExpanded, setShowExpanded] = useState(false)
  const [doNotDisturb, setDoNotDisturb] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [presets, setPresets] = useState<any[]>([])
  const [scraperConfig, setScraperConfig] = useState<ScraperConfig>(getDefaultConfig())
  const [selectedPreset, setSelectedPreset] = useState<any>(null)
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  
  const { 
    isRunning, 
    progress,
    status,
    config,
    startScraping,
    stopScraping,
    updateConfig
  } = useScraperStore()

  useEffect(() => {
    const init = async () => {
      await loadSessionStartTime()
      updateSessionUptime()
      loadUser()
      loadStats()
      loadRecentActivity()
      loadDoNotDisturb()
      checkConnections()
      const settings = await window.electronAPI?.getSettings()
      if (settings?.interface?.fontSize) {
        document.documentElement.style.fontSize = settings.interface.fontSize
      }
    }
    init()
    const handleDndChange = (e: any) => {
      setDoNotDisturb(e.detail)
    }
    window.addEventListener('dnd-changed', handleDndChange)
    return () => {
      window.removeEventListener('dnd-changed', handleDndChange)
    }
  }, [])

  useEffect(() => {
    if (stats.sessionStartTime === 0) return
    const interval = setInterval(() => {
      updateSessionUptime()
    }, 1000)
    return () => clearInterval(interval)
  }, [stats.sessionStartTime])

  useEffect(() => {
    if (!user) return
    const statsInterval = setInterval(() => {
      loadStats()
    }, 5000)
    return () => clearInterval(statsInterval)
  }, [user])

  const loadUser = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser()
      if (currentUser?.id) {
        const { data } = await centralSupabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', currentUser.id)
          .single()
        if (data?.avatar_url) {
          const { data: imageData } = centralSupabase.storage
            .from('avatars')
            .getPublicUrl(data.avatar_url)
          setProfileImage(imageData.publicUrl)
        }
        setUser(currentUser)
        await loadScraperConfig(currentUser.id)
        await loadPresets(currentUser.id)
      }
    } catch (error) {
      console.error('Failed to load user:', error)
    }
  }

  const loadDoNotDisturb = async () => {
    const settings = await window.electronAPI?.getSettings()
    if (settings?.interface?.doNotDisturb !== undefined) {
      setDoNotDisturb(settings.interface.doNotDisturb)
    }
  }

  const loadSessionStartTime = async () => {
    const settings = await window.electronAPI?.getSettings()
    let startTime = settings?.sessionStartTime
    const now = Date.now()
    if (!startTime || startTime > now) {
      startTime = now
      await window.electronAPI?.saveSettings({
        ...settings,
        sessionStartTime: startTime
      })
    }
    setStats(prev => ({ ...prev, sessionStartTime: startTime }))
  }

  const updateSessionUptime = () => {
    if (!stats.sessionStartTime || stats.sessionStartTime === 0) {
      return
    }
    const now = Date.now()
    const diff = Math.floor((now - stats.sessionStartTime) / 1000)
    if (diff < 0) {
      setSessionUptime('0s')
      return
    }
    const hours = Math.floor(diff / 3600)
    const minutes = Math.floor((diff % 3600) / 60)
    const seconds = diff % 60
    if (hours > 0) {
      setSessionUptime(`${hours}h ${minutes}m`)
    } else if (minutes > 0) {
      setSessionUptime(`${minutes}m ${seconds}s`)
    } else {
      setSessionUptime(`${seconds}s`)
    }
  }

  const loadStats = async () => {
    try {
      const supabase = getSupabase()
      if (!supabase) {
        return
      }
      const currentUser = await AuthService.getCurrentUser()
      if (!currentUser?.id) return
      const scraperStats = await getScraperStats(currentUser.id)
      const settings = await window.electronAPI?.getSettings()
      const sessionStart = settings?.sessionStartTime
      if (!sessionStart) {
        console.warn('No session start time found')
        setStats(prev => ({ 
          ...prev,
          status: 'Active',
          postsToday: sessionCount || 0,
          totalPosts: scraperStats.total_posts,
          totalPresets: scraperStats.total_presets
        }))
        return
      }
      const { count: sessionCount, error, data: samplePosts } = await supabase
        .from('reddit_posts')
        .select('id, collected_at', { count: 'exact' })
        .gte('collected_at', new Date(sessionStart).toISOString())
        .limit(3)
      
      if (error) {
        console.error('Error fetching session posts:', error)
      }
      setStats(prev => ({ 
        ...prev, 
        postsToday: sessionCount || 0,
        totalPosts: scraperStats.total_posts,
        totalPresets: scraperStats.total_presets
      }))
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const checkConnections = async () => {
    try {
      const supabase = getSupabase()
      const currentUser = await AuthService.getCurrentUser()
      
      let supabaseOk = false
      let redditOk = false
      
      if (supabase) {
        try {
          const { error } = await supabase.from('profiles').select('count').limit(1)
          supabaseOk = !error
        } catch {
          supabaseOk = false
        }
      }
      
      if (currentUser?.reddit_credentials?.clientId) {
        redditOk = true
      }
      
      setConnectionStatus(supabaseOk && redditOk ? 'online' : 'offline')
    } catch {
      setConnectionStatus('offline')
    }
  }

  const loadRecentActivity = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser()
      if (!currentUser?.id) return
      const activities = await getRecentActivities(currentUser.id, 4)
      if (activities.length > 0) {
        const formattedActivities = activities.map((activity, index) => ({
          id: activity.id,
          text: activity.action_text,
          time: getTimeAgo(activity.created_at),
          type: 'success'
        }))
        setRecentActivity(formattedActivities)
      } else {
        setRecentActivity([])
      }
    } catch (error) {
      console.error('Failed to load recent activity:', error)
      setRecentActivity([])
    }
  }

  const getTimeAgo = (timestamp: string) => {
    const now = new Date()
    const past = new Date(timestamp)
    const diffMs = now.getTime() - past.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  const loadScraperConfig = async (userId: string) => {
    const config = await getScraperConfig(userId)
    if (config) {
      const configWithDefaults = {
        ...getDefaultConfig(),
        ...config,
        filters: {
          ...getDefaultConfig().filters,
          ...(config.filters || {})
        }
      }
      setScraperConfig(configWithDefaults)
      if (config.preset_id) {
        const preset = presets.find(p => p.id === config.preset_id)
        if (preset) setSelectedPreset(preset)
        updateConfig({ preset: config.preset_id })
      }
    }
  }

  const loadPresets = async (userId: string) => {
    const supabase = getSupabase()
    if (!supabase) return
    const { data } = await supabase
      .from('user_presets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (data) setPresets(data)
  }

  const handleStart = async () => {
    try {
      if (!config.preset) {
        toast.error('Please select a preset first')
        return
      }
      const currentUser = await AuthService.getCurrentUser()
      if (!currentUser?.reddit_credentials?.clientId || !currentUser?.reddit_credentials?.clientSecret) {
        toast.error('Please configure your Reddit API credentials in Settings')
        navigate('/settings')
        return
      }
      const supabase = getSupabase()
      if (!supabase) {
        toast.error('Database not initialized')
        return
      }
      const { data: presetData, error: presetError } = await supabase
        .from('user_presets')
        .select('*')
        .eq('id', config.preset)
        .single()
      if (presetError || !presetData) {
        toast.error('Failed to load preset configuration')
        return
      }
      const credentials = await getDecryptedCredentials(user.id)
      const scraperConfigToSend = await getScraperConfig(user.id) || getDefaultConfig()
      window.electronAPI?.send('start-scraper', {
        config: scraperConfigToSend,
        preset: presetData,
        userId: user.id,
        credentials: {
          client_id: credentials.reddit_client_id,
          client_secret: credentials.reddit_client_secret,
          user_agent: credentials.reddit_user_agent,
          supabase_url: credentials.supabase_url,
          supabase_key: credentials.supabase_key
        }
      })
      startScraping()
    } catch (error) {
      console.error('Failed to start scraping:', error)
      toast.error('Failed to start scraper')
    }
  }

  const handleStop = () => {
    stopScraping()
    window.electronAPI?.send('stop-scraper', {})
  }

  const checkForUpdates = async () => {
    await UpdateChecker.checkForUpdates(false)
  }

  const isConfigured = config.preset !== ''
  const isDeepscan = progress.mode === 'deepscan'

  const toggleDoNotDisturb = async () => {
    const newDndState = !doNotDisturb
    setDoNotDisturb(newDndState)
    const settings = await window.electronAPI?.getSettings() || {}
    await window.electronAPI?.saveSettings({
      ...settings,
      interface: {
        ...settings.interface,
        doNotDisturb: newDndState
      }
    })
    window.dispatchEvent(new CustomEvent('dnd-changed', { detail: newDndState }))
    toast.success(newDndState ? 'Do Not Disturb enabled' : 'Notifications enabled')
  }

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Monitor your Reddit scraping operations and performance metrics</p>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Welcome back,</p>
              <p className="font-semibold text-lg">{user.username}</p>
            </div>
            {profileImage ? (
              <img src={profileImage} alt={user.username} className="w-12 h-12 rounded-full object-cover border-2 border-primary/50" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center text-white font-bold text-lg border-2 border-primary/50">
                {user.username?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="glass-card rounded-xl p-4 card-hover">
          <div className="flex items-center justify-between mb-2">
            <Activity className={connectionStatus === 'online' ? 'text-green-500' : connectionStatus === 'offline' ? 'text-red-500' : 'text-yellow-500'} size={20} />
            <span className="text-xs text-muted-foreground">Status</span>
          </div>
          <p className="text-2xl font-bold">
            {connectionStatus === 'checking' ? 'Checking...' : connectionStatus === 'online' ? 'Active' : 'Offline'}
          </p>
          <div className="w-full h-1 bg-secondary rounded-full mt-3 overflow-hidden">
            <div 
              className={`h-full ${connectionStatus === 'online' ? 'bg-green-500 animate-pulse' : connectionStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'}`}
              style={{ width: '100%' }} 
            />
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 card-hover">
          <div className="flex items-center justify-between mb-2">
            <Database className="text-blue-500" size={20} />
            <span className="text-xs text-muted-foreground">Posts This Session</span>
          </div>
          <p className="text-2xl font-bold">{stats.postsToday === '...' ? '...' : (stats.postsToday as number).toLocaleString()}</p>
          <div className="w-full h-1 bg-secondary rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-blue-500" style={{ width: `${typeof stats.postsToday === 'number' ? Math.min((stats.postsToday / 100) * 100, 100) : 0}%` }} />
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 card-hover">
          <div className="flex items-center justify-between mb-2">
            <Clock className="text-purple-500" size={20} />
            <span className="text-xs text-muted-foreground">Session Uptime</span>
          </div>
          <p className="text-2xl font-bold">{sessionUptime || '...'}</p>
          <div className="w-full h-1 bg-secondary rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-purple-500 animate-pulse" style={{ width: '100%' }} />
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 card-hover">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="text-orange-500" size={20} />
            <span className="text-xs text-muted-foreground">Total Posts</span>
          </div>
          <p className="text-2xl font-bold">{stats.totalPosts === '...' ? '...' : (stats.totalPosts as number).toLocaleString()}</p>
          <div className="w-full h-1 bg-secondary rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-orange-500" style={{ width: '65%' }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="text-primary" size={20} />
            Scraper Control Center
          </h2>
          <p className="text-sm text-muted-foreground mb-4">Manage your data collection operations in real-time</p>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-background/50 border border-border/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-success" />
                  <span className="font-medium">Operation Status</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${isRunning ? 'bg-green-500/20 text-green-500' : 'bg-secondary/50 text-muted-foreground'}`}>
                  {isRunning ? 'Running' : 'Idle'}
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className={isDeepscan ? 'text-muted-foreground' : ''}>Keywords Progress</span>
                    <span className="text-xs">{isDeepscan ? '-/-' : `${progress.currentKeyword}/${progress.totalKeywords}`}</span>
                  </div>
                  <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${isDeepscan ? 'bg-gray-600' : 'bg-blue-500'}`}
                      style={{ width: isDeepscan ? '0%' : `${progress.totalKeywords > 0 ? (progress.currentKeyword / progress.totalKeywords) * 100 : 0}%` }} 
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Subreddits Progress</span>
                    <span className="text-xs">{progress.currentSubreddit}/{progress.totalSubreddits}</span>
                  </div>
                  <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 transition-all" style={{ width: `${progress.totalSubreddits > 0 ? (progress.currentSubreddit / progress.totalSubreddits) * 100 : 0}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Posts (Current Iteration)</span>
                    <span className="text-xs">{progress.currentIterationPosts}/{progress.maxIterationPosts || 0}</span>
                  </div>
                  <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-blue-400 transition-all duration-500"
                      style={{ width: progress.maxIterationPosts > 0 ? `${(progress.currentIterationPosts / progress.maxIterationPosts) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-3 p-2 bg-secondary/20 rounded">
                <span>Mode: {selectedPreset?.name || 'None'}</span>
                <span>CPU: {status.cpuUsage.toFixed(1)}% | RAM: {status.ramUsage.toFixed(1)}%</span>
              </div>
            </div>
            <div className="flex gap-3">
              {!isRunning ? (
                <button
                  onClick={handleStart}
                  disabled={!isConfigured}
                  className={`flex-1 rounded-lg p-4 flex items-center gap-4 transition-colors ${
                    isConfigured 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700' 
                      : 'bg-gray-600 cursor-not-allowed opacity-50'
                  }`}
                  title={!isConfigured ? 'Please configure scraper settings and select a preset first' : ''}
                >
                  <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Play className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-white font-semibold">Start Scraping</h3>
                    <p className={`text-sm ${isConfigured ? 'text-blue-100' : 'text-gray-400'}`}>
                      {isConfigured ? 'Begin data collection' : 'Configure settings first'}
                    </p>
                  </div>
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="flex-1 rounded-lg p-4 flex items-center gap-4 transition-all bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700"
                >
                  <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Square className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-white font-semibold">Stop Scraping</h3>
                    <p className="text-sm text-red-100">Terminate data collection</p>
                  </div>
                </button>
              )}
              <button 
                onClick={() => setShowExpanded(true)}
                className="px-4 py-3 bg-secondary/50 hover:bg-secondary/80 rounded-lg transition-all group"
              >
                <Maximize2 size={20} className="group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <p className="text-sm text-muted-foreground mb-4">Latest data collection events</p>
          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-muted-foreground">No recent activity</p>
              </div>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/30">
                  <div className={`w-2 h-2 rounded-full mt-2 ${activity.type === 'success' ? 'bg-green-500' : activity.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.text}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => {
              navigate('/presets')
              setTimeout(() => {
                const event = new CustomEvent('openCreateDialog')
                window.dispatchEvent(event)
              }, 50)
            }}
            className="bg-secondary/30 hover:bg-secondary/50 rounded-xl p-6 hover:scale-105 transition-all group border border-border/30"
          >
            <Plus className="mx-auto mb-2 group-hover:scale-110 transition-transform" size={24} />
            <p className="text-sm font-medium">New Preset</p>
          </button>
          <button
            onClick={() => navigate('/configuration')}
            className="bg-secondary/30 hover:bg-secondary/50 rounded-xl p-6 hover:scale-105 transition-all group border border-border/30"
          >
            <Settings className="mx-auto mb-2 group-hover:rotate-90 transition-transform" size={24} />
            <p className="text-sm font-medium">Configuration</p>
          </button>
          <button
            onClick={() => setShowFilterModal(true)}
            className="bg-secondary/30 hover:bg-secondary/50 rounded-xl p-6 hover:scale-105 transition-all group border border-border/30"
          >
            <Filter className="mx-auto mb-2" size={24} />
            <p className="text-sm font-medium">Customize Filter</p>
          </button>
          <button
            onClick={toggleDoNotDisturb}
            className={`rounded-xl p-6 hover:scale-105 transition-all group border ${doNotDisturb ? 'bg-primary/20 border-primary/50' : 'bg-secondary/30 hover:bg-secondary/50 border-border/30'}`}
          >
            {doNotDisturb ? (
              <BellOff className="mx-auto mb-2 group-hover:scale-110 transition-transform" size={24} />
            ) : (
              <Bell className="mx-auto mb-2 group-hover:scale-110 transition-transform" size={24} />
            )}
            <p className="text-sm font-medium">Do Not Disturb</p>
          </button>
          <button
            onClick={() => navigate('/posts')}
            className="bg-secondary/30 hover:bg-secondary/50 rounded-xl p-6 hover:scale-105 transition-all group border border-border/30"
          >
            <Database className="mx-auto mb-2 group-hover:scale-110 transition-transform" size={24} />
            <p className="text-sm font-medium">View Posts</p>
          </button>
          <button
            onClick={() => navigate('/statistics')}
            className="bg-secondary/30 hover:bg-secondary/50 rounded-xl p-6 hover:scale-105 transition-all group border border-border/30"
          >
            <BarChart3 className="mx-auto mb-2 group-hover:scale-110 transition-transform" size={24} />
            <p className="text-sm font-medium">View Data</p>
          </button>
          <button
            onClick={checkForUpdates}
            className="bg-secondary/30 hover:bg-secondary/50 rounded-xl p-6 hover:scale-105 transition-all group border border-border/30"
          >
            <RefreshCw className="mx-auto mb-2 group-hover:rotate-180 transition-transform" size={24} />
            <p className="text-sm font-medium">Check Updates</p>
          </button>
          <button
            onClick={() => window.open('https://www.twitch.tv/nickich', '_blank')}
            className="bg-secondary/30 hover:bg-secondary/50 rounded-xl p-6 hover:scale-105 transition-all group border border-border/30"
          >
            <HelpCircle className="mx-auto mb-2 group-hover:scale-110 transition-transform" size={24} />
            <p className="text-sm font-medium">Help</p>
          </button>
        </div>
      </div>

      <FilterSettingsModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        filters={scraperConfig.filters}
        onSave={async (newFilters) => {
          if (user) {
            const updatedConfig = { ...scraperConfig, filters: newFilters }
            setScraperConfig(updatedConfig)
            await updateScraperConfig(user.id, updatedConfig)
            toast.success('Filter settings saved')
          }
        }}
        entityRecognitionEnabled={scraperConfig.entity_recognition}
        onEntityRecognitionChange={(enabled) => {
          setScraperConfig({ ...scraperConfig, entity_recognition: enabled })
        }}
      />
      {showExpanded && <ScraperExpandedView onClose={() => setShowExpanded(false)} />}
    </div>
  )
}