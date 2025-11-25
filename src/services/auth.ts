import { centralSupabase } from '@/lib/centralSupabase'
import { initSupabase } from '@/lib/supabase'
import { EncryptionService } from './encryption'
export interface User {
  id: string
  username: string
  email: string
  personal_supabase_url?: string
  personal_supabase_key?: string
  reddit_credentials?: any
  preferences?: any
  keep_signed_in?: boolean
}
export class AuthService {
  static async register(username: string, email: string, password: string, supabaseUrl: string, supabaseKey: string): Promise<User> {
    const { data: authData, error: authError } = await centralSupabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username
        }
      }
    })
    if (authError) throw authError
    if (!authData.user) throw new Error('Registration failed')
    await new Promise(resolve => setTimeout(resolve, 2000))
    const maxRetries = 5
    let profile = null
    for (let i = 0; i < maxRetries; i++) {
      const { data, error } = await centralSupabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single()
      if (data) {
        profile = data
        break
      }
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    if (!profile) {
      throw new Error('Profile creation failed. Please try again.')
    }
    const encryptedSupabaseUrl = await EncryptionService.encrypt(supabaseUrl, authData.user.id)
    const encryptedSupabaseKey = await EncryptionService.encrypt(supabaseKey, authData.user.id)
    const { error: updateError } = await centralSupabase
      .from('profiles')
      .update({
        personal_supabase_url: encryptedSupabaseUrl,
        personal_supabase_key: encryptedSupabaseKey,
        preferences: {
          security: {
            encryptCredentials: true
          }
        }
      })
      .eq('id', authData.user.id)
    if (updateError) {
      console.error('Failed to update profile with Supabase credentials:', updateError)
    }
    localStorage.setItem('user_personal_supabase', JSON.stringify({
      url: supabaseUrl,
      key: supabaseKey
    }))
    return {
      id: authData.user.id,
      username: username,
      email: authData.user.email!,
      personal_supabase_url: supabaseUrl,
      personal_supabase_key: supabaseKey
    }
  }
  static async login(email: string, password: string, rememberMe: boolean = false): Promise<User> {
    if (rememberMe) {
      await centralSupabase.auth.startAutoRefresh()
    }
    const { data: authData, error: authError } = await centralSupabase.auth.signInWithPassword({
      email,
      password
    })
    if (authError) throw new Error('Invalid email or password')
    if (!authData.user) throw new Error('Login failed')
    const { data: profile } = await centralSupabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single()
    const shouldDecrypt = profile?.preferences?.security?.encryptCredentials || false
    let supabaseUrl = profile?.personal_supabase_url
    let supabaseKey = profile?.personal_supabase_key
    let redditCreds = profile?.reddit_credentials
    if (shouldDecrypt && authData.user.id) {
      try {
        if (supabaseUrl) {
          supabaseUrl = await EncryptionService.decrypt(supabaseUrl, authData.user.id)
        }
        if (supabaseKey) {
          supabaseKey = await EncryptionService.decrypt(supabaseKey, authData.user.id)
        }
        if (redditCreds) {
          redditCreds = await EncryptionService.decryptCredentials(redditCreds, authData.user.id, true)
        }
      } catch (error) {
        console.error('Failed to decrypt credentials:', error)
      }
    }
    if (supabaseUrl && supabaseKey) {
      localStorage.setItem('user_personal_supabase', JSON.stringify({
        url: supabaseUrl,
        key: supabaseKey
      }))
      initSupabase(supabaseUrl, supabaseKey)
    }
    if (rememberMe) {
      localStorage.setItem('keep_signed_in', 'true')
    } else {
      localStorage.removeItem('keep_signed_in')
      sessionStorage.setItem('temp_session', 'true')
    }
    return {
      id: authData.user.id,
      username: profile?.username || email.split('@')[0],
      email: authData.user.email!,
      personal_supabase_url: supabaseUrl,
      personal_supabase_key: supabaseKey,
      reddit_credentials: redditCreds,
      preferences: profile?.preferences,
      keep_signed_in: rememberMe
    }
  }
  static async logout(): Promise<void> {
    await centralSupabase.auth.signOut()
    localStorage.removeItem('keep_signed_in')
    localStorage.removeItem('user_personal_supabase')
    localStorage.removeItem('supabase_credentials')
    localStorage.removeItem('app_settings')
    localStorage.removeItem('fontSize')
    sessionStorage.removeItem('temp_session')
  }
  static async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await centralSupabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await centralSupabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    const shouldDecrypt = profile?.preferences?.security?.encryptCredentials || false
    let supabaseUrl = profile?.personal_supabase_url
    let supabaseKey = profile?.personal_supabase_key
    let redditCreds = profile?.reddit_credentials
    if (shouldDecrypt && user.id) {
      try {
        if (supabaseUrl) {
          supabaseUrl = await EncryptionService.decrypt(supabaseUrl, user.id)
        }
        if (supabaseKey) {
          supabaseKey = await EncryptionService.decrypt(supabaseKey, user.id)
        }
        if (redditCreds) {
          redditCreds = await EncryptionService.decryptCredentials(redditCreds, user.id, true)
        }
      } catch (error) {
        console.error('Failed to decrypt credentials:', error)
      }
    }
    if (supabaseUrl && supabaseKey) {
      localStorage.setItem('user_personal_supabase', JSON.stringify({
        url: supabaseUrl,
        key: supabaseKey
      }))
      initSupabase(supabaseUrl, supabaseKey)
    }
    const keepSignedIn = localStorage.getItem('keep_signed_in')
    return {
      id: user.id,
      username: profile?.username || user.email?.split('@')[0] || 'User',
      email: user.email!,
      personal_supabase_url: supabaseUrl,
      personal_supabase_key: supabaseKey,
      reddit_credentials: redditCreds,
      preferences: profile?.preferences,
      keep_signed_in: keepSignedIn === 'true'
    }
  }
  static async checkUsernameAvailability(username: string): Promise<boolean> {
    const { data } = await centralSupabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .single()
    return !data
  }
  static async updateCredentials(userId: string, credentials: any): Promise<void> {
    const { error } = await centralSupabase
      .from('profiles')
      .update(credentials)
      .eq('id', userId)
    if (error) throw error
  }
}