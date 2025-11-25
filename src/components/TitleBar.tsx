import { useState, useEffect } from 'react'
import { Minus, X, Square, Copy } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
export default function TitleBar() {
  const { theme } = useTheme()
  const [isMaximized, setIsMaximized] = useState(false)
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onMaximized(() => {
        setIsMaximized(true)
      })
      window.electronAPI.onUnmaximized(() => {
        setIsMaximized(false)
      })
    }
  }, [])
  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.send('window-minimize')
    }
  }
  const handleMaximize = () => {
    if (window.electronAPI) {
      window.electronAPI.send('window-maximize')
    }
  }
  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.send('window-close')
    }
  }
  return (
    <div 
      className={`fixed top-0 left-0 right-0 h-8 flex items-center justify-between px-4 z-[9999] ${
        theme === 'dark' ? 'bg-[#0f1419]' : 'bg-[#f5f5f5]'
      }`}
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      <div className="flex items-center gap-2">
        <img src="./supascraper-icon.png" alt="SupaScrapeR" className="h-4 w-4" />
        <span className="text-xs font-medium">SupaScrapeR</span>
      </div>
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button
          onClick={handleMinimize}
          className="h-8 w-12 flex items-center justify-center hover:bg-white/10 transition-colors"
          title="Minimize"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-8 w-12 flex items-center justify-center hover:bg-white/10 transition-colors"
          title={isMaximized ? "Restore Down" : "Maximize"}
        >
          {isMaximized ? <Copy size={11} className="rotate-180" /> : <Square size={11} />}
        </button>
        <button
          onClick={handleClose}
          className="h-8 w-12 flex items-center justify-center hover:bg-red-500 transition-colors"
          title="Close"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}