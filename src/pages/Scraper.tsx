import { useState, useEffect } from 'react'
import { Play, Square, Maximize2, Calendar, TrendingUp, Clock, BarChart3, Settings, RotateCcw, Filter, MessageSquare } from 'lucide-react'
import { useScraperStore } from '@/stores/scraperStore'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { AuthService } from '@/services/auth'
import ScraperExpandedView from '@/components/features/ScraperExpandedView'
import { centralSupabase } from '@/lib/centralSupabase'
import { Switch } from '@/components/ui/switch'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { DiscordRPCService } from '@/services/discordRPC'
import { getSupabase, getScraperConfig, updateScraperConfig, getRecentActivities } from '@/lib/supabase'
import { ScraperConfig } from '@/types/scraper'
import { getDefaultConfig } from '@/utils/scraperDefaults'
import { getDecryptedCredentials } from '@/utils/scraperHelper'
import FilterSettingsModal from '@/components/FilterSettings'
import { cn } from '@/lib/utils'

interface Preset {
  id: string
  name: string
  mode: string
}

export default function ScraperPage() {
  const navigate = useNavigate()
  const {
    isRunning,
    progress,
    status,
    config,
    startScraping,
    stopScraping,
    updateConfig
  } = useScraperStore()
  const [showExpanded, setShowExpanded] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [presets, setPresets] = useState<Preset[]>([])
  const [originalConfig, setOriginalConfig] = useState({})
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [scraperConfig, setScraperConfig] = useState<ScraperConfig>(getDefaultConfig())
  const [selectedPreset, setSelectedPreset] = useState<any>(null)
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [formData, setFormData] = useState({
    preset: '',
    batchSize: 25,
    rateLimit: 60,
    mode: 'once',
    cycleDelay: 300,
    scrapeComments: false,
    maxCommentsPerPost: 5,
    enableSentiment: true,
    enableEntities: false,
    autoStop: false,
    autoStopTarget: 100
  })

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (user) {
      loadPresets()
    }
  }, [user])

  useEffect(() => {
    if (user && presets.length > 0) {
      loadUserConfig()
      loadRecentActivities()
    }
  }, [user, presets])

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      preset: config.preset || '',
      batchSize: config.batchSize || 25,
      rateLimit: config.rateLimit || 60,
      mode: config.mode || 'once',
      cycleDelay: config.cycleDelay || 300,
      scrapeComments: config.scrapeComments ?? false,
      maxCommentsPerPost: config.maxCommentsPerPost || 5,
      enableSentiment: config.enableSentiment ?? true,
      enableEntities: config.enableEntities ?? false,
      autoStop: config.autoStop ?? false,
      autoStopTarget: config.autoStopTarget || 100
    }))
  }, [config])

  const loadUser = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser()
      setUser(currentUser)
    } catch (error) {
      console.error('Failed to load user:', error)
    }
  }

  const loadPresets = async () => {
    try {
      const supabase = getSupabase()
      if (!supabase) return
      const { data } = await supabase
        .from('user_presets')
        .select('id, name, mode')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (data) setPresets(data)
    } catch (error) {
      console.error('Failed to load presets:', error)
    }
  }

  const loadUserConfig = async () => {
    try {
      const config = await getScraperConfig(user.id)
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
        const savedConfig = {
          preset: config.preset_id || '',
          batchSize: config.batch_size || 25,
          rateLimit: config.rateLimit || 60,
          mode: config.runtime_mode === 'continuous' ? 'infinite' : 'once',
          cycleDelay: config.cycleDelay || 300,
          scrapeComments: config.scrape_comments ?? false,
          maxCommentsPerPost: config.max_comments_per_post || 5,
          enableSentiment: config.sentiment_analysis ?? true,
          enableEntities: config.entity_recognition ?? false,
          autoStop: config.auto_stop_target ? true : false,
          autoStopTarget: config.auto_stop_target || 100
        }
        setFormData(savedConfig)
        setOriginalConfig(savedConfig)
        updateConfig(savedConfig)
        if (config.preset_id) {
          const preset = presets.find(p => p.id === config.preset_id)
          if (preset) {
            setSelectedPreset(preset)
          }
        }
      }
    } catch (error) {
      console.error('Error loading user config:', error)
    }
  }

  const loadRecentActivities = async () => {
    try {
      const activities = await getRecentActivities(user.id, 10)
      setRecentActivities(activities)
    } catch (error) {
      console.error('Failed to load recent activities:', error)
    }
  }

  const handleConfigChange = (field: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value }
      setHasChanges(JSON.stringify(newData) !== JSON.stringify(originalConfig))
      return newData
    })
    updateConfig({ [field]: value })
  }

  const handleSaveConfig = async () => {
    setIsSaving(true)
    try {
      if (!user) return
      const configToSave = {
        preset_id: formData.preset || null,
        batch_size: formData.batchSize,
        runtime_mode: formData.mode === 'infinite' ? 'continuous' : 'once',
        auto_stop_target: formData.autoStop ? formData.autoStopTarget : null,
        entity_recognition: formData.enableEntities,
        sentiment_analysis: formData.enableSentiment,
        scrape_comments: formData.scrapeComments,
        max_comments_per_post: formData.maxCommentsPerPost,
        max_posts_per_keyword: scraperConfig.max_posts_per_keyword,
        max_posts_per_subreddit: scraperConfig.max_posts_per_subreddit,
        filters: scraperConfig.filters,
        rateLimit: formData.rateLimit,
        cycleDelay: formData.cycleDelay
      }
      await updateScraperConfig(user.id, configToSave as any)
      const { error } = await centralSupabase
        .from('profiles')
        .update({ scraper_config: configToSave })
        .eq('id', user.id)
      if (error) throw error
      setOriginalConfig(formData)
      setHasChanges(false)
      toast.success('Configuration saved successfully')
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save configuration')
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetToDefaults = async () => {
    const defaultFormConfig = {
      preset: '',
      batchSize: 25,
      rateLimit: 60,
      mode: 'once',
      cycleDelay: 300,
      scrapeComments: false,
      maxCommentsPerPost: 5,
      enableSentiment: true,
      enableEntities: false,
      autoStop: false,
      autoStopTarget: 100
    }
    const defaultScraperConfig = {
      preset_id: null,
      batch_size: 25,
      runtime_mode: 'once',
      auto_stop_target: null,
      entity_recognition: false,
      sentiment_analysis: true,
      max_posts_per_keyword: 50,
      max_posts_per_subreddit: 50,
      scrape_comments: false,
      max_comments_per_post: 5,
      rateLimit: 60,
      cycleDelay: 300,
      filters: getDefaultConfig().filters
    }
    setFormData(defaultFormConfig)
    setScraperConfig(defaultScraperConfig)
    updateConfig(defaultFormConfig)
    setSelectedPreset(null)
    try {
      if (!user) return
      await updateScraperConfig(user.id, defaultScraperConfig as any)
      const { error } = await centralSupabase
        .from('profiles')
        .update({ scraper_config: defaultFormConfig })
        .eq('id', user.id)
      if (error) throw error
      setOriginalConfig(defaultFormConfig)
      setHasChanges(false)
      toast.success('Configuration reset to defaults')
    } catch (error) {
      console.error('Reset error:', error)
      toast.error('Failed to reset configuration')
    }
  }

  const handleStart = async () => {
    try {
      if (!formData.preset) {
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
        .eq('id', formData.preset)
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

  const isConfigured = formData.preset !== ''
  const isDeepscan = progress.mode === 'deepscan'

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">Data Collection Engine</h1>
        <p className="text-muted-foreground mt-1">Configure and monitor your Reddit data scraping operations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Play className="text-primary" size={20} />
              Scraper Control Center
            </h2>
            <p className="text-sm text-muted-foreground mb-4">Manage your data collection operations in real-time</p>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-background/50 border border-border/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
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
                        className={cn(
                          "h-full transition-all",
                          isDeepscan ? 'bg-gray-600' : 'bg-blue-500'
                        )}
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
                    title={!isConfigured ? 'Please select a preset in configuration first' : ''}
                  >
                    <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Play className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-white font-semibold">{isConfigured ? 'Start Scraping' : 'Configure First'}</h3>
                      <p className={`text-sm ${isConfigured ? 'text-blue-100' : 'text-gray-400'}`}>
                        {isConfigured ? 'Begin data collection' : 'Select a preset first'}
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
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings className="text-primary" size={20} />
              Scraping Configuration
            </h2>
            <p className="text-sm text-muted-foreground mb-4">Configure your data collection parameters</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select Preset</label>
                <CustomSelect
                  value={formData.preset}
                  onChange={(value) => {
                    handleConfigChange('preset', value)
                    const preset = presets.find(p => p.id === value)
                    if (preset) setSelectedPreset(preset)
                  }}
                  options={[
                    { value: '', label: 'No preset selected' },
                    ...presets.map(preset => ({
                      value: preset.id,
                      label: `${preset.name} (${preset.mode})`
                    }))
                  ]}
                  placeholder="No preset selected"
                />
                <p className="text-xs text-muted-foreground mt-1">Select a preset or create one in the Presets page</p>
              </div>

              {selectedPreset && (selectedPreset.mode === 'keyword' || selectedPreset.mode === 'hybrid' || selectedPreset.mode === 'both') && (
                <div>
                  <label className="block text-sm font-medium mb-2">Max Posts Per Keyword</label>
                  <input
                    type="number"
                    value={scraperConfig.max_posts_per_keyword}
                    onChange={(e) => setScraperConfig({...scraperConfig, max_posts_per_keyword: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    style={{ colorScheme: 'dark' }}
                    min="1"
                    max="1000"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Maximum posts to collect per keyword search</p>
                </div>
              )}

              {selectedPreset && (selectedPreset.mode === 'deepscan' || selectedPreset.mode === 'hybrid' || selectedPreset.mode === 'both') && (
                <div>
                  <label className="block text-sm font-medium mb-2">Max Posts Per Subreddit</label>
                  <input
                    type="number"
                    value={scraperConfig.max_posts_per_subreddit}
                    onChange={(e) => setScraperConfig({...scraperConfig, max_posts_per_subreddit: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    style={{ colorScheme: 'dark' }}
                    min="1"
                    max="1000"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Maximum posts to collect per subreddit deep scan</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Batch Size</label>
                  <CustomSelect
                    value={formData.batchSize.toString()}
                    onChange={(value) => handleConfigChange('batchSize', parseInt(value))}
                    options={[
                      { value: '25', label: '25' },
                      { value: '50', label: '50' },
                      { value: '75', label: '75' },
                      { value: '100', label: '100' }
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Rate Limit (req/min)</label>
                  <input
                    type="number"
                    value={formData.rateLimit}
                    onChange={(e) => handleConfigChange('rateLimit', parseInt(e.target.value))}
                    className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Scraping Mode</label>
                <CustomSelect
                  value={formData.mode}
                  onChange={(value) => handleConfigChange('mode', value)}
                  options={[
                    { value: 'once', label: 'Run Once' },
                    { value: 'infinite', label: 'Run Infinitely' }
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Filter Settings</label>
                <button
                  onClick={() => setShowFilterModal(true)}
                  className="w-full px-4 py-3 bg-secondary/50 hover:bg-secondary/70 border border-border rounded-lg flex items-center justify-center gap-2 transition-all"
                >
                  <Filter size={18} />
                  <span className="text-sm font-medium">Customize Filters</span>
                </button>
              </div>
              <div className="space-y-2">
                <label className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                  <span className="text-sm font-medium">Scrape Comments</span>
                  <Switch
                    checked={formData.scrapeComments}
                    onCheckedChange={(checked) => {
                      handleConfigChange('scrapeComments', checked)
                      setScraperConfig({ ...scraperConfig, scrape_comments: checked })
                    }}
                  />
                </label>
                {formData.scrapeComments && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Max Comments Per Post</label>
                    <input
                      type="number"
                      value={formData.maxCommentsPerPost}
                      onChange={(e) => {
                        const value = parseInt(e.target.value)
                        handleConfigChange('maxCommentsPerPost', value)
                        setScraperConfig({ ...scraperConfig, max_comments_per_post: value })
                      }}
                      className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                      style={{ colorScheme: 'dark' }}
                      min="1"
                      max="20"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Filters out bot/mod comments (1-20 comments)</p>
                  </div>
                )}
                <label className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                  <span className="text-sm font-medium">Enable Sentiment Analysis</span>
                  <Switch
                    checked={formData.enableSentiment}
                    onCheckedChange={(checked) => handleConfigChange('enableSentiment', checked)}
                  />
                </label>
                <label className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                  <span className="text-sm font-medium">Enable Entity Recognition</span>
                  <Switch
                    checked={formData.enableEntities}
                    onCheckedChange={(checked) => {
                      handleConfigChange('enableEntities', checked)
                      setScraperConfig({ ...scraperConfig, entity_recognition: checked })
                    }}
                  />
                </label>
                <label className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                  <span className="text-sm font-medium">Auto-stop on target</span>
                  <Switch
                    checked={formData.autoStop}
                    onCheckedChange={(checked) => handleConfigChange('autoStop', checked)}
                  />
                </label>
              </div>
              {formData.autoStop && (
                <div>
                  <label className="block text-sm font-medium mb-2">Target Posts</label>
                  <input
                    type="number"
                    value={formData.autoStopTarget}
                    onChange={(e) => handleConfigChange('autoStopTarget', parseInt(e.target.value))}
                    className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6 pt-6 border-t border-border">
              <button
                onClick={handleResetToDefaults}
                className="px-6 py-2 bg-secondary/50 hover:bg-secondary/80 rounded-lg flex items-center gap-2 transition-all"
              >
                <RotateCcw size={16} />
                Reset to Defaults
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={isSaving}
                className={`px-6 py-2 rounded-lg flex items-center gap-2 transition-all ${
                  !isSaving
                    ? 'btn-gradient text-white hover:scale-105'
                    : 'bg-secondary/50 text-muted-foreground cursor-not-allowed'
                }`}
              >
                <Settings size={16} />
                {isSaving ? 'Saving...' : 'Save All Settings'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card rounded-xl p-6 h-[calc(100vh-10rem)]">
            <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
            <p className="text-sm text-muted-foreground mb-4">Latest data collection events</p>
            <div className="space-y-3 overflow-y-auto h-[calc(100%-5rem)]">
              {recentActivities.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-muted-foreground">No recent activity</p>
                </div>
              ) : (
                recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/30">
                    <div className="w-2 h-2 rounded-full mt-2 bg-green-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.action_text}</p>
                      <p className="text-xs text-muted-foreground">{new Date(activity.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
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