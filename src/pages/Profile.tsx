import { useState, useEffect } from 'react'
import { User, Mail, Calendar, LogOut, Camera, Loader2, Trash2, Layers3 } from 'lucide-react'
import { AuthService } from '@/services/auth'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { centralSupabase } from '@/lib/centralSupabase'
export default function ProfilePage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [memberSince, setMemberSince] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  useEffect(() => {
    loadUserData()
  }, [])
  const loadUserData = async () => {
    const currentUser = await AuthService.getCurrentUser()
    if (currentUser?.id) {
      const { data } = await centralSupabase
        .from('profiles')
        .select('created_at, avatar_url')
        .eq('id', currentUser.id)
        .single()
      if (data?.created_at) {
        const date = new Date(data.created_at)
        setMemberSince(date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))
      }
      if (data?.avatar_url) {
        const { data: imageData } = centralSupabase.storage
          .from('avatars')
          .getPublicUrl(data.avatar_url)
        setProfileImage(imageData.publicUrl)
      }
      setUser(currentUser)
    }
    setIsLoading(false)
  }
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0] || !user) return
    const file = event.target.files[0]
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB')
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('File must be an image')
      return
    }
    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}.${fileExt}`
      const { error: uploadError } = await centralSupabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true })
      if (uploadError) throw uploadError
      const { error: updateError } = await centralSupabase
        .from('profiles')
        .update({ avatar_url: fileName })
        .eq('id', user.id)
      if (updateError) throw updateError
      const { data: imageData } = centralSupabase.storage
        .from('avatars')
        .getPublicUrl(fileName)
      setProfileImage(imageData.publicUrl + '?' + Date.now())
      toast.success('Profile picture updated!')
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error('Failed to upload image')
    } finally {
      setUploading(false)
    }
  }
  const handleRemoveImage = async () => {
    if (!user || !profileImage) return
    setRemoving(true)
    try {
      const { data } = await centralSupabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single()
      if (data?.avatar_url) {
        const { error: deleteError } = await centralSupabase.storage
          .from('avatars')
          .remove([data.avatar_url])
        if (deleteError) throw deleteError
      }
      const { error: updateError } = await centralSupabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id)
      if (updateError) throw updateError
      setProfileImage(null)
      toast.success('Profile picture removed')
    } catch (error: any) {
      console.error('Remove error:', error)
      toast.error('Failed to remove image')
    } finally {
      setRemoving(false)
    }
  }
  const handleLogout = async () => {
    try {
      await AuthService.logout()
      toast.success('Logged out successfully')
      navigate('/login')
    } catch (error) {
      toast.error('Failed to logout')
    }
  }
  if (isLoading || !user) {
    return (
      <div className="p-6 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your account settings and preferences</p>
        </div>
        <div className="max-w-2xl">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center animate-pulse">
                <User size={32} className="text-primary" />
              </div>
              <div className="space-y-2 flex-1">
                <div className="h-6 bg-secondary/50 rounded w-1/3 animate-pulse"></div>
                <div className="h-4 bg-secondary/50 rounded w-1/2 animate-pulse"></div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-16 bg-secondary/50 rounded animate-pulse"></div>
              <div className="h-16 bg-secondary/50 rounded animate-pulse"></div>
              <div className="h-16 bg-secondary/50 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings and preferences</p>
      </div>
      <div className="max-w-2xl">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div className="relative group">
                <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center overflow-hidden">
                  {profileImage ? (
                    <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User size={32} className="text-primary" />
                  )}
                </div>
                <label 
                  htmlFor="profile-upload" 
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-full cursor-pointer transition-opacity"
                >
                  {uploading ? (
                    <Loader2 size={24} className="text-white animate-spin" />
                  ) : (
                    <Camera size={24} className="text-white" />
                  )}
                </label>
                <input
                  id="profile-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </div>
              {profileImage && (
                <button
                  onClick={handleRemoveImage}
                  disabled={removing}
                  className="absolute -bottom-1 -right-1 w-7 h-7 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
                  title="Remove profile picture"
                >
                  {removing ? (
                    <Loader2 size={14} className="text-red-500 animate-spin" />
                  ) : (
                    <Trash2 size={14} className="text-red-500" />
                  )}
                </button>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{user.username}</h2>
              <p className="text-muted-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground mt-1">Hover over avatar to change</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
              <User size={20} className="text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Username</p>
                <p className="font-medium">{user.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
              <Mail size={20} className="text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
              <Calendar size={20} className="text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Member Since</p>
                <p className="font-medium">{memberSince}</p>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-border">
            <button
              onClick={() => navigate(`/user-presets?username=${user.username}`)}
              className="w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors mb-3"
              style={{ backgroundColor: '#1d3b2a', border: '1px solid #23533a', color: '#c6f6d5' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#204330'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1d3b2a'}
            >
              <Layers3 size={18} />
              View Public Presets
            </button>
            <button
              onClick={handleLogout}
              className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-500 font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={20} />
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}