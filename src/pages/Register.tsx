import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, UserPlus, Check, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { AuthService } from '@/services/auth'
import { EncryptionService } from '@/services/encryption'
interface RegisterPageProps {
  onRegister: () => void
}
export default function RegisterPage({ onRegister }: RegisterPageProps) {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showRedditSecret, setShowRedditSecret] = useState(false)
  const [showSupabaseKey, setShowSupabaseKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [usernameError, setUsernameError] = useState('')
  const [passwordsMatch, setPasswordsMatch] = useState<boolean | null>(null)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    supabaseUrl: '',
    supabaseKey: '',
    redditClientId: '',
    redditClientSecret: ''
  })
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (formData.username.length >= 3) {
        checkUsername()
      } else if (formData.username.length > 0 && formData.username.length < 3) {
        setUsernameError('Username must be at least 3 characters')
        setUsernameAvailable(null)
      } else {
        setUsernameError('')
        setUsernameAvailable(null)
      }
    }, 500)
    return () => clearTimeout(delayDebounceFn)
  }, [formData.username])
  useEffect(() => {
    if (formData.confirmPassword.length > 0 && formData.password.length > 0) {
      setPasswordsMatch(formData.password === formData.confirmPassword)
    } else {
      setPasswordsMatch(null)
    }
  }, [formData.password, formData.confirmPassword])
  const checkUsername = async () => {
    setCheckingUsername(true)
    setUsernameError('')
    try {
      const available = await AuthService.checkUsernameAvailability(formData.username)
      setUsernameAvailable(available)
      if (!available) {
        setUsernameError('Username is already taken')
      }
    } catch (error) {
      setUsernameError('Could not check username')
    } finally {
      setCheckingUsername(false)
    }
  }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usernameAvailable && formData.username.length > 0) {
      toast.error('Please choose an available username')
      return
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setIsLoading(true)
    try {
      const user = await AuthService.register(
        formData.username,
        formData.email,
        formData.password,
        formData.supabaseUrl,
        formData.supabaseKey
      )
      const shouldEncrypt = true
      let redditCredentials = null
      if (formData.redditClientId && formData.redditClientSecret) {
        const creds = {
          clientId: formData.redditClientId,
          clientSecret: formData.redditClientSecret,
          userAgent: `SupaScrapeR/2.0 by ${formData.username}`
        }
        if (shouldEncrypt) {
          redditCredentials = await EncryptionService.encryptCredentials(creds, user.id, true)
        } else {
          redditCredentials = creds
        }
        await AuthService.updateCredentials(user.id, {
          reddit_credentials: redditCredentials
        })
      }
      toast.success('Registration successful! You can now log in.')
      navigate('/login')
    } catch (error: any) {
      toast.error(error.message || 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-xl shadow-2xl p-6">
          <div className="flex justify-center mb-4">
            <img src="./supascraper-complete-logo.png" alt="SupaScrapeR" className="h-10" />
          </div>
          <h2 className="text-xl font-bold text-center mb-4 bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
            Create Account
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className={`w-full px-3 py-2 text-sm bg-secondary/50 border rounded-lg focus:outline-none focus:ring-2 transition-all pr-10 ${
                    usernameError ? 'border-red-500 focus:ring-red-500' : 
                    usernameAvailable ? 'border-green-500 focus:ring-green-500' : 
                    'border-border focus:ring-primary'
                  }`}
                  placeholder="Username"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingUsername && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
                  {!checkingUsername && usernameAvailable && <Check size={16} className="text-green-500" />}
                  {!checkingUsername && usernameError && <X size={16} className="text-red-500" />}
                </div>
              </div>
              {usernameError && <p className="text-xs text-red-500 mt-1">{usernameError}</p>}
              {usernameAvailable && <p className="text-xs text-green-500 mt-1">Username is available</p>}
            </div>
            <div>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                placeholder="Email"
              />
            </div>
            <div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all pr-10"
                  placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className={`w-full px-3 py-2 text-sm bg-secondary/50 border rounded-lg focus:outline-none focus:ring-2 transition-all pr-10 ${
                    passwordsMatch === false ? 'border-red-500 focus:ring-red-500' :
                    passwordsMatch === true ? 'border-green-500 focus:ring-green-500' :
                    'border-border focus:ring-primary'
                  }`}
                  placeholder="Confirm Password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordsMatch === false && <p className="text-xs text-red-500 mt-1">Passwords do not match</p>}
            </div>
            <div className="pt-2">
              <p className="text-xs text-center text-muted-foreground mb-2">Reddit API (Optional)</p>
              <div className="space-y-2">
                <input
                  type="text"
                  value={formData.redditClientId}
                  onChange={(e) => setFormData({ ...formData, redditClientId: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  placeholder="Client ID"
                />
                <div className="relative">
                  <input
                    type={showRedditSecret ? 'text' : 'password'}
                    value={formData.redditClientSecret}
                    onChange={(e) => setFormData({ ...formData, redditClientSecret: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all pr-10"
                    placeholder="Client Secret"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRedditSecret(!showRedditSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showRedditSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="pt-2">
              <p className="text-xs text-center text-muted-foreground mb-2">Supabase Configuration (Required)</p>
              <div className="space-y-2">
                <input
                  type="url"
                  required
                  value={formData.supabaseUrl}
                  onChange={(e) => setFormData({ ...formData, supabaseUrl: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  placeholder="Project URL"
                />
                <div className="relative">
                  <input
                    type={showSupabaseKey ? 'text' : 'password'}
                    required
                    value={formData.supabaseKey}
                    onChange={(e) => setFormData({ ...formData, supabaseKey: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all pr-10"
                    placeholder="Anon Key"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSupabaseKey(!showSupabaseKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSupabaseKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading || !usernameAvailable}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm mt-4"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  Register
                </>
              )}
            </button>
          </form>
          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}