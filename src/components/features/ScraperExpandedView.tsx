import { X, Activity, TrendingUp, Database, Cpu, Play, Square, Copy, Check } from 'lucide-react'
import { useScraperStore } from '@/stores/scraperStore'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthService } from '@/services/auth'
import { toast } from 'sonner'
import { centralSupabase } from '@/lib/centralSupabase'
import { getSupabase, getScraperConfig } from '@/lib/supabase'
import { getDefaultConfig } from '@/utils/scraperDefaults'
import { getDecryptedCredentials } from '@/utils/scraperHelper'
import { cn } from '@/lib/utils'

export default function ScraperExpandedView({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { status, progress, config, isRunning, startScraping, stopScraping } = useScraperStore()
  const logEndRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [presetName, setPresetName] = useState<string>('')

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [status.logs])

  useEffect(() => {
    const loadPresetName = async () => {
      if (config.preset) {
        try {
          const supabase = getSupabase()
          if (!supabase) return
          const { data } = await supabase
            .from('user_presets')
            .select('name')
            .eq('id', config.preset)
            .single()
          if (data) setPresetName(data.name)
        } catch (error) {
          console.error('Failed to load preset name:', error)
        }
      }
    }
    loadPresetName()
  }, [config.preset])

  useEffect(() => {
    const handleOpenExpanded = () => {
      setShowExpanded(true)
    }
    window.addEventListener('open-expanded-view', handleOpenExpanded)
    return () => window.removeEventListener('open-expanded-view', handleOpenExpanded)
  }, [])

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

  const handleCopyAllLogs = () => {
    if (status.logs.length === 0) return
    const allLogs = status.logs.map(log => `[${log.time}] ${log.message}`).join('\n')
    navigator.clipboard.writeText(allLogs)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isConfigured = config.preset !== ''
  const isDeepscan = progress.mode === 'deepscan'

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-50 animate-fade-in">
      <div className="flex flex-col h-full p-6 pt-16">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">Scraping Progress - Detailed View</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Mode: {progress.mode || 'None'} | Preset: {presetName || 'None'} | Status: {isRunning ? 'Running' : 'Idle'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary/50 rounded-lg transition-all"
          >
            <X size={24} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <Activity className={isDeepscan ? "text-gray-600" : "text-blue-500"} size={18} />
              <span className={cn("text-xs", isDeepscan ? "text-muted-foreground" : "")}>Keywords</span>
            </div>
            <div className="h-3 bg-secondary/50 rounded-full overflow-hidden mb-2">
              <div 
                className={cn(
                  "h-full transition-all",
                  isDeepscan ? "bg-gray-600" : "bg-blue-500"
                )}
                style={{ width: isDeepscan ? '0%' : `${progress.totalKeywords > 0 ? (progress.currentKeyword / progress.totalKeywords) * 100 : 0}%` }} 
              />
            </div>
            <p className={cn("text-lg font-bold", isDeepscan && "text-muted-foreground")}>
              {isDeepscan ? '-/-' : `${progress.currentKeyword}/${progress.totalKeywords}`}
            </p>
          </div>

          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <Database className="text-purple-500" size={18} />
              <span className="text-xs text-muted-foreground">Subreddits</span>
            </div>
            <div className="h-3 bg-secondary/50 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-purple-500 transition-all" style={{ width: `${progress.totalSubreddits > 0 ? (progress.currentSubreddit / progress.totalSubreddits) * 100 : 0}%` }} />
            </div>
            <p className="text-lg font-bold">{progress.currentSubreddit}/{progress.totalSubreddits}</p>
          </div>

          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="text-primary" size={18} />
              <span className="text-xs text-muted-foreground">Posts (Current)</span>
            </div>
            <div className="h-3 bg-secondary/50 rounded-full overflow-hidden mb-2">
              <div 
                className="h-full bg-primary transition-all"
                style={{ width: progress.maxIterationPosts > 0 ? `${(progress.currentIterationPosts / progress.maxIterationPosts) * 100}%` : '0%' }}
              />
            </div>
            <p className="text-lg font-bold">{progress.currentIterationPosts}/{progress.maxIterationPosts || 0}</p>
          </div>

          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <Cpu className="text-orange-500" size={18} />
              <span className="text-xs text-muted-foreground">System</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>CPU:</span>
                <span className="font-bold">{status.cpuUsage.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>RAM:</span>
                <span className="font-bold">{status.ramUsage.toFixed(1)}%</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {Math.floor(status.elapsedTime / 60)}m {status.elapsedTime % 60}s
            </p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3 mb-6">
          <div className="glass-card rounded-lg px-4 py-2 text-sm">
            <span className="text-muted-foreground">Sentiment:</span> <span className={`font-bold ${config.enableSentiment ? 'text-green-500' : 'text-gray-500'}`}>{config.enableSentiment ? 'Enabled' : 'Disabled'}</span>
          </div>
          <div className="glass-card rounded-lg px-4 py-2 text-sm">
            <span className="text-muted-foreground">Entity Recognition:</span> <span className={`font-bold ${config.enableEntities ? 'text-green-500' : 'text-gray-500'}`}>{config.enableEntities ? 'Enabled' : 'Disabled'}</span>
          </div>
          <div className="glass-card rounded-lg px-4 py-2 text-sm">
            <span className="text-muted-foreground">Batch Size:</span> <span className="font-bold">{config.batchSize}</span>
          </div>
          <div className="glass-card rounded-lg px-4 py-2 text-sm">
            <span className="text-muted-foreground">Rate Limit:</span> <span className="font-bold">{config.rateLimit} req/min</span>
          </div>
          <div className="glass-card rounded-lg px-4 py-2 text-sm">
            <span className="text-muted-foreground">Total Posts:</span> <span className="font-bold">{progress.current}</span>
          </div>
        </div>

        <div className="flex-1 glass-card rounded-xl p-6 overflow-hidden flex flex-col group/log">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Post Collection Log</h3>
            <div className="flex gap-2">
              <button
                onClick={handleCopyAllLogs}
                disabled={status.logs.length === 0}
                className={`glass-card rounded-lg px-4 py-2 text-sm opacity-0 group-hover/log:opacity-100 transition-opacity ${
                  status.logs.length === 0 ? 'cursor-not-allowed opacity-50' : 'hover:bg-secondary/70'
                }`}
                title={status.logs.length === 0 ? 'Cannot copy empty log' : 'Copy entire log'}
              >
                {copied ? (
                  <Check size={14} className="text-green-500" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
              {!isRunning ? (
                <button
                  onClick={handleStart}
                  disabled={!isConfigured}
                  className={`glass-card rounded-lg px-6 py-2 text-sm flex items-center gap-3 transition-all ${
                    isConfigured 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white' 
                      : 'cursor-not-allowed opacity-50'
                  }`}
                  title={!isConfigured ? 'Please select a preset in configuration first' : 'Start scraping'}
                >
                  <Play size={14} />
                  <span className="font-medium">Start</span>
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="glass-card rounded-lg px-6 py-2 text-sm flex items-center gap-3 transition-all bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white"
                >
                  <Square size={14} />
                  <span className="font-medium">Stop</span>
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 font-mono text-sm">
            {status.logs.map((log, i) => {
              const isDivider = log.message.startsWith('---')
              if (isDivider) {
                return (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary to-transparent"></div>
                    <span className="text-primary font-bold text-xs uppercase tracking-wider px-3">
                      {log.message.replace(/---/g, '').trim()}
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-r from-primary via-primary to-transparent"></div>
                  </div>
                )
              }
              
              return (
                <div key={i} className={`flex items-start gap-3 p-2 rounded ${
                  log.type === 'success' ? 'bg-green-500/10 text-green-500' :
                  log.type === 'error' ? 'bg-red-500/10 text-red-500' :
                  log.type === 'warning' ? 'bg-yellow-500/10 text-yellow-500' :
                  'bg-secondary/30'
                }`}>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{log.time}</span>
                  <span className="flex-1 whitespace-pre-wrap break-words">{log.message}</span>
                </div>
              )
            })}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}