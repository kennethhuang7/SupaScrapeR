import { useState } from 'react'
import { Download, X, RotateCw } from 'lucide-react'
interface UpdateDialogProps {
  version: string
  onDownload: () => void
  onInstall: () => void
  onDismiss: () => void
  status: 'available' | 'downloading' | 'downloaded'
  progress?: number
}
export function UpdateDialog({ version, onDownload, onInstall, onDismiss, status, progress = 0 }: UpdateDialogProps) {
  const [isHovered, setIsHovered] = useState(false)
  return (
    <div 
      className="fixed top-4 right-4 z-[9999] animate-slide-in-right"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-xl border-2 border-blue-500/30 rounded-xl shadow-2xl p-5 min-w-[350px] max-w-[400px]">
        <button
          onClick={onDismiss}
          className={`absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500/20 hover:bg-red-500/30 border-2 border-red-500/50 flex items-center justify-center transition-all ${isHovered ? 'opacity-100' : 'opacity-0'}`}
        >
          <X size={14} className="text-red-500" />
        </button>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 relative">
            {status === 'downloading' ? (
              <>
                <svg className="w-12 h-12 absolute" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-blue-500/20"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 45}`}
                    strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                    className="text-blue-500 transition-all duration-300"
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <span className="text-xs font-bold text-blue-500 z-10">{Math.round(progress)}%</span>
              </>
            ) : status === 'downloaded' ? (
              <RotateCw size={24} className="text-green-500" />
            ) : (
              <Download size={24} className="text-blue-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg mb-1">
              {status === 'available' && 'Update Available'}
              {status === 'downloading' && 'Downloading Update'}
              {status === 'downloaded' && 'Update Ready'}
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              {status === 'available' && `Version ${version} is available for download`}
              {status === 'downloading' && `Downloading version ${version}...`}
              {status === 'downloaded' && `Version ${version} is ready to install`}
            </p>
            {status === 'available' && (
              <button
                onClick={onDownload}
                className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <Download size={16} />
                Download Update
              </button>
            )}
            {status === 'downloading' && (
              <div className="w-full bg-secondary/30 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            {status === 'downloaded' && (
              <button
                onClick={onInstall}
                className="w-full py-2 px-4 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <RotateCw size={16} />
                Restart & Install
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}