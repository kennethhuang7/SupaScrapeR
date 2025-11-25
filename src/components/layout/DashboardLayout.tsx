import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useState, useEffect } from 'react'
import ScraperWidget from '../features/ScraperWidget'
interface DashboardLayoutProps {
  onLogout: () => void
}
export default function DashboardLayout({ onLogout }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed')
    return saved === 'true'
  })
  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', sidebarCollapsed.toString())
  }, [sidebarCollapsed])
  return (
    <div className="flex h-screen bg-background">
      <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} onLogout={onLogout} />
      <div style={{ marginLeft: sidebarCollapsed ? '80px' : '256px', transition: 'margin-left 0.3s ease', width: '100%', paddingTop: '32px' }}>
        <div className="h-full overflow-auto animate-fade-in">
          <Outlet />
        </div>
        <ScraperWidget />
      </div>
    </div>
  )
}