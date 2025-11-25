import { X, Layers3, User, Calendar } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { centralSupabase } from '@/lib/centralSupabase'

interface UserProfilePopupProps {
  username: string
  onClose: () => void
}

export default function UserProfilePopup({ username, onClose }: UserProfilePopupProps) {
  const navigate = useNavigate()
  const [profileData, setProfileData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUserProfile()
  }, [username])

  const loadUserProfile = async () => {
    try {
      
      const { data: userData, error: userError } = await centralSupabase
        .from('profiles')
        .select('id, username, created_at, avatar_url')
        .eq('username', username)

      if (userError) throw userError

      if (!userData || userData.length === 0) {
        console.error('No user found with username:', username)
        return
      }

      const user = Array.isArray(userData) ? userData[0] : userData

      let avatarUrl = null
      if (user?.avatar_url) {
        const { data: imageData } = centralSupabase.storage
          .from('avatars')
          .getPublicUrl(user.avatar_url)
        avatarUrl = imageData.publicUrl
      }

      const memberSince = user?.created_at 
        ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : 'Unknown'

      setProfileData({
        username: user?.username,
        memberSince,
        avatarUrl
      })
    } catch (error) {
      console.error('Failed to load user profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewPresets = () => {
    navigate(`/user-presets?username=${username}`)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg max-w-md w-full p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">User Profile</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={24} />
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : profileData ? (
          <>
            <div className="flex items-center gap-4 mb-6">
              {profileData?.avatarUrl ? (
                <img src={profileData.avatarUrl} alt={profileData.username} className="w-16 h-16 rounded-full object-cover border-2 border-primary/50" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center text-white font-bold text-2xl border-2 border-primary/50">
                  {profileData?.username?.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold">{profileData?.username}</h3>
              </div>
            </div>
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Username</p>
                  <p className="font-medium">{profileData?.username}</p>
                </div>
              </div>
              {profileData?.memberSince && (
                <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Member Since</p>
                    <p className="font-medium">{profileData.memberSince}</p>
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleViewPresets} className="w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors" style={{ backgroundColor: '#1d3b2a', border: '1px solid #23533a', color: '#c6f6d5' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#204330'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1d3b2a'}>
              <Layers3 size={18} />
              View Public Presets
            </button>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">User not found</p>
          </div>
        )}
      </div>
    </div>
  )
}