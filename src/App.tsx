import { useState, useEffect } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { ThemeProvider } from './contexts/ThemeContext'
import TitleBar from './components/TitleBar'
import DashboardLayout from './components/layout/DashboardLayout'
import HomePage from './pages/Home'
import StatisticsPage from './pages/Statistics'
import PostsPage from './pages/Posts'
import PresetsPage from './pages/Presets'
import ScraperPage from './pages/Scraper'
import SettingsPage from './pages/Settings'
import ProfilePage from './pages/Profile'
import CommunityPage from './pages/Community'
import UserPresetsPage from './pages/UserPresets'
import ConfigurationPage from './pages/Configuration'
import LoginPage from './pages/Login'
import RegisterPage from './pages/Register'
import NotificationListener from './components/NotificationListener'
import ScraperExpandedView from './components/features/ScraperExpandedView'
import { AuthService } from './services/auth'
import { centralSupabase } from '@/lib/centralSupabase'
import { UpdateDialog } from '@/components/UpdateDialog'
function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showExpanded, setShowExpanded] = useState(false)
  const [updateDialogState, setUpdateDialogState] = useState<{
    show: boolean
    version: string
    status: 'available' | 'downloading' | 'downloaded'
    progress: number
  }>({
    show: false,
    version: '',
    status: 'available',
    progress: 0
  })
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await centralSupabase.auth.getSession()
        await new Promise(resolve => setTimeout(resolve, 500))
        const user = await AuthService.getCurrentUser()
        setIsLoggedIn(!!user)
        if (user?.preferences) {
          const settingsToSync = {
            interface: user.preferences.interface || {},
            notifications: user.preferences.notifications || {},
            security: user.preferences.security || {}
          }
          await window.electronAPI?.saveSettings(settingsToSync)
          if (user.preferences.interface?.fontSize) {
            const fontSize = user.preferences.interface.fontSize
            document.documentElement.style.fontSize = `${fontSize}px`
            const scale = fontSize / 16
            document.documentElement.style.setProperty('--toast-scale', scale.toString())
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        setIsLoggedIn(false)
      }
      setIsLoading(false)
      if (window.electronAPI?.onUpdateStatus) {
        window.electronAPI.onUpdateStatus((status: any) => {
          switch (status.type) {
            case 'available':
              setUpdateDialogState({
                show: true,
                version: status.version,
                status: 'available',
                progress: 0
              })
              break
            case 'downloading':
              setUpdateDialogState(prev => ({
                ...prev,
                status: 'downloading',
                progress: status.percent || 0
              }))
              break
            case 'downloaded':
              setUpdateDialogState(prev => ({
                ...prev,
                status: 'downloaded',
                progress: 100
              }))
              break
            case 'not-available':
              toast.success('You are on the latest version')
              break
            case 'error':
              toast.error('Failed to check for updates')
              setUpdateDialogState({ show: false, version: '', status: 'available', progress: 0 })
              break
          }
        })
      }
      const settings = await window.electronAPI?.getSettings()
      if (settings?.interface?.checkUpdatesStartup) {
        await window.electronAPI?.checkForUpdates()
      }
    }
    initializeApp()
  }, [])
  useEffect(() => {
    const handleFontSizeChange = (e: any) => {
      const fontSize = parseInt(e.detail.replace('px', ''))
      document.documentElement.style.fontSize = `${fontSize}px`
      const scale = fontSize / 16
      document.documentElement.style.setProperty('--toast-scale', scale.toString())
    }
    window.addEventListener('font-size-changed', handleFontSizeChange)
    return () => window.removeEventListener('font-size-changed', handleFontSizeChange)
  }, [])
  useEffect(() => {
    const handleOpenExpanded = () => {
      setShowExpanded(true)
    }
    window.addEventListener('open-expanded-view', handleOpenExpanded)
    return () => window.removeEventListener('open-expanded-view', handleOpenExpanded)
  }, [])
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault()
        window.location.reload()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  const handleLogin = async () => {
    try {
      const user = await AuthService.getCurrentUser()
      if (user?.preferences) {
        const settingsToSync = {
          interface: user.preferences.interface || {},
          notifications: user.preferences.notifications || {},
          security: user.preferences.security || {}
        }
        await window.electronAPI?.saveSettings(settingsToSync)
        if (user.preferences.interface?.fontSize) {
          const fontSize = user.preferences.interface.fontSize
          document.documentElement.style.fontSize = `${fontSize}px`
          const scale = fontSize / 16
          document.documentElement.style.setProperty('--toast-scale', scale.toString())
        }
      }
    } catch (error) {
      console.error('Failed to load user settings on login:', error)
    }
    setIsLoggedIn(true)
  }
  const handleLogout = async () => {
    await AuthService.logout()
    setIsLoggedIn(false)
  }
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen bg-background">
      <div className="text-foreground">Loading...</div>
    </div>
  }
  return (
    <ThemeProvider>
      <TitleBar />
      <Router>
        <NotificationListener />
        <Toaster 
          position="top-right" 
          expand={true}
          richColors 
          theme="dark" 
          toastOptions={{
            duration: 4000,
            style: {
              background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 100%)',
              color: 'hsl(var(--card-foreground))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '12px',
              padding: '14px 16px',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(12px)',
              fontSize: 'calc(1rem * var(--toast-scale, 1))',
              fontWeight: '500',
            },
            classNames: {
              toast: 'toast-custom',
              title: 'toast-title',
              description: 'toast-description',
              success: 'toast-success',
              error: 'toast-error',
              info: 'toast-info',
              warning: 'toast-warning',
            }
          }} 
        />
        <Routes>
          {!isLoggedIn ? (
            <>
              <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
              <Route path="/register" element={<RegisterPage onRegister={handleLogin} />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<DashboardLayout onLogout={handleLogout} />}>
                <Route index element={<HomePage />} />
                <Route path="statistics" element={<StatisticsPage />} />
                <Route path="posts" element={<PostsPage />} />
                <Route path="presets" element={<PresetsPage />} />
                <Route path="scraper" element={<ScraperPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="community" element={<CommunityPage />} />
                <Route path="/user-presets" element={<UserPresetsPage />} />
                <Route path="configuration" element={<ConfigurationPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
        {showExpanded && <ScraperExpandedView onClose={() => setShowExpanded(false)} />}
        {updateDialogState.show && (
          <UpdateDialog
            version={updateDialogState.version}
            status={updateDialogState.status}
            progress={updateDialogState.progress}
            onDownload={async () => {
              await window.electronAPI?.downloadUpdate()
            }}
            onInstall={() => {
              window.electronAPI?.installUpdate()
            }}
            onDismiss={() => {
              setUpdateDialogState({ show: false, version: '', status: 'available', progress: 0 })
            }}
          />
        )}
      </Router>
    </ThemeProvider>
  )
}
export default App