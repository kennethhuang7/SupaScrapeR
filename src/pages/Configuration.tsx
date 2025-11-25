import { useState, useEffect } from 'react'
import { Settings, Save, RotateCcw, Filter } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useScraperStore } from '@/stores/scraperStore'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { centralSupabase } from '@/lib/centralSupabase'
import { AuthService } from '@/services/auth'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { getSupabase, getScraperConfig, updateScraperConfig } from '@/lib/supabase'
import { ScraperConfig } from '@/types/scraper'
import { getDefaultConfig } from '@/utils/scraperDefaults'
import FilterSettingsModal from '@/components/FilterSettings'

interface Preset {
  id: string
  name: string
  mode: string
}

export default function ConfigurationPage() {
  const navigate = useNavigate()
  const { config, updateConfig } = useScraperStore()
  const [user, setUser] = useState<any>(null)
  const [presets, setPresets] = useState<Preset[]>([])
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null)
  const [scraperConfig, setScraperConfig] = useState<ScraperConfig>(getDefaultConfig())
  const [originalConfig, setOriginalConfig] = useState({})
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [formData, setFormData] = useState({
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
    }
  }, [user, presets])

  useEffect(() => {
    setHasChanges(JSON.stringify(formData) !== JSON.stringify(originalConfig))
  }, [formData, originalConfig])

  const loadUser = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser()
      if (currentUser?.id) {
        setUser(currentUser)
      }
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

  const handleSave = async () => {
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
        scrape_comments: formData.scrapeComments,  // ADD THIS
        max_comments_per_post: formData.maxCommentsPerPost,  // ADD THIS
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

  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value }
      return newData
    })
    updateConfig({ [field]: value })
  }

  const handlePresetChange = (presetId: string) => {
    handleFieldChange('preset', presetId)
    const preset = presets.find(p => p.id === presetId)
    if (preset) {
      setSelectedPreset(preset)
      setScraperConfig({ ...scraperConfig, preset_id: presetId })
    }
  }

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">Scraper Configuration</h1>
        <p className="text-muted-foreground mt-1">Configure your scraping parameters and settings</p>
      </div>
      <div className="max-w-3xl">
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings size={20} className="text-primary" />
            Scraping Parameters
          </h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Select Preset</label>
              <CustomSelect
                value={formData.preset}
                onChange={(value) => handlePresetChange(value)}
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
                <p className="text-xs text-muted-foreground mt-1">Maximum posts to collect per subreddit deepscan</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Batch Size</label>
                <CustomSelect
                  value={formData.batchSize.toString()}
                  onChange={(value) => handleFieldChange('batchSize', parseInt(value))}
                  options={[
                    { value: '25', label: '25' },
                    { value: '50', label: '50' },
                    { value: '75', label: '75' },
                    { value: '100', label: '100' }
                  ]}
                />
                <p className="text-xs text-muted-foreground mt-1">Posts to process per batch</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Rate Limit (req/min)</label>
                <input
                  type="number"
                  value={formData.rateLimit}
                  onChange={(e) => handleFieldChange('rateLimit', parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  style={{ colorScheme: 'dark' }}
                />
                <p className="text-xs text-muted-foreground mt-1">API requests per minute</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Scraping Mode</label>
              <CustomSelect
                value={formData.mode}
                onChange={(value) => handleFieldChange('mode', value)}
                options={[
                  { value: 'once', label: 'Run Once' },
                  { value: 'infinite', label: 'Run Infinitely' }
                ]}
              />
            </div>

            {formData.mode === 'infinite' && (
              <div>
                <label className="block text-sm font-medium mb-2">Cycle Delay (seconds)</label>
                <input
                  type="number"
                  value={formData.cycleDelay}
                  onChange={(e) => handleFieldChange('cycleDelay', parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  style={{ colorScheme: 'dark' }}
                />
                <p className="text-xs text-muted-foreground mt-1">Time between scraping cycles</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Filter Settings</label>
              <button
                onClick={() => setShowFilterModal(true)}
                className="w-full px-4 py-3 bg-secondary/50 hover:bg-secondary/70 border border-border rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <Filter size={18} />
                <span className="text-sm font-medium">Customize Filters</span>
              </button>
              <p className="text-xs text-muted-foreground mt-1">Configure post filtering and keyword matching</p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                <span className="text-sm font-medium">Scrape Comments</span>
                <Switch
                  checked={formData.scrapeComments}
                  onCheckedChange={(checked) => {
                    handleFieldChange('scrapeComments', checked)
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
                      handleFieldChange('maxCommentsPerPost', value)
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
                  onCheckedChange={(checked) => handleFieldChange('enableSentiment', checked)}
                />
              </label>
              <label className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                <span className="text-sm font-medium">Enable Entity Recognition</span>
                <Switch
                  checked={formData.enableEntities}
                  onCheckedChange={(checked) => {
                    handleFieldChange('enableEntities', checked)
                    setScraperConfig({ ...scraperConfig, entity_recognition: checked })
                  }}
                />
              </label>
              <label className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                <span className="text-sm font-medium">Auto-stop on target</span>
                <Switch
                  checked={formData.autoStop}
                  onCheckedChange={(checked) => handleFieldChange('autoStop', checked)}
                />
              </label>
            </div>

            {formData.autoStop && (
              <div>
                <label className="block text-sm font-medium mb-2">Target Posts</label>
                <input
                  type="number"
                  value={formData.autoStopTarget}
                  onChange={(e) => handleFieldChange('autoStopTarget', parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  style={{ colorScheme: 'dark' }}
                />
                <p className="text-xs text-muted-foreground mt-1">Stop scraping after collecting this many posts</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6 pt-6 border-t border-border">
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-2 bg-secondary/50 hover:bg-secondary/80 rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleResetToDefaults}
              className="px-6 py-2 bg-secondary/50 hover:bg-secondary/80 rounded-lg flex items-center gap-2 transition-all"
            >
              <RotateCcw size={16} />
              Reset to Defaults
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className={`px-6 py-2 rounded-lg flex items-center gap-2 transition-all ${
                hasChanges && !isSaving
                  ? 'btn-gradient text-white hover:scale-105'
                  : 'bg-secondary/50 text-muted-foreground cursor-not-allowed'
              }`}
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </button>
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
          handleFieldChange('enableEntities', enabled)
        }}
      />
    </div>
  )
}