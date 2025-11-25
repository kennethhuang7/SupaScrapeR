import { createClient } from '@supabase/supabase-js'
import { centralSupabase } from '@/lib/centralSupabase'
import { ScraperConfig, RecentActivity, ScraperStats } from '../types/scraper'

let supabaseClient: any = null
let currentUrl: string = ''
let currentKey: string = ''

export const initSupabase = (url: string, anonKey: string) => {
	if (!url || !anonKey) return null
	
	if (supabaseClient && currentUrl === url && currentKey === anonKey) {
		return supabaseClient
	}
	
	currentUrl = url
	currentKey = anonKey
	
	supabaseClient = createClient(url, anonKey, {
		auth: {
			persistSession: false, 
			storageKey: 'supascraper-personal-auth', 
			storage: window.localStorage
		}
	})
	
	return supabaseClient
}

export const getSupabase = () => {
	if (!supabaseClient) {
		const stored = localStorage.getItem('supabase_credentials')
		if (stored) {
			try {
				const { url, key } = JSON.parse(stored)
				if (url && key) {
					return initSupabase(url, key)
				}
			} catch (e) {
				console.error('Failed to parse stored credentials:', e)
			}
		}
		return null
	}
	return supabaseClient
}

export async function getScraperConfig(userId: string): Promise<ScraperConfig | null> {
	const { data, error } = await centralSupabase
		.from('profiles')
		.select('scraper_config')
		.eq('id', userId)
		.single()
	
	if (error || !data?.scraper_config) return null
	return data.scraper_config as ScraperConfig
}

export async function updateScraperConfig(userId: string, config: ScraperConfig): Promise<boolean> {
	const { error } = await centralSupabase
		.from('profiles')
		.update({ scraper_config: config })
		.eq('id', userId)
	
	return !error
}

export async function addRecentActivity(userId: string, actionText: string): Promise<boolean> {
	const supabase = getSupabase()
	if (!supabase) return false
	
	const { count } = await supabase
		.from('recent_activities')
		.select('*', { count: 'exact', head: true })
		.eq('user_id', userId)
	
	if (count && count >= 10) {
		const { data: oldest } = await supabase
			.from('recent_activities')
			.select('id')
			.eq('user_id', userId)
			.order('created_at', { ascending: true })
			.limit(1)
			.single()
		
		if (oldest) {
			await supabase
				.from('recent_activities')
				.delete()
				.eq('id', oldest.id)
		}
	}
	
	const { error } = await supabase
		.from('recent_activities')
		.insert({ user_id: userId, action_text: actionText })
	
	return !error
}

export async function getRecentActivities(userId: string, limit: number = 4): Promise<RecentActivity[]> {
	const supabase = getSupabase()
	if (!supabase) return []
	
	const { data, error } = await supabase
		.from('recent_activities')
		.select('*')
		.eq('user_id', userId)
		.order('created_at', { ascending: false })
		.limit(limit)
	
	if (error || !data) return []
	return data as RecentActivity[]
}

export async function incrementTotalPosts(userId: string, count: number): Promise<boolean> {
	const supabase = getSupabase()
	if (!supabase) return false
	
	const { data: profile } = await supabase
		.from('profiles')
		.select('total_posts_scraped')
		.eq('id', userId)
		.single()
	
	const currentTotal = profile?.total_posts_scraped || 0
	const { error } = await supabase
		.from('profiles')
		.update({ total_posts_scraped: currentTotal + count })
		.eq('id', userId)
	
	return !error
}

export async function getPersonalPostCount(): Promise<number> {
	const supabase = getSupabase()
	if (!supabase) return 0
	
	const { count } = await supabase
		.from('reddit_posts')
		.select('*', { count: 'exact', head: true })
	
	return count || 0
}

export async function getScraperStats(userId: string): Promise<ScraperStats> {
	const supabase = getSupabase()
	if (!supabase) {
		return {
			total_posts: 0,
			session_posts: 0,
			total_presets: 0,
			public_presets: 0,
			public_preset_downloads: 0
		}
	}
	
	const personalPostCount = await getPersonalPostCount()
	
	const { count: totalPresets } = await centralSupabase
		.from('user_presets')
		.select('*', { count: 'exact', head: true })
		.eq('user_id', userId)
	
	const { count: publicPresets } = await centralSupabase
		.from('user_presets')
		.select('*', { count: 'exact', head: true })
		.eq('user_id', userId)
		.eq('is_public', true)
	
	const { data: userPresetIds } = await centralSupabase
		.from('user_presets')
		.select('id')
		.eq('user_id', userId)
	
	const presetIds = userPresetIds?.map(p => p.id) || []
	
	let publicDownloads = 0
	if (presetIds.length > 0) {
		const { data: communityPresets } = await centralSupabase
			.from('community_presets')
			.select('uses_count')
			.in('source_preset_id', presetIds)
		
		publicDownloads = communityPresets?.reduce((sum, p) => sum + (p.uses_count || 0), 0) || 0
	}
	
	return {
		total_posts: personalPostCount,
		session_posts: 0,
		total_presets: totalPresets || 0,
		public_presets: publicPresets || 0,
		public_preset_downloads: publicDownloads
	}
}

export async function getPersonalPostsOverTime(timeRange: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'): Promise<{ date: string; count: number }[]> {
	try {
		const supabase = getSupabase()
		if (!supabase) {
			return []
		}
		
		const { data: allPosts, error } = await supabase
			.from('reddit_posts')
			.select('collected_at')
			.order('collected_at', { ascending: true })
		
		if (error) {
			console.error('Supabase error:', error)
			return []
		}
		
		if (!allPosts || allPosts.length === 0) {
			return []
		}
		
		const now = new Date()
		let startDate: Date
		
		switch (timeRange) {
			case '1D':
				startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
				break
			case '1W':
				startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
				break
			case '1M':
				startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
				break
			case '3M':
				startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
				break
			case '1Y':
				startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
				break
			case 'ALL':
				startDate = new Date(0)
				break
			default:
				startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
		}
		
		const filteredPosts = allPosts.filter(post => {
			const postDate = new Date(post.collected_at)
			return postDate >= startDate
		})
		
		const groupedByDate: { [key: string]: number } = {}
		filteredPosts.forEach(post => {
			const date = new Date(post.collected_at)
			const dateKey = timeRange === '1D' 
				? date.toISOString()
				: date.toISOString().split('T')[0]
			groupedByDate[dateKey] = (groupedByDate[dateKey] || 0) + 1
		})
		
		const sortedDates = Object.keys(groupedByDate).sort()
		let cumulativeCount = 0
		const result = sortedDates.map(date => {
			cumulativeCount += groupedByDate[date]
			return { date, count: cumulativeCount }
		})
		
		return result
	} catch (error) {
		console.error('Error in getPersonalPostsOverTime:', error)
		return []
	}
}

function groupByTimeBucket(
	data: any[],
	timeRange: string
): { date: string; count: number }[] {
	const buckets: { [key: string]: number } = {}
	
	data.forEach(post => {
		const date = new Date(post.collected_at)
		let bucketKey: string
		
		if (timeRange === '1D') {
			bucketKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`
		} else if (timeRange === '1W' || timeRange === '1M') {
			bucketKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
		} else {
			bucketKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
		}
		
		buckets[bucketKey] = (buckets[bucketKey] || 0) + 1
	})
	
	return Object.entries(buckets)
		.map(([date, count]) => ({ date, count }))
		.sort((a, b) => a.date.localeCompare(b.date))
}