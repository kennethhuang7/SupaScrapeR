import { centralSupabase } from '@/lib/centralSupabase'
import { EncryptionService } from '@/services/encryption'

export async function getDecryptedCredentials(userId: string) {
  const { data: profileData } = await centralSupabase
    .from('profiles')
    .select('personal_supabase_url, personal_supabase_key, preferences, reddit_credentials')
    .eq('id', userId)
    .single()

  if (!profileData) {
    throw new Error('Profile not found')
  }

  let supabaseUrl = profileData.personal_supabase_url
  let supabaseKey = profileData.personal_supabase_key
  let redditCreds = profileData.reddit_credentials

  const shouldDecrypt = profileData?.preferences?.security?.encryptCredentials || false
  
  if (shouldDecrypt) {
    try {
      supabaseUrl = await EncryptionService.decrypt(supabaseUrl, userId)
      supabaseKey = await EncryptionService.decrypt(supabaseKey, userId)
      redditCreds = await EncryptionService.decryptCredentials(redditCreds, userId, true)
    } catch (error) {
      console.error('Failed to decrypt credentials:', error)
      throw new Error('Failed to decrypt credentials')
    }
  }

  return {
    supabase_url: supabaseUrl,
    supabase_key: supabaseKey,
    reddit_client_id: redditCreds?.clientId,
    reddit_client_secret: redditCreds?.clientSecret,
    reddit_user_agent: redditCreds?.userAgent || 'SupaScraperBETA/2.0'
  }
}