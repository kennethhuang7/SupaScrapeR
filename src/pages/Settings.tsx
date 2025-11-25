import { useState, useEffect } from 'react'
import { Save, RefreshCw, Shield, Bell, Eye, EyeOff, Moon, Sun, Download, Upload, RotateCcw, Lock, Unlock, AlertCircle, X, Trash2, User, AlertTriangle } from 'lucide-react'
import { FolderOpen, ExternalLink, Info } from 'lucide-react'
import { toast } from 'sonner'
import { AuthService } from '@/services/auth'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { UpdateChecker } from '@/services/updateChecker'
import { centralSupabase } from '@/lib/centralSupabase'
import { EncryptionService } from '@/services/encryption'
export default function SettingsPage() {
  const { theme, toggleTheme, fontSize: themeFontSize, setFontSize: setThemeFontSize } = useTheme()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('api')
  const [showRedditSecret, setShowRedditSecret] = useState(false)
  const [showSupabaseKey, setShowSupabaseKey] = useState(false)
  const [editingRedditId, setEditingRedditId] = useState(false)
  const [editingRedditSecret, setEditingRedditSecret] = useState(false)
  const [editingRedditAgent, setEditingRedditAgent] = useState(false)
  const [editingSupabaseUrl, setEditingSupabaseUrl] = useState(false)
  const [editingSupabaseKey, setEditingSupabaseKey] = useState(false)
  const [localFontSize, setLocalFontSize] = useState(16)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [originalSettings, setOriginalSettings] = useState<any>(null)
  const [showEncryptionDialog, setShowEncryptionDialog] = useState<'encrypt' | 'decrypt' | null>(null)
  const [user, setUser] = useState<any>(null)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [showEmail, setShowEmail] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteEmail, setDeleteEmail] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showDeletePassword, setShowDeletePassword] = useState(false)
  const [dataPath, setDataPath] = useState('')
  const [defaultPath, setDefaultPath] = useState('')
  const [directories, setDirectories] = useState({ base: '', logs: '', exports: '', settingsExports: '' })
  
  const [settings, setSettings] = useState({
    reddit: {
      clientId: '',
      clientSecret: '',
      userAgent: 'SupaScrapeR/2.0 by YourUsername',
      rateLimit: 60
    },
    supabase: {
      url: '',
      serviceKey: ''
    },
    interface: {
      autoRefreshDashboard: true,
      minimizeToTray: true,
      startWithSystem: false,
      startMinimized: false,
      hardwareAcceleration: true,
      discordPresence: false,
      checkUpdatesStartup: true,
      developerMode: false,
      theme: 'dark',
      fontSize: 12
    },
    notifications: {
      desktop: true,
      errors: true,
      completion: true,
      keywordCompletion: true,
      subredditCompletion: true,
      rateLimit: true
    },
    security: {
      encryptCredentials: true,
      autoDeleteLogs: true
    }
  })
  useEffect(() => {
    loadSettings()
  }, [])
  useEffect(() => {
    loadUserData()
  }, [])
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isHolding && holdProgress < 100) {
      interval = setInterval(() => {
        setHoldProgress(prev => prev + 2)
      }, 100)
    } else if (holdProgress >= 100 && isHolding) {
      setIsHolding(false)
      handleDeleteAccount()
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isHolding, holdProgress])
  useEffect(() => {
    if (originalSettings) {
      const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings) || 
                         localFontSize !== originalSettings.interface.fontSize ||
                         theme !== originalSettings.interface.theme
      setHasUnsavedChanges(hasChanges)
    }
  }, [settings, localFontSize, theme, originalSettings])
  useEffect(() => {
    loadDataPaths()
  }, [])
  useEffect(() => {
    const handleUpdateStatus = (event: any, data: any) => {
      switch (data.type) {
        case 'checking':
          toast.info('Checking for updates...')
          break
        case 'not-available':
          toast.success('You are running the latest version')
          break
        case 'available':
          toast.info(`Update available: v${data.version}`)
          break
        case 'error':
          toast.error('Unable to check for updates')
          break
      }
    }

    if (window.electronAPI?.onUpdateStatus) {
      window.electronAPI.onUpdateStatus(handleUpdateStatus)
    }
  }, [])

  const loadDataPaths = async () => {
    try {
      const customPath = await window.electronAPI?.getCustomDataPath()
      const defaultP = await window.electronAPI?.getDefaultDataPath()
      const dirs = await window.electronAPI?.getDataDirectories()
      setDataPath(customPath || defaultP)
      setDefaultPath(defaultP)
      setDirectories(dirs)
    } catch (error) {
      console.error('Failed to load data paths:', error)
    }
  }
  const loadUserData = async () => {
    const currentUser = await AuthService.getCurrentUser()
    if (currentUser?.id) {
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
      setUser(currentUser)
    }
  }
  const loadSettings = async () => {
    const user = await AuthService.getCurrentUser()
    const storedSupabase = localStorage.getItem('supabase_credentials')
    const storedSettings = localStorage.getItem('app_settings')
    const savedSize = localStorage.getItem('fontSize')
    let supabaseUrl = ''
    let supabaseKey = ''
    let redditCreds = null
    if (user?.personal_supabase_url && user?.personal_supabase_key) {
      const encryptionEnabled = user?.preferences?.security?.encryptCredentials === true
      if (encryptionEnabled) {
        try {
          const testUrl = await EncryptionService.decrypt(user.personal_supabase_url, user.id)
          if (testUrl && testUrl.startsWith('http')) {
            supabaseUrl = testUrl
            supabaseKey = await EncryptionService.decrypt(user.personal_supabase_key, user.id)
          } else {
            supabaseUrl = user.personal_supabase_url
            supabaseKey = user.personal_supabase_key
          }
        } catch {
          supabaseUrl = user.personal_supabase_url
          supabaseKey = user.personal_supabase_key
        }
      } else {
        supabaseUrl = user.personal_supabase_url
        supabaseKey = user.personal_supabase_key
      }
      localStorage.setItem('supabase_credentials', JSON.stringify({
        url: supabaseUrl,
        key: supabaseKey
      }))
    } else if (storedSupabase) {
      try {
        const parsed = JSON.parse(storedSupabase)
        supabaseUrl = parsed.url || ''
        supabaseKey = parsed.key || ''
      } catch (e) {
        console.error('Failed to parse stored Supabase credentials:', e)
      }
    }
    if (user?.reddit_credentials) {
      const encryptionEnabled = user?.preferences?.security?.encryptCredentials === true
      if (encryptionEnabled) {
        try {
          redditCreds = await EncryptionService.decryptCredentials(user.reddit_credentials, user.id, true)
          if (!redditCreds?.clientId || redditCreds.clientId.length < 10) {
            redditCreds = user.reddit_credentials
          }
        } catch {
          redditCreds = user.reddit_credentials
        }
      } else {
        redditCreds = user.reddit_credentials
      }
    }
    let initialFontSize = 12
    if (user?.preferences?.interface?.fontSize) {
      initialFontSize = user.preferences.interface.fontSize
    } else if (savedSize) {
      const parsed = parseInt(savedSize)
      if (!isNaN(parsed) && parsed >= 12 && parsed <= 20) {
        initialFontSize = parsed
      }
    }
    const newSettings = {
      reddit: {
        clientId: redditCreds?.clientId || '',
        clientSecret: redditCreds?.clientSecret || '',
        userAgent: redditCreds?.userAgent || `SupaScrapeR/2.0 by ${user?.username || 'YourUsername'}`,
        rateLimit: redditCreds?.rateLimit || 60
      },
      supabase: {
        url: supabaseUrl,
        serviceKey: supabaseKey
      },
      interface: {
        autoRefreshDashboard: true,
        minimizeToTray: true,
        startWithSystem: false,
        startMinimized: false,
        hardwareAcceleration: true,
        discordPresence: false,
        checkUpdatesStartup: true,
        developerMode: false,
        theme: theme,
        fontSize: initialFontSize
      },
      notifications: {
        desktop: true,
        errors: true,
        completion: true,
        keywordCompletion: true,
        subredditCompletion: true,
        rateLimit: true
      },
      security: {
        encryptCredentials: user?.preferences?.security?.encryptCredentials === true,
        autoDeleteLogs: true
      }
    }
    if (user?.preferences) {
      if (user.preferences.interface) {
        newSettings.interface = { ...newSettings.interface, ...user.preferences.interface }
        if (user.preferences.interface.fontSize && !isNaN(user.preferences.interface.fontSize)) {
          initialFontSize = user.preferences.interface.fontSize
        }
      }
      if (user.preferences.notifications) {
        newSettings.notifications = { ...newSettings.notifications, ...user.preferences.notifications }
      }
      if (user.preferences.security) {
        newSettings.security = { ...newSettings.security, ...user.preferences.security }
      }
    } else if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings)
        if (parsed.interface) {
          newSettings.interface = { ...newSettings.interface, ...parsed.interface }
          if (parsed.interface.fontSize && !isNaN(parsed.interface.fontSize)) {
            initialFontSize = parsed.interface.fontSize
          }
        }
        if (parsed.notifications) {
          newSettings.notifications = { ...newSettings.notifications, ...parsed.notifications }
        }
        if (parsed.security) {
          newSettings.security = { ...newSettings.security, ...parsed.security }
        }
      } catch (e) {
        console.error('Failed to parse stored settings:', e)
      }
    }
    setLocalFontSize(initialFontSize)
    document.documentElement.style.fontSize = `${initialFontSize}px`
    newSettings.interface.fontSize = initialFontSize
    await window.electronAPI?.saveSettings(newSettings)
    setSettings(newSettings)
    setOriginalSettings(JSON.parse(JSON.stringify(newSettings)))
  }
  const handleFontSizeChange = (size: number) => {
    setLocalFontSize(size)
    document.documentElement.style.fontSize = `${size}px`
    window.dispatchEvent(new CustomEvent('font-size-changed', { detail: `${size}px` }))
    setSettings(prev => ({
      ...prev,
      interface: { ...prev.interface, fontSize: size }
    }))
  }
  const maskCredential = (value: string) => {
    if (!value) return ''
    if (value.length <= 8) return '•'.repeat(value.length)
    return value.substring(0, 4) + '•'.repeat(value.length - 8) + value.substring(value.length - 4)
  }
  const handleSave = async () => {
    try {
      const user = await AuthService.getCurrentUser()
      if (user && user.id) {
        const shouldEncrypt = settings.security.encryptCredentials
        const wasEncrypted = user?.preferences?.security?.encryptCredentials === true
        let redditCredentials = settings.reddit
        let supabaseUrl = settings.supabase.url
        let supabaseKey = settings.supabase.serviceKey
        if (shouldEncrypt && !wasEncrypted) {
          redditCredentials = await EncryptionService.encryptCredentials(settings.reddit, user.id, true)
          supabaseUrl = await EncryptionService.encrypt(settings.supabase.url, user.id)
          supabaseKey = await EncryptionService.encrypt(settings.supabase.serviceKey, user.id)
        } else if (shouldEncrypt && wasEncrypted) {
          const { data: currentProfile } = await centralSupabase
            .from('profiles')
            .select('reddit_credentials, personal_supabase_url, personal_supabase_key')
            .eq('id', user.id)
            .single()
          const currentReddit = currentProfile?.reddit_credentials
          const currentSupabaseUrl = currentProfile?.personal_supabase_url
          const currentSupabaseKey = currentProfile?.personal_supabase_key
          let decryptedCurrentReddit = await EncryptionService.decryptCredentials(currentReddit, user.id, true)
          let decryptedCurrentSupabaseUrl = await EncryptionService.decrypt(currentSupabaseUrl, user.id)
          let decryptedCurrentSupabaseKey = await EncryptionService.decrypt(currentSupabaseKey, user.id)
          const redditChanged = JSON.stringify(settings.reddit) !== JSON.stringify(decryptedCurrentReddit)
          const supabaseUrlChanged = settings.supabase.url !== decryptedCurrentSupabaseUrl
          const supabaseKeyChanged = settings.supabase.serviceKey !== decryptedCurrentSupabaseKey
          if (redditChanged) {
            redditCredentials = await EncryptionService.encryptCredentials(settings.reddit, user.id, true)
          } else {
            redditCredentials = currentReddit
          }
          if (supabaseUrlChanged) {
            supabaseUrl = await EncryptionService.encrypt(settings.supabase.url, user.id)
          } else {
            supabaseUrl = currentSupabaseUrl
          }
          if (supabaseKeyChanged) {
            supabaseKey = await EncryptionService.encrypt(settings.supabase.serviceKey, user.id)
          } else {
            supabaseKey = currentSupabaseKey
          }
        }
        const updateData = {
          reddit_credentials: redditCredentials,
          personal_supabase_url: supabaseUrl,
          personal_supabase_key: supabaseKey,
          preferences: {
            interface: {
              ...settings.interface,
              theme: theme,
              fontSize: localFontSize
            },
            notifications: settings.notifications,
            security: settings.security
          }
        }
        const { error } = await centralSupabase
          .from('profiles')
          .update(updateData)
          .eq('id', user.id)
        if (error) {
          console.error('Database update error:', error)
          toast.error(`Failed to save to database: ${error.message}`)
          return
        }
      }
      if (settings.supabase.url && settings.supabase.serviceKey) {
        const { createClient } = await import('@supabase/supabase-js')
        const newSupabaseClient = createClient(settings.supabase.url, settings.supabase.serviceKey)
        localStorage.setItem('supabase_client_url', settings.supabase.url)
        localStorage.setItem('supabase_client_key', settings.supabase.serviceKey)
      }
      localStorage.setItem('supabase_credentials', JSON.stringify({
        url: settings.supabase.url,
        key: settings.supabase.serviceKey
      }))
      const settingsToSave = {
        interface: settings.interface,
        notifications: settings.notifications,
        security: settings.security
      }
      localStorage.setItem('app_settings', JSON.stringify(settingsToSave))
      document.documentElement.style.fontSize = `${localFontSize}px`
      localStorage.setItem('fontSize', localFontSize.toString())
      if (window.electronAPI && window.electronAPI.saveSettings) {
        try {
          await window.electronAPI.saveSettings(settingsToSave)
          if (typeof settings.interface.startWithSystem !== 'undefined' && window.electronAPI.setLoginItem) {
            await window.electronAPI.setLoginItem(settings.interface.startWithSystem)
          }
          if (window.electronAPI.updateTrayVisibility) {
            await window.electronAPI.updateTrayVisibility()
          }
        } catch (electronError) {
          console.error('Electron API error:', electronError)
        }
      }
      if (settings.interface.discordPresence) {
        const { DiscordRPCService } = await import('@/services/discordRPC')
        await DiscordRPCService.initialize(true)
      } else {
        const { DiscordRPCService } = await import('@/services/discordRPC')
        await DiscordRPCService.setEnabled(false)
      }
      const savedSettings = JSON.parse(JSON.stringify(settings))
      savedSettings.interface.theme = theme
      savedSettings.interface.fontSize = localFontSize
      setOriginalSettings(savedSettings)
      setHasUnsavedChanges(false)
      setEditingRedditId(false)
      setEditingRedditSecret(false)
      setEditingRedditAgent(false)
      setEditingSupabaseUrl(false)
      setEditingSupabaseKey(false)
      toast.success('Settings saved successfully!')
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('Failed to save settings')
    }
  }
  const handleEncryptionToggle = async (checked: boolean) => {
    if (checked) {
      setShowEncryptionDialog('encrypt')
    } else {
      setShowEncryptionDialog('decrypt')
    }
  }
  const confirmEncryptionChange = async () => {
    const user = await AuthService.getCurrentUser()
    if (!user?.id) {
      toast.error('User not found')
      setShowEncryptionDialog(null)
      return
    }
    try {
      if (showEncryptionDialog === 'encrypt') {
        const encryptedReddit = await EncryptionService.encryptCredentials(settings.reddit, user.id, true)
        const encryptedSupabaseUrl = await EncryptionService.encrypt(settings.supabase.url, user.id)
        const encryptedSupabaseKey = await EncryptionService.encrypt(settings.supabase.serviceKey, user.id)
        await centralSupabase
          .from('profiles')
          .update({
            reddit_credentials: encryptedReddit,
            personal_supabase_url: encryptedSupabaseUrl,
            personal_supabase_key: encryptedSupabaseKey,
            preferences: {
              ...user.preferences,
              security: {
                ...settings.security,
                encryptCredentials: true
              }
            }
          })
          .eq('id', user.id)
        setSettings(prev => ({
          ...prev,
          security: { ...prev.security, encryptCredentials: true }
        }))
        toast.success('Credentials encrypted successfully')
      } else {
        await centralSupabase
          .from('profiles')
          .update({
            reddit_credentials: settings.reddit,
            personal_supabase_url: settings.supabase.url,
            personal_supabase_key: settings.supabase.serviceKey,
            preferences: {
              ...user.preferences,
              security: {
                ...settings.security,
                encryptCredentials: false
              }
            }
          })
          .eq('id', user.id)
        setSettings(prev => ({
          ...prev,
          security: { ...prev.security, encryptCredentials: false }
        }))
        toast.success('Credentials decrypted successfully')
      }
    } catch (error) {
      console.error('Failed to toggle encryption:', error)
      toast.error('Failed to update encryption settings')
    }
    setShowEncryptionDialog(null)
  }
  const revertChanges = () => {
    if (originalSettings) {
      setSettings(JSON.parse(JSON.stringify(originalSettings)))
      setLocalFontSize(originalSettings.interface.fontSize)
      document.documentElement.style.fontSize = `${originalSettings.interface.fontSize}px`
      if (originalSettings.interface.theme !== theme) {
        toggleTheme()
      }
      setHasUnsavedChanges(false)
      setEditingRedditId(false)
      setEditingRedditSecret(false)
      setEditingRedditAgent(false)
      setEditingSupabaseUrl(false)
      setEditingSupabaseKey(false)
      toast.info('Changes reverted')
    }
  }
  const testRedditConnection = async () => {
    toast.info('Testing Reddit API connection...')
    try {
      const authString = btoa(`${settings.reddit.clientId}:${settings.reddit.clientSecret}`)
      const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': settings.reddit.userAgent
        },
        body: 'grant_type=client_credentials'
      })
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        console.error('Token error:', errorText)
        toast.error('Reddit API connection failed - Invalid credentials')
        return
      }
      const tokenData = await tokenResponse.json()
      const verifyResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'User-Agent': settings.reddit.userAgent
        }
      })
      if (verifyResponse.ok) {
        toast.success('Reddit API connection successful!')
      } else {
        toast.error('Reddit API connection failed')
      }
    } catch (error) {
      console.error('Reddit connection test error:', error)
      toast.error('Reddit API connection failed')
    }
  }
  const testSupabaseConnection = async () => {
    toast.info('Testing Supabase connection...')
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const testClient = createClient(settings.supabase.url, settings.supabase.serviceKey)
      const { error } = await testClient.from('profiles').select('count').limit(1)
      if (!error) {
        toast.success('Supabase connection successful!')
      } else {
        toast.error(`Supabase connection failed: ${error.message}`)
      }
    } catch (error) {
      toast.error('Supabase connection failed')
    }
  }
  const checkForUpdates = async () => {
    try {
      await window.electronAPI?.checkForUpdates()
    } catch (error) {
      console.error('Update check error:', error)
      toast.error('Failed to check for updates')
    }
  }
  const resetToDefaults = () => {
    setSettings({
      reddit: {
        clientId: settings.reddit.clientId,
        clientSecret: settings.reddit.clientSecret,
        userAgent: settings.reddit.userAgent,
        rateLimit: 60
      },
      supabase: {
        url: settings.supabase.url,
        serviceKey: settings.supabase.serviceKey
      },
      interface: {
        autoRefreshDashboard: true,
        minimizeToTray: true,
        startWithSystem: false,
        startMinimized: false,
        hardwareAcceleration: true,
        discordPresence: false,
        checkUpdatesStartup: true,
        developerMode: false,
        theme: 'dark',
        fontSize: 12
      },
      notifications: {
        desktop: true,
        errors: true,
        completion: true,
        keywordCompletion: true,
        subredditCompletion: true,
        rateLimit: true
      },
      security: {
        encryptCredentials: true,
        autoDeleteLogs: true
      }
    })
    setLocalFontSize(16)
    toast.success('Settings reset to defaults')
  }
  const exportSettings = async () => {
    const data = JSON.stringify(settings, null, 2)
    const result = await window.electronAPI?.saveExportFile({
      content: data,
      filename: 'supascraper-settings.json',
      format: 'json',
      type: 'settings'
    })
    if (result?.success) {
      toast.success(`Settings exported to: ${result.filename}`)
      await window.electronAPI?.openFolder('settingsExports')
    } else {
      toast.error('Failed to export settings')
    }
  }
  const importSettings = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const importedSettings = JSON.parse(text)
        if (!importedSettings.interface || !importedSettings.notifications || !importedSettings.security) {
          toast.error('Invalid settings file format')
          return
        }
        setSettings({
          reddit: {
            clientId: importedSettings.reddit?.clientId || settings.reddit.clientId,
            clientSecret: importedSettings.reddit?.clientSecret || settings.reddit.clientSecret,
            userAgent: importedSettings.reddit?.userAgent || settings.reddit.userAgent,
            rateLimit: importedSettings.reddit?.rateLimit || 60
          },
          supabase: {
            url: importedSettings.supabase?.url || settings.supabase.url,
            serviceKey: importedSettings.supabase?.serviceKey || settings.supabase.serviceKey
          },
          interface: { ...settings.interface, ...importedSettings.interface },
          notifications: { ...settings.notifications, ...importedSettings.notifications },
          security: { ...settings.security, ...importedSettings.security }
        })
        if (importedSettings.interface?.fontSize) {
          setLocalFontSize(importedSettings.interface.fontSize)
        }
        if (importedSettings.interface?.theme && importedSettings.interface.theme !== theme) {
          toggleTheme()
        }
        toast.success('Settings imported successfully. Click Save to apply changes.')
      } catch (error) {
        toast.error('Failed to import settings. Invalid file format.')
      }
    }
    input.click()
  }
  const clearCacheData = async () => {
    const confirmClear = window.confirm('This will clear all cached data and settings but keep you logged in. Continue?')
    if (!confirmClear) return
    try {
      const currentUser = await AuthService.getCurrentUser()
      if (!currentUser) {
        toast.error('No user logged in')
        return
      }
      localStorage.removeItem('app_settings')
      localStorage.removeItem('fontSize')
      localStorage.removeItem('supabase_credentials')
      if (window.electronAPI?.saveSettings) {
        await window.electronAPI.saveSettings({})
      }
      toast.success('Cache cleared successfully. Reloading settings...')
      await loadSettings()
    } catch (error) {
      console.error('Failed to clear cache:', error)
      toast.error('Failed to clear cache')
    }
  }
  const verifyCredentials = async () => {
    try {
      const { error } = await centralSupabase.auth.signInWithPassword({
        email: deleteEmail,
        password: deletePassword
      })
      return !error
    } catch {
      return false
    }
  }

  const handleDeleteAccount = async () => {
    if (isDeleting) return
    setIsDeleting(true)

    try {
      const { data: { user: authUser } } = await centralSupabase.auth.getUser()
      if (!authUser) throw new Error('User not found')

      const { data: profile } = await centralSupabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', authUser.id)
        .single()

      if (profile?.avatar_url) {
        await centralSupabase.storage.from('avatars').remove([profile.avatar_url])
      }

      const { error: deleteError } = await centralSupabase.rpc('delete_user')
      
      if (deleteError) {
        console.error('Delete user RPC error:', deleteError)
        throw deleteError
      }

      toast.success('Account deleted successfully')
      await AuthService.logout()
      window.location.href = '/login'
    } catch (error: any) {
      console.error('Delete account error:', error)
      toast.error('Failed to delete account: ' + (error.message || 'Unknown error'))
      setIsDeleting(false)
      setShowDeleteDialog(false)
      setHoldProgress(0)
      setIsHolding(false)
    }
  }
    const handleMouseDown = async () => {
      const isValid = await verifyCredentials()
      if (!isValid) {
        toast.error('Invalid email or password')
        return
      }
      setIsHolding(true)
    }

    const handleMouseUp = () => {
      if (holdProgress < 100) {
        setIsHolding(false)
        setHoldProgress(0)
      }
    }

  const maskEmail = (email: string) => {
    if (!email) return ''
    const [local, domain] = email.split('@')
    if (local.length <= 3) return `${local[0]}***@${domain}`
    return `${local.slice(0, 2)}${'*'.repeat(local.length - 2)}@${domain}`
  }
  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setIsChangingPassword(true)
    
    try {
      const { error: signInError } = await centralSupabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword
      })

      if (signInError) {
        toast.error('Current password is incorrect')
        setIsChangingPassword(false)
        return
      }

      const { error } = await centralSupabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      toast.success('Password changed successfully')
      setShowPasswordDialog(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      console.error('Password change error:', error)
      toast.error('Failed to change password')
    } finally {
      setIsChangingPassword(false)
    }
  }
  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Application Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your SupaScrapeR application preferences and system settings</p>
      </div>
      {hasUnsavedChanges && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <span className="text-yellow-500 font-medium">You have unsaved changes</span>
          </div>
          <button
            onClick={revertChanges}
            className="px-4 py-2 bg-secondary/50 hover:bg-secondary/80 rounded-lg flex items-center gap-2 transition-all text-sm"
          >
            <X size={16} />
            Revert Changes
          </button>
        </div>
      )}
      <div className="flex gap-6">
        <div className="w-64">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('api')}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg transition-all",
                activeTab === 'api' ? 'bg-primary/20 text-primary border border-primary/20' : 'hover:bg-accent/50'
              )}
            >
              My Account
            </button>
            <button
              onClick={() => setActiveTab('interface')}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg transition-all",
                activeTab === 'interface' ? 'bg-primary/20 text-primary border border-primary/20' : 'hover:bg-accent/50'
              )}
            >
              Interface Preferences
            </button>
            <button
              onClick={() => setActiveTab('storage')}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg transition-all",
                activeTab === 'storage' ? 'bg-primary/20 text-primary border border-primary/20' : 'hover:bg-accent/50'
              )}
            >
              <div className="flex items-center gap-2">
                Storage & Data
              </div>
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg transition-all",
                activeTab === 'notifications' ? 'bg-primary/20 text-primary border border-primary/20' : 'hover:bg-accent/50'
              )}
            >
              Notifications
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg transition-all",
                activeTab === 'security' ? 'bg-primary/20 text-primary border border-primary/20' : 'hover:bg-accent/50'
              )}
            >
              Security & Privacy
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg transition-all",
                activeTab === 'about' ? 'bg-primary/20 text-primary border border-primary/20' : 'hover:bg-accent/50'
              )}
            >
              About
            </button>
          </nav>
        </div>
        <div className="flex-1">
          {activeTab === 'api' && (
            <div className="space-y-6 tab-transition">
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-bold mb-6">My Account</h2>
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center overflow-hidden">
                    {profileImage ? (
                      <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User size={28} className="text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{user?.username || 'Loading...'}</h3>
                    <p className="text-sm text-muted-foreground">Account Information</p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Username</p>
                      <p className="font-medium">{user?.username || 'Loading...'}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">Email</p>
                      <p className="font-medium font-mono text-sm">
                        {showEmail ? user?.email : maskEmail(user?.email || '')}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowEmail(!showEmail)}
                      className="p-2 hover:bg-secondary/50 rounded transition-colors"
                    >
                      {showEmail ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  <button
                    onClick={() => setShowPasswordDialog(true)}
                    className="w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 border border-blue-600/30"
                  >
                    <Lock size={18} />
                    Change Password
                  </button>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-6 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">Reddit API Credentials</h2>
                    <button 
                      onClick={testRedditConnection}
                      className="px-4 py-2 bg-primary/20 hover:bg-primary/30 rounded-lg flex items-center gap-2 transition-all"
                    >
                      <RefreshCw size={16} />
                      Test Connection
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="block text-sm font-medium">Client ID</label>
                        <button
                          onClick={() => setEditingRedditId(!editingRedditId)}
                          className="p-1 hover:bg-accent rounded transition-all"
                          title={editingRedditId ? "Lock field" : "Edit field"}
                        >
                          {editingRedditId ? <Unlock size={14} /> : <Lock size={14} />}
                        </button>
                      </div>
                      <input
                        type="text"
                        value={editingRedditId ? settings.reddit.clientId : maskCredential(settings.reddit.clientId)}
                        onChange={(e) => setSettings({
                          ...settings,
                          reddit: { ...settings.reddit, clientId: e.target.value }
                        })}
                        disabled={!editingRedditId}
                        className="w-full px-4 py-2 bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 disabled:cursor-not-allowed"
                        placeholder="Enter your Reddit client ID"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="block text-sm font-medium">Client Secret</label>
                        <button
                          onClick={() => setEditingRedditSecret(!editingRedditSecret)}
                          className="p-1 hover:bg-accent rounded transition-all"
                          title={editingRedditSecret ? "Lock field" : "Edit field"}
                        >
                          {editingRedditSecret ? <Unlock size={14} /> : <Lock size={14} />}
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showRedditSecret && editingRedditSecret ? "text" : "text"}
                          value={editingRedditSecret ? (showRedditSecret ? settings.reddit.clientSecret : maskCredential(settings.reddit.clientSecret)) : maskCredential(settings.reddit.clientSecret)}
                          onChange={(e) => setSettings({
                            ...settings,
                            reddit: { ...settings.reddit, clientSecret: e.target.value }
                          })}
                          disabled={!editingRedditSecret}
                          className="w-full px-4 py-2 pr-10 bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 disabled:cursor-not-allowed"
                          placeholder="Enter your Reddit client secret"
                        />
                        {editingRedditSecret && (
                          <button
                            onClick={() => setShowRedditSecret(!showRedditSecret)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showRedditSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="block text-sm font-medium">User Agent</label>
                        <button
                          onClick={() => setEditingRedditAgent(!editingRedditAgent)}
                          className="p-1 hover:bg-accent rounded transition-all"
                          title={editingRedditAgent ? "Lock field" : "Edit field"}
                        >
                          {editingRedditAgent ? <Unlock size={14} /> : <Lock size={14} />}
                        </button>
                      </div>
                      <input
                        type="text"
                        value={settings.reddit.userAgent}
                        onChange={(e) => setSettings({
                          ...settings,
                          reddit: { ...settings.reddit, userAgent: e.target.value }
                        })}
                        disabled={!editingRedditAgent}
                        className="w-full px-4 py-2 bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 disabled:cursor-not-allowed"
                        placeholder="e.g., SupaScrapeR/2.0 by YourUsername"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-6 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">Supabase Configuration</h2>
                    <button 
                      onClick={testSupabaseConnection}
                      className="px-4 py-2 bg-primary/20 hover:bg-primary/30 rounded-lg flex items-center gap-2 transition-all"
                    >
                      <RefreshCw size={16} />
                      Test Connection
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="block text-sm font-medium">Project URL</label>
                        <button
                          onClick={() => setEditingSupabaseUrl(!editingSupabaseUrl)}
                          className="p-1 hover:bg-accent rounded transition-all"
                          title={editingSupabaseUrl ? "Lock field" : "Edit field"}
                        >
                          {editingSupabaseUrl ? <Unlock size={14} /> : <Lock size={14} />}
                        </button>
                      </div>
                      <input
                        type="text"
                        value={settings.supabase.url}
                        onChange={(e) => setSettings({
                          ...settings,
                          supabase: { ...settings.supabase, url: e.target.value }
                        })}
                        disabled={!editingSupabaseUrl}
                        className="w-full px-4 py-2 bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 disabled:cursor-not-allowed"
                        placeholder="https://your-project.supabase.co"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="block text-sm font-medium">Service Role Key</label>
                        <button
                          onClick={() => setEditingSupabaseKey(!editingSupabaseKey)}
                          className="p-1 hover:bg-accent rounded transition-all"
                          title={editingSupabaseKey ? "Lock field" : "Edit field"}
                        >
                          {editingSupabaseKey ? <Unlock size={14} /> : <Lock size={14} />}
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showSupabaseKey && editingSupabaseKey ? "text" : "text"}
                          value={editingSupabaseKey ? (showSupabaseKey ? settings.supabase.serviceKey : maskCredential(settings.supabase.serviceKey)) : maskCredential(settings.supabase.serviceKey)}
                          onChange={(e) => setSettings({
                            ...settings,
                            supabase: { ...settings.supabase, serviceKey: e.target.value }
                          })}
                          disabled={!editingSupabaseKey}
                          className="w-full px-4 py-2 pr-10 bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 disabled:cursor-not-allowed"
                          placeholder="Enter your Supabase service role key"
                        />
                        {editingSupabaseKey && (
                          <button
                            onClick={() => setShowSupabaseKey(!showSupabaseKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showSupabaseKey ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-500 mb-2 flex items-center gap-2">
                  <Shield size={20} />
                  Security Notice
                </h3>
                <p className="text-sm">Keep your API credentials secure and never share them with others. Enable encryption for sensitive data protection.</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-600 font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 border border-red-600/30"
                >
                  <AlertTriangle size={18} />
                  Delete Account
                </button>
              </div>
            </div>
          )}
          {activeTab === 'interface' && (
            <div className="space-y-6 tab-transition">
              <div className="bg-card border border-border rounded-lg p-6 space-y-6">
                <h2 className="text-xl font-bold mb-4">Appearance & Behavior</h2>
                <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                    <div>
                      <p className="font-medium">Theme</p>
                      <p className="text-sm text-muted-foreground">
                        Currently using {theme} mode
                      </p>
                    </div>
                  </div>
                  <Switch 
                    checked={theme === 'dark'} 
                    onCheckedChange={() => {
                      toggleTheme()
                      setSettings(prev => ({
                        ...prev,
                        interface: { 
                          ...prev.interface, 
                          theme: theme === 'dark' ? 'light' : 'dark'
                        }
                      }))
                    }} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-3">Font Size</label>
                  <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-lg">
                    <span className="text-xs">A</span>
                    <input
                      type="range"
                      min="12"
                      max="20"
                      step="1"
                      value={localFontSize}
                      onChange={(e) => handleFontSizeChange(parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-xl">A</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {localFontSize}px
                  </p>
                </div>
                <label className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                  <div>
                    <p className="font-medium">Hardware Acceleration</p>
                    <p className="text-sm text-muted-foreground">Use GPU for rendering (improves performance)</p>
                  </div>
                  <Switch
                    checked={settings.interface.hardwareAcceleration}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      interface: { ...settings.interface, hardwareAcceleration: checked }
                    })}
                  />
                </label>
                <label className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                  <span>Minimize to System Tray</span>
                  <Switch
                    checked={settings.interface.minimizeToTray}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      interface: { ...settings.interface, minimizeToTray: checked }
                    })}
                  />
                </label>
                <label className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                  <span>Start with System</span>
                  <Switch
                    checked={settings.interface.startWithSystem}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      interface: { ...settings.interface, startWithSystem: checked }
                    })}
                  />
                </label>
                <label className={`flex items-center justify-between p-4 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all ${!settings.interface.startWithSystem ? 'opacity-50' : ''}`}>
                  <div>
                    <p className="font-medium">Start Minimized</p>
                    <p className="text-sm text-muted-foreground">Start to system tray on launch</p>
                  </div>
                  <Switch
                    checked={settings.interface.startMinimized}
                    disabled={!settings.interface.startWithSystem}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      interface: { ...settings.interface, startMinimized: checked }
                    })}
                  />
                </label>
                <label className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                  <div>
                    <p className="font-medium">Discord Rich Presence</p>
                    <p className="text-sm text-muted-foreground">Show SupaScrapeR activity on Discord</p>
                  </div>
                  <Switch
                    checked={settings.interface.discordPresence}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      interface: { ...settings.interface, discordPresence: checked }
                    })}
                  />
                </label>
                <label className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                  <div>
                    <p className="font-medium">Check for Updates on Startup</p>
                    <p className="text-sm text-muted-foreground">Automatically check for new versions</p>
                  </div>
                  <Switch
                    checked={settings.interface.checkUpdatesStartup}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      interface: { ...settings.interface, checkUpdatesStartup: checked }
                    })}
                  />
                </label>
              </div>
            </div>
          )}
          {activeTab === 'storage' && (
            <div className="space-y-6 tab-transition">
              <div className="bg-card border border-border rounded-lg p-6 space-y-6">
                <h2 className="text-xl font-bold mb-4">Data Storage Location</h2>
                <div className="space-y-4">
                  <div className="p-4 bg-secondary/30 rounded-lg space-y-2">
                    <p className="text-sm text-muted-foreground">Current Storage Path</p>
                    <p className="font-mono text-sm break-all">{dataPath}</p>
                  </div>
                  <button
                    onClick={async () => {
                      const selected = await window.electronAPI?.selectFolder()
                      if (selected) {
                        const confirmChange = window.confirm(
                          `Change data storage location to:\n${selected}\n\nNote: Existing files will NOT be moved automatically. You'll need to move them manually if desired.`
                        )
                        if (confirmChange) {
                          const result = await window.electronAPI?.setCustomDataPath(selected)
                          if (result?.success) {
                            toast.success('Data path updated successfully')
                            await loadDataPaths()
                            setSettings({
                              ...settings
                            })
                          } else {
                            toast.error('Failed to update data path')
                          }
                        }
                      }
                    }}
                    className="w-full px-4 py-3 bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded-lg flex items-center justify-center gap-2 transition-all"
                  >
                    <FolderOpen size={18} />
                    Change Storage Location
                  </button>
                  {dataPath !== defaultPath && (
                    <button
                      onClick={async () => {
                        const confirmReset = window.confirm(
                          `Reset to default location:\n${defaultPath}\n\nNote: Existing files will NOT be moved automatically.`
                        )
                        if (confirmReset) {
                          const result = await window.electronAPI?.setCustomDataPath(null)
                          if (result?.success) {
                            toast.success('Reset to default location')
                            await loadDataPaths()
                          } else {
                            toast.error('Failed to reset path')
                          }
                        }
                      }}
                      className="w-full px-4 py-2 bg-secondary/50 hover:bg-secondary/80 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
                    >
                      Reset to Default
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                <h2 className="text-xl font-bold mb-4">Quick Access</h2>
                <button
                  onClick={() => window.electronAPI?.openFolder('base')}
                  className="w-full p-4 bg-secondary/30 hover:bg-secondary/40 rounded-lg flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen size={20} className="text-primary" />
                    <div className="text-left">
                      <p className="font-medium">Open Data Folder</p>
                      <p className="text-xs text-muted-foreground font-mono">{directories.base}</p>
                    </div>
                  </div>
                  <ExternalLink size={18} className="text-muted-foreground" />
                </button>
                <button
                  onClick={() => window.electronAPI?.openFolder('logs')}
                  className="w-full p-4 bg-secondary/30 hover:bg-secondary/40 rounded-lg flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen size={20} className="text-yellow-500" />
                    <div className="text-left">
                      <p className="font-medium">Open Error Logs</p>
                      <p className="text-xs text-muted-foreground font-mono">{directories.logs}</p>
                    </div>
                  </div>
                  <ExternalLink size={18} className="text-muted-foreground" />
                </button>
                <button
                  onClick={() => window.electronAPI?.openFolder('exports')}
                  className="w-full p-4 bg-secondary/30 hover:bg-secondary/40 rounded-lg flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen size={20} className="text-green-500" />
                    <div className="text-left">
                      <p className="font-medium">Open Exported Posts</p>
                      <p className="text-xs text-muted-foreground font-mono">{directories.exports}</p>
                    </div>
                  </div>
                  <ExternalLink size={18} className="text-muted-foreground" />
                </button>
                <button
                  onClick={() => window.electronAPI?.openFolder('settingsExports')}
                  className="w-full p-4 bg-secondary/30 hover:bg-secondary/40 rounded-lg flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen size={20} className="text-purple-500" />
                    <div className="text-left">
                      <p className="font-medium">Open Exported Settings</p>
                      <p className="text-xs text-muted-foreground font-mono">{directories.settingsExports}</p>
                    </div>
                  </div>
                  <ExternalLink size={18} className="text-muted-foreground" />
                </button>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <h3 className="font-semibold text-blue-500 mb-2 flex items-center gap-2">
                  <Info size={20} />
                  About Storage
                </h3>
                <p className="text-sm mb-2">Your SupaScrapeR data is organized in the following folders:</p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li><strong>Error Logs:</strong> Application error logs and crash reports</li>
                  <li><strong>Exported Posts:</strong> Posts exported from the Posts page</li>
                  <li><strong>Exported Settings:</strong> Settings configuration backups</li>
                </ul>
                <p className="text-sm mt-2 text-muted-foreground">Note: Scraped posts are stored in your Supabase database by default, not locally. You can visit the "Posts" page to export them.</p>
              </div>
            </div>
          )}
          {activeTab === 'notifications' && (
            <div className="space-y-6 tab-transition">
              <div className="bg-card border border-border rounded-lg p-6 space-y-6">
                <h2 className="text-xl font-bold mb-4">Notification Preferences</h2>
                <label className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                  <div className="flex items-center gap-3">
                    <Bell size={20} />
                    <span>Desktop Notifications</span>
                  </div>
                  <Switch
                    checked={settings.notifications.desktop}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, desktop: checked }
                    })}
                  />
                </label>
                <label className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                  <span>Error Notifications</span>
                  <Switch
                    checked={settings.notifications.errors}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, errors: checked }
                    })}
                  />
                </label>
                <label className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                  <span>Completion Notifications</span>
                  <Switch
                    checked={settings.notifications.completion}
                    onCheckedChange={(checked) => {
                      setSettings({
                        ...settings,
                        notifications: { 
                          ...settings.notifications, 
                          completion: checked,
                          keywordCompletion: checked,
                          subredditCompletion: checked
                        }
                      })
                    }}
                  />
                </label>
                <div className={`ml-8 space-y-3 ${!settings.notifications.completion ? 'opacity-50' : ''}`}>
                  <label className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                    <span className="text-sm">Keyword Completion Notifications</span>
                    <Switch
                      checked={settings.notifications.keywordCompletion}
                      disabled={!settings.notifications.completion}
                      onCheckedChange={(checked) => setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, keywordCompletion: checked }
                      })}
                    />
                  </label>
                  <label className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                    <span className="text-sm">Subreddit Completion Notifications</span>
                    <Switch
                      checked={settings.notifications.subredditCompletion}
                      disabled={!settings.notifications.completion}
                      onCheckedChange={(checked) => setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, subredditCompletion: checked }
                      })}
                    />
                  </label>
                </div>
                <label className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                  <span>Rate Limit Warnings</span>
                  <Switch
                    checked={settings.notifications.rateLimit}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, rateLimit: checked }
                    })}
                  />
                </label>
              </div>
            </div>
          )}
          {activeTab === 'security' && (
            <div className="space-y-6 tab-transition">
              <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                <h2 className="text-xl font-bold mb-4">Security & Privacy Settings</h2>
                <label className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                  <div>
                    <p className="font-medium">Encrypt Stored Credentials</p>
                    <p className="text-sm text-muted-foreground">Protect your API credentials with encryption</p>
                  </div>
                  <Switch
                    checked={settings.security.encryptCredentials}
                    onCheckedChange={handleEncryptionToggle}
                  />
                </label>
                <label className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                  <div>
                    <p className="font-medium">Auto-Delete Old Logs</p>
                    <p className="text-sm text-muted-foreground">Automatically remove logs older than 30 days</p>
                  </div>
                  <Switch
                    checked={settings.security.autoDeleteLogs}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      security: { ...settings.security, autoDeleteLogs: checked }
                    })}
                  />
                </label>
                <button 
                  onClick={clearCacheData}
                  className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg flex items-center justify-center gap-2 transition-all text-red-400"
                >
                  <Trash2 size={16} />
                  Clear Cache & Data
                </button>
              </div>
            </div>
          )}
          {activeTab === 'about' && (
            <div className="space-y-6 tab-transition">
              <div className="bg-card border border-border rounded-lg p-6 space-y-6">
                <h2 className="text-xl font-bold mb-4">About SupaScrapeR</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                    <span className="font-medium">Version</span>
                    <span className="text-muted-foreground">v2.0.1</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                    <span className="font-medium">Build Type</span>
                    <span className="text-muted-foreground">Production</span>
                  </div>
                  <label className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/40 transition-all">
                    <div>
                      <p className="font-medium">Developer Mode</p>
                      <p className="text-sm text-muted-foreground">Enable developer tools shortcuts</p>
                    </div>
                    <Switch
                      checked={settings.interface.developerMode}
                      onCheckedChange={(checked) => setSettings({
                        ...settings,
                        interface: { ...settings.interface, developerMode: checked }
                      })}
                    />
                  </label>
                  <button 
                    onClick={checkForUpdates}
                    onMouseEnter={(e) => {
                      const icon = e.currentTarget.querySelector('svg')
                      if (icon) {
                        icon.style.transition = 'transform 0.5s ease-in-out'
                        icon.style.transform = 'rotate(360deg)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      const icon = e.currentTarget.querySelector('svg')
                      if (icon) {
                        icon.style.transform = 'rotate(0deg)'
                      }
                    }}
                    className="w-full px-4 py-2 bg-primary/20 hover:bg-primary/30 rounded-lg flex items-center justify-center gap-2 transition-all"
                  >
                    <RefreshCw size={16} style={{ transition: 'transform 0.5s ease-in-out' }} />
                    Check for Updates
                  </button>
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-semibold mb-3">Resources</h3>
                <div className="space-y-2">
                  <a 
                    href="https://github.com/kennethhuang7/SupaScrapeR#readme" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block p-3 bg-secondary/30 hover:bg-secondary/50 rounded-lg transition-all flex items-center justify-between group"
                  >
                    <span>Documentation</span>
                    <ExternalLink size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                  </a>
                  <a 
                    href="https://github.com/kennethhuang7/SupaScrapeR" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block p-3 bg-secondary/30 hover:bg-secondary/50 rounded-lg transition-all flex items-center justify-between group"
                  >
                    <span>GitHub Repository</span>
                    <ExternalLink size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                  </a>
                  <a 
                    href="https://github.com/kennethhuang7/SupaScrapeR/issues" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block p-3 bg-secondary/30 hover:bg-secondary/50 rounded-lg transition-all flex items-center justify-between group"
                  >
                    <span>Report an Issue</span>
                    <ExternalLink size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-between items-center mt-8 pt-6 border-t border-border">
        <div className="flex gap-3">
          <button 
            onClick={resetToDefaults}
            className="px-4 py-2 bg-secondary/50 hover:bg-secondary/80 rounded-lg flex items-center gap-2 transition-all"
          >
            <RotateCcw size={16} />
            Reset to Defaults
          </button>
          <div className="flex gap-3">
            <button onClick={importSettings} className="px-4 py-2 bg-secondary/50 hover:bg-secondary/80 rounded-lg flex items-center gap-2 transition-all">
              <Upload size={16} />
              Import Settings
            </button>
            <button onClick={exportSettings} className="px-4 py-2 bg-secondary/50 hover:bg-secondary/80 rounded-lg flex items-center gap-2 transition-all">
              <Download size={16} />
              Export Settings
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={revertChanges}
            disabled={!hasUnsavedChanges}
            className="px-6 py-2 bg-secondary/50 hover:bg-secondary/80 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 btn-gradient text-white rounded-lg flex items-center gap-2"
          >
            <Save size={16} />
            Save All Changes
          </button>
        </div>
      </div>
      {showEncryptionDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowEncryptionDialog(null)}>
          <div className="bg-card border border-border rounded-lg max-w-md w-full p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-2">
              {showEncryptionDialog === 'encrypt' ? 'Enable Encryption' : 'Disable Encryption'}
            </h3>
            <p className="text-muted-foreground mb-6">
              {showEncryptionDialog === 'encrypt' 
                ? 'This will encrypt your stored credentials using your user ID. Your credentials will be more secure.' 
                : 'This will store your credentials in plain text. This is less secure and not recommended.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEncryptionDialog(null)}
                className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmEncryptionChange}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  showEncryptionDialog === 'encrypt' 
                    ? 'bg-primary hover:bg-primary/80 text-white' 
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                {showEncryptionDialog === 'encrypt' ? 'Enable' : 'Disable'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showPasswordDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => !isChangingPassword && setShowPasswordDialog(false)}>
          <div className="bg-card border border-border rounded-lg max-w-md w-full p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-2">Change Password</h3>
            <p className="text-muted-foreground mb-6">Enter your current password and choose a new one</p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value)
                    setDeletePassword(e.target.value)
                  }}
                  placeholder="Enter current password"
                  disabled={isChangingPassword}
                  className="w-full px-4 py-2 bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  disabled={isChangingPassword}
                  className="w-full px-4 py-2 bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  disabled={isChangingPassword}
                  className="w-full px-4 py-2 bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPasswordDialog(false)
                  setCurrentPassword('')
                  setNewPassword('')
                  setConfirmPassword('')
                  setDeletePassword('')
                }}
                disabled={isChangingPassword}
                className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                disabled={!currentPassword || !newPassword || !confirmPassword || isChangingPassword}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isChangingPassword ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => !isDeleting && setShowDeleteDialog(false)}>
          <div className="bg-card border border-red-500/30 rounded-lg max-w-md w-full p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="text-red-500" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-red-500">Delete Account</h3>
                <p className="text-sm text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Confirm Email</label>
                <input
                  type="email"
                  value={deleteEmail}
                  onChange={(e) => setDeleteEmail(e.target.value)}
                  placeholder="Enter your email"
                  disabled={isDeleting}
                  className="w-full px-4 py-2 bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showDeletePassword ? "text" : "password"}
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter your password"
                    disabled={isDeleting}
                    className="w-full px-4 py-2 pr-10 bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeletePassword(!showDeletePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showDeletePassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteDialog(false)
                  setDeleteEmail('')
                  setDeletePassword('')
                  setHoldProgress(0)
                  setIsHolding(false)
                }}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                disabled={deleteEmail !== user?.email || deletePassword.length === 0 || isDeleting}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                style={{
                  backgroundColor: (deleteEmail === user?.email && deletePassword.length > 0) ? '#7f1d1d' : '#3f3f46',
                  color: (deleteEmail === user?.email && deletePassword.length > 0) ? '#fca5a5' : '#a1a1aa'
                }}
              >
                <div 
                  className="absolute inset-0 bg-red-600 transition-all"
                  style={{ 
                    width: `${holdProgress}%`,
                    opacity: 0.5
                  }}
                />
                <span className="relative z-10">
                  {isDeleting ? 'Deleting...' : isHolding ? `Hold (${Math.ceil((100 - holdProgress) / 20)}s)` : 'Hold to Delete'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}