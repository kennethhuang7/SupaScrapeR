import { useState, useEffect, useRef } from 'react'
import { Play, Square, Maximize2, X, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScraperStore } from '@/stores/scraperStore'
import { useNavigate } from 'react-router-dom'
import { AuthService } from '@/services/auth'
import { centralSupabase } from '@/lib/centralSupabase'
import { getSupabase, getScraperConfig } from '@/lib/supabase'
import { getDefaultConfig } from '@/utils/scraperDefaults'
import { getDecryptedCredentials } from '@/utils/scraperHelper'
import { toast } from 'sonner'

export default function ScraperWidget() {
  const navigate = useNavigate()
  const [position, setPosition] = useState({ x: 100, y: 100 })
  const [isVisible, setIsVisible] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [user, setUser] = useState<any>(null)
  const widgetRef = useRef<HTMLDivElement>(null)
  
  const { 
    isRunning, 
    progress, 
    status,
    config,
    startScraping,
    stopScraping
  } = useScraperStore()

  useEffect(() => {
    loadMiniplayerState()
    loadUser()
  }, [])

  useEffect(() => {
    const handleVisibilityChange = ((e: CustomEvent) => {
      setIsVisible(e.detail.isVisible)
    }) as EventListener
    window.addEventListener('toggle-miniplayer', handleVisibilityChange)
    return () => window.removeEventListener('toggle-miniplayer', handleVisibilityChange)
  }, [])

  useEffect(() => {
    if (isVisible) {
      saveMiniplayerState()
    }
  }, [position, isVisible])

  const loadUser = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser()
      setUser(currentUser)
    } catch (error) {
      console.error('Failed to load user:', error)
    }
  }

  const loadMiniplayerState = async () => {
    try {
      const state = await window.electronAPI?.getMiniplayerState()
      if (state) {
        setPosition({ x: state.x, y: state.y })
        setIsVisible(state.isVisible)
      }
    } catch (error) {
      console.error('Failed to load miniplayer state:', error)
    }
  }

  const saveMiniplayerState = async () => {
    try {
      await window.electronAPI?.saveMiniplayerState({
        x: position.x,
        y: position.y,
        width: 380,
        height: 0,
        isVisible
      })
    } catch (error) {
      console.error('Failed to save miniplayer state:', error)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true)
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      })
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragOffset])

  const handleOpenExtended = () => {
    const event = new CustomEvent('open-expanded-view')
    window.dispatchEvent(event)
    handleClose()
  }

  const handleClose = async () => {
    setIsVisible(false)
    const event = new CustomEvent('toggle-miniplayer', { 
      detail: { isVisible: false } 
    })
    window.dispatchEvent(event)
    await window.electronAPI?.saveMiniplayerState({
      x: position.x,
      y: position.y,
      width: 380,
      height: 0,
      isVisible: false
    })
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

  if (!isVisible) return null

  const isDeepscan = progress.mode === 'deepscan'

  return (
    <div
      ref={widgetRef}
      className={cn(
        "fixed bg-card border-2 border-border rounded-lg shadow-2xl z-50 flex flex-col animate-slide-in",
        isDragging && "cursor-move"
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '380px',
        minWidth: '320px',
        maxWidth: '600px'
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="bg-secondary/50 px-4 py-2 flex items-center justify-between drag-handle cursor-move flex-shrink-0">
        <div className="flex items-center gap-2">
          <GripVertical size={16} className="text-muted-foreground" />
          <div className={cn(
            "w-2 h-2 rounded-full",
            isRunning ? "bg-green-500 animate-pulse" : "bg-gray-500"
          )} />
          <span className="text-sm font-medium">
            {isRunning ? 'Scraping' : 'Idle'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenExtended}
            className="hover:bg-accent p-1 rounded transition-colors"
            title="Open Extended View"
          >
            <Maximize2 size={16} />
          </button>
          <button
            onClick={handleClose}
            className="hover:bg-accent p-1 rounded transition-colors"
            title="Close Miniplayer"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      
      <div className="p-4 space-y-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className={isDeepscan ? 'text-muted-foreground' : ''}>Keywords</span>
            <span className={isDeepscan ? 'text-muted-foreground' : ''}>
              {isDeepscan ? '-/-' : `${progress.currentKeyword}/${progress.totalKeywords}`}
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-300",
                isDeepscan ? "bg-gray-600" : "bg-blue-500"
              )}
              style={{ 
                width: isDeepscan ? '0%' : `${progress.totalKeywords > 0 ? (progress.currentKeyword / progress.totalKeywords) * 100 : 0}%` 
              }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span>Subreddits</span>
            <span>{progress.currentSubreddit}/{progress.totalSubreddits}</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-purple-500 transition-all duration-300"
              style={{ 
                width: `${progress.totalSubreddits > 0 ? (progress.currentSubreddit / progress.totalSubreddits) * 100 : 0}%` 
              }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span>Posts (Current)</span>
            <span>{progress.currentIterationPosts}/{progress.maxIterationPosts || 0}</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: progress.maxIterationPosts > 0 ? `${(progress.currentIterationPosts / progress.maxIterationPosts) * 100}%` : '0%' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-secondary/30 rounded p-2">
            <div className="text-muted-foreground mb-1">CPU</div>
            <div className="font-bold text-base">{status.cpuUsage.toFixed(1)}%</div>
          </div>
          <div className="bg-secondary/30 rounded p-2">
            <div className="text-muted-foreground mb-1">RAM</div>
            <div className="font-bold text-base">{status.ramUsage.toFixed(1)}%</div>
          </div>
        </div>

        {progress.currentTarget && (
          <div className="text-xs text-muted-foreground text-center truncate">
            {progress.currentTarget}
          </div>
        )}
      </div>

      <div className="p-3 bg-secondary/50 border-t border-border flex gap-2 flex-shrink-0">
        {!isRunning ? (
          <button
            onClick={handleStart}
            className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-all text-sm font-medium"
          >
            <Play size={14} />
            Start
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="flex-1 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-all text-sm font-medium"
          >
            <Square size={14} />
            Stop
          </button>
        )}
      </div>
    </div>
  )
}