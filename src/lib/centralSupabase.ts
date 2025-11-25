import { createClient } from '@supabase/supabase-js'

const CENTRAL_SUPABASE_URL = 'https://omitxzblawsmbmptavby.supabase.co'
const CENTRAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9taXR4emJsYXdzbWJtcHRhdmJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MTMyOTksImV4cCI6MjA3NDQ4OTI5OX0.UmrLVOs8JSfGgV3_pGZt0NlsMwVxl-83WINVlJcld4w'

export const centralSupabase = createClient(CENTRAL_SUPABASE_URL, CENTRAL_SUPABASE_ANON_KEY, {
	auth: {
		persistSession: true,
		storageKey: 'central.auth.token',
		storage: window.localStorage
	}
})