import { create } from 'zustand'

interface Log {
  time: string
  type: 'info' | 'error' | 'success' | 'warning'
  message: string
}

interface ScraperState {
  isRunning: boolean
  isPaused: boolean
  progress: {
    current: number
    total: number
    mode: string
    currentKeyword: number
    totalKeywords: number
    currentSubreddit: number
    totalSubreddits: number
    currentIterationPosts: number
    maxIterationPosts: number
    currentTarget: string
  }
  status: {
    postsCollected: number
    sentiment: number
    entities: number
    logs: Log[]
    cpuUsage: number
    ramUsage: number
    elapsedTime: number
  }
  config: {
    preset: string
    batchSize: number
    rateLimit: number
    mode: 'once' | 'infinite'
    cycleDelay: number
    enableSentiment: boolean
    enableEntities: boolean
    autoStop: boolean
    autoStopTarget: number
  }
  startScraping: () => void
  pauseScraping: () => void
  resumeScraping: () => void
  stopScraping: () => void
  updateConfig: (config: Partial<ScraperState['config']>) => void
  updateProgress: (progress: Partial<ScraperState['progress']>) => void
  updateStatus: (status: Partial<ScraperState['status']>) => void
  addLog: (log: Omit<Log, 'time'>) => void
}

export const useScraperStore = create<ScraperState>((set) => ({
  isRunning: false,
  isPaused: false,
  progress: {
    current: 0,
    total: 0,
    mode: '',
    currentKeyword: 0,
    totalKeywords: 0,
    currentSubreddit: 0,
    totalSubreddits: 0,
    currentIterationPosts: 0,
    maxIterationPosts: 0,
    currentTarget: ''
  },
  status: {
    postsCollected: 0,
    sentiment: 0,
    entities: 0,
    logs: [],
    cpuUsage: 0,
    ramUsage: 0,
    elapsedTime: 0
  },
  config: {
    preset: '',
    batchSize: 25,
    rateLimit: 60,
    mode: 'once',
    cycleDelay: 300,
    enableSentiment: true,
    enableEntities: false,
    autoStop: false,
    autoStopTarget: 100
  },
  startScraping: () => set({ isRunning: true, isPaused: false }),
  pauseScraping: () => set({ isPaused: true }),
  resumeScraping: () => set({ isPaused: false }),
  stopScraping: () => set({ 
    isRunning: false, 
    isPaused: false,
    progress: {
      current: 0,
      total: 0,
      mode: '',
      currentKeyword: 0,
      totalKeywords: 0,
      currentSubreddit: 0,
      totalSubreddits: 0,
      currentIterationPosts: 0,
      maxIterationPosts: 0,
      currentTarget: ''
    }
  }),
  updateConfig: (newConfig) => set((state) => ({ 
    config: { ...state.config, ...newConfig } 
  })),
  updateProgress: (newProgress) => set((state) => ({
    progress: { ...state.progress, ...newProgress }
  })),
  updateStatus: (newStatus) => set((state) => ({
    status: { ...state.status, ...newStatus }
  })),
  addLog: (log) => set((state) => ({
    status: {
      ...state.status,
      logs: [...state.status.logs, {
        time: new Date().toLocaleTimeString(),
        ...log
      }].slice(-100)
    }
  }))
}))