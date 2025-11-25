import { NavLink } from 'react-router-dom'
import { Home, BarChart3, Activity, Layers3, Search, Settings, ChevronLeft, ChevronRight, Users, User, LogOut, Bell, BellOff, MonitorPlay, Database } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AuthService } from '@/services/auth'
import { useState, useEffect } from 'react'
import { centralSupabase } from '@/lib/centralSupabase'
import { toast } from 'sonner'

interface SidebarProps {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  onLogout: () => void
}

const navigationItems = [
  { title: 'Home', url: '/', icon: Home },
  { title: 'Statistics', url: '/statistics', icon: BarChart3 },
  { title: 'Posts', url: '/posts', icon: Database },
  { title: 'Presets', url: '/presets', icon: Layers3 },
  { title: 'Community', url: '/community', icon: Users },
  { title: 'Scraper', url: '/scraper', icon: Search },
]

const bottomItems = [
  { title: 'Profile', url: '/profile', icon: User },
  { title: 'Settings', url: '/settings', icon: Settings },
]

export default function Sidebar({ collapsed, onCollapsedChange, onLogout }: SidebarProps) {
  const [user, setUser] = useState<any>(null)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [doNotDisturb, setDoNotDisturb] = useState(false)
  const [miniplayerVisible, setMiniplayerVisible] = useState(false)

  useEffect(() => {
    loadUser()
    loadSettings()
  }, [])

  const loadUser = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser()
      if (currentUser?.id) {
        setUser(currentUser)
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
      }
    } catch (error) {
      console.error('Failed to load user:', error)
    }
  }

  const loadSettings = async () => {
    try {
      const settings = await window.electronAPI?.getSettings()
      if (settings?.interface?.doNotDisturb !== undefined) {
        setDoNotDisturb(settings.interface.doNotDisturb)
      }
      const miniplayerState = await window.electronAPI?.getMiniplayerState()
      if (miniplayerState) {
        setMiniplayerVisible(miniplayerState.isVisible)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  useEffect(() => {
    const handleMiniplayerToggle = ((e: CustomEvent) => {
      setMiniplayerVisible(e.detail.isVisible)
    }) as EventListener
    window.addEventListener('toggle-miniplayer', handleMiniplayerToggle)
    return () => window.removeEventListener('toggle-miniplayer', handleMiniplayerToggle)
  }, [])

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

useEffect(() => {
  const handleDndChange = (e: any) => {
    setDoNotDisturb(e.detail)
  }
  window.addEventListener('dnd-changed', handleDndChange)
  return () => {
    window.removeEventListener('dnd-changed', handleDndChange)
  }
}, [])

  const toggleMiniplayer = async () => {
    const newVisibility = !miniplayerVisible
    setMiniplayerVisible(newVisibility)
    const event = new CustomEvent('toggle-miniplayer', { 
      detail: { isVisible: newVisibility } 
    })
    window.dispatchEvent(event)
    const miniplayerState = await window.electronAPI?.getMiniplayerState()
    await window.electronAPI?.saveMiniplayerState({
      ...miniplayerState,
      isVisible: newVisibility
    })
  }

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await AuthService.logout()
      onLogout()
    } catch (error) {
      console.error('Logout failed:', error)
      setIsLoggingOut(false)
    }
  }

  return (
    <aside style={{ width: collapsed ? '80px' : '256px', transition: 'width 0.3s ease' }} className="fixed left-0 top-0 h-full bg-sidebar/95 backdrop-blur-xl border-r border-sidebar-border z-50">
      <div className="flex flex-col h-full">
        <div className="pt-12 pb-4 px-4 border-b border-sidebar-border/50">
          <div className="flex items-center justify-center">
            <img src={collapsed ? "./supascraper-icon.png" : "./supascraper-complete-logo.png"} alt="SupaScrapeR" className={collapsed ? "h-14 w-14 object-contain transition-all duration-300" : "w-full px-4 object-contain transition-all duration-300"} />
          </div>
        </div>
        <button onClick={() => onCollapsedChange(!collapsed)} className="absolute -right-3 top-20 bg-sidebar-accent hover:bg-primary/20 border border-sidebar-border rounded-full p-1.5 transition-transform hover:scale-110 glow-primary-sm z-10">
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        <nav className="flex-1 p-3 overflow-y-auto">
          <div className="space-y-1">
            {!collapsed && (
              <p className="text-xs text-sidebar-foreground/40 uppercase tracking-wider px-3 py-2">Navigation</p>
            )}
            {navigationItems.map((item) => (
              <NavLink key={item.url} to={item.url} className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 group",
                isActive ? "bg-gradient-to-r from-primary/20 to-primary/10 text-primary border border-primary/20 shadow-lg shadow-primary/20" : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-primary",
                collapsed && "justify-center px-2"
              )}>
                <item.icon size={20} className="flex-shrink-0" />
                {!collapsed && <span className="font-medium whitespace-nowrap">{item.title}</span>}
              </NavLink>
            ))}
          </div>
        </nav>
        <div className="border-t border-sidebar-border/50 p-3 space-y-1">
          {bottomItems.map((item) => (
            <NavLink key={item.url} to={item.url} className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 group",
              isActive ? "bg-gradient-to-r from-primary/20 to-primary/10 text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent/50",
              collapsed && "justify-center px-2"
            )}>
              <item.icon size={20} className="flex-shrink-0" />
              {!collapsed && <span className="font-medium whitespace-nowrap">{item.title}</span>}
            </NavLink>
          ))}
          <button onClick={handleLogout} disabled={isLoggingOut} className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 w-full group",
            "text-sidebar-foreground hover:bg-destructive/20 hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed",
            collapsed && "justify-center px-2"
          )}>
            <LogOut size={20} className="flex-shrink-0" />
            {!collapsed && <span className="font-medium whitespace-nowrap">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>}
          </button>
        </div>
        {!collapsed && user && (
          <div className="p-4 border-t border-sidebar-border/50">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {profileImage ? (
                  <img 
                    src={profileImage} 
                    alt={user.username} 
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {user.username?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-sidebar-foreground/40 uppercase tracking-wider">Logged in as</p>
                  <p className="text-sm font-semibold text-primary mt-1 truncate">{user.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={toggleDoNotDisturb}
                  className={`p-1.5 rounded transition-all hover:scale-110 ${
                    doNotDisturb 
                      ? 'bg-primary/20 text-primary' 
                      : 'bg-sidebar-accent/50 text-sidebar-foreground/60 hover:text-sidebar-foreground'
                  }`}
                  title={doNotDisturb ? 'Disable Do Not Disturb' : 'Enable Do Not Disturb'}
                >
                  {doNotDisturb ? <BellOff size={16} /> : <Bell size={16} />}
                </button>
                <button
                  onClick={toggleMiniplayer}
                  className={`p-1.5 rounded transition-all hover:scale-110 ${
                    miniplayerVisible 
                      ? 'bg-primary/20 text-primary' 
                      : 'bg-sidebar-accent/50 text-sidebar-foreground/60 hover:text-sidebar-foreground'
                  }`}
                  title={miniplayerVisible ? 'Hide Miniplayer' : 'Show Miniplayer'}
                >
                  <MonitorPlay size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}