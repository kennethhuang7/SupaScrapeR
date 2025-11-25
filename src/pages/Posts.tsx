import { useState, useEffect } from 'react'
import { Database, Eye, Calendar, User, MessageSquare, TrendingUp, ExternalLink, X, Hash, Clock, ChevronLeft, ChevronRight, Search, Filter, Trash2, Columns, ArrowUpDown, ChevronDown, CheckSquare, ChevronsLeft, ChevronsRight, Download, FileJson, FileText, Code } from 'lucide-react'
import { AuthService } from '@/services/auth'
import { getSupabase } from '@/lib/supabase'
import { centralSupabase } from '@/lib/centralSupabase'
import { toast } from 'sonner'
import PostsFilterDialog, { PostsFilterState } from '@/components/PostsFilterDialog'
interface RedditPost {
  id: string
  post_id: string
  title: string
  body: string
  author: string
  subreddit: string
  url: string
  created_utc: string
  score: number
  num_comments: number
  upvote_ratio: number
  permalink: string
  link_flair_text: string
  over_18: boolean
  spoiler: boolean
  stickied: boolean
  sentiment_score: number
  sentiment_label: string
  entities: any[]
  comments: any[]
  keywords_found: string
  collected_at: string
  search_mode: string
  batch_id: string
  preset_name: string
  preset_id: string
  keyword_used: string
}
export default function PostsPage() {
  const [posts, setPosts] = useState<RedditPost[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState<RedditPost | null>(null)
  const [deleteConfirmPost, setDeleteConfirmPost] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPosts, setTotalPosts] = useState(0)
  const [showFilterDialog, setShowFilterDialog] = useState(false)
  const [detailedView, setDetailedView] = useState(false)
  const [sortBy, setSortBy] = useState<'scraped' | 'published' | 'score' | 'comments'>('scraped')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set())
  const [showDeleteMultipleConfirm, setShowDeleteMultipleConfirm] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [filters, setFilters] = useState<PostsFilterState>({
    searchQuery: '',
    subreddit: '',
    keyword: '',
    preset: '',
    author: '',
    sentiment: { positive: false, negative: false, neutral: false },
    minScore: '',
    minComments: '',
    searchMode: { keyword: false, deepscan: false, hybrid: false },
    dateRange: {
      scrapedStart: '',
      scrapedEnd: '',
      publishedStart: '',
      publishedEnd: ''
    }
  })
  const [presetMap, setPresetMap] = useState<{[key: string]: string}>({})
  const postsPerPage = 50
  useEffect(() => {
    loadPresets()
    const params = new URLSearchParams(window.location.search)
    const subredditFilter = params.get('subreddit')
    const keywordFilter = params.get('keyword')
    const presetFilter = params.get('preset')
    if (subredditFilter || keywordFilter || presetFilter) {
      setFilters(prev => ({
        ...prev,
        subreddit: subredditFilter || '',
        keyword: keywordFilter || '',
        preset: presetFilter || ''
      }))
    }
  }, [])
  useEffect(() => {
    loadPosts()
  }, [currentPage, filters, sortBy, sortOrder])
  const loadPresets = async () => {
    try {
      const user = await AuthService.getCurrentUser()
      if (!user) return
      const { data, error } = await centralSupabase
        .from('user_presets')
        .select('id, name')
        .eq('user_id', user.id)
      if (error) throw error
      const map: {[key: string]: string} = {}
      data?.forEach(preset => {
        map[preset.id] = preset.name
      })
      setPresetMap(map)
    } catch (error) {
      console.error('Failed to load presets:', error)
    }
  }
  const loadPosts = async () => {
    setLoading(true)
    try {
      const user = await AuthService.getCurrentUser()
      if (!user) return
      const supabase = getSupabase(user.id)
      const startIndex = (currentPage - 1) * postsPerPage
      let orderColumn = 'collected_at'
      if (sortBy === 'published') orderColumn = 'created_utc'
      else if (sortBy === 'score') orderColumn = 'score'
      else if (sortBy === 'comments') orderColumn = 'num_comments'
      let query = supabase
        .from('reddit_posts')
        .select('*', { count: 'exact' })
        .order(orderColumn, { ascending: sortOrder === 'asc' })
        .range(startIndex, startIndex + postsPerPage - 1)
      if (filters.searchQuery) {
        query = query.or(`title.ilike.%${filters.searchQuery}%,body.ilike.%${filters.searchQuery}%`)
      }
      if (filters.subreddit) {
        query = query.ilike('subreddit', filters.subreddit)
      }
      if (filters.keyword) {
        query = query.ilike('keyword_used', `%${filters.keyword}%`)
      }
      if (filters.preset) {
        query = query.eq('preset_id', filters.preset)
      }
      if (filters.author) {
        query = query.ilike('author', `%${filters.author}%`)
      }
      const selectedSentiments = Object.entries(filters.sentiment)
        .filter(([_, selected]) => selected)
        .map(([sentiment, _]) => sentiment)
      if (selectedSentiments.length > 0) {
        query = query.in('sentiment_label', selectedSentiments)
      }
      if (filters.minScore) {
        query = query.gte('score', parseInt(filters.minScore))
      }
      if (filters.minComments) {
        query = query.gte('num_comments', parseInt(filters.minComments))
      }
      const selectedModes = Object.entries(filters.searchMode)
        .filter(([_, selected]) => selected)
        .map(([mode, _]) => mode)
      if (selectedModes.length > 0) {
        query = query.in('search_mode', selectedModes)
      }
      if (filters.dateRange.scrapedStart) {
        query = query.gte('collected_at', filters.dateRange.scrapedStart)
      }
      if (filters.dateRange.scrapedEnd) {
        const endDate = new Date(filters.dateRange.scrapedEnd)
        endDate.setHours(23, 59, 59, 999)
        query = query.lte('collected_at', endDate.toISOString())
      }
      if (filters.dateRange.publishedStart) {
        query = query.gte('created_utc', filters.dateRange.publishedStart)
      }
      if (filters.dateRange.publishedEnd) {
        const endDate = new Date(filters.dateRange.publishedEnd)
        endDate.setHours(23, 59, 59, 999)
        query = query.lte('created_utc', endDate.toISOString())
      }
      const { data, error, count } = await query
      if (error) throw error
      setPosts(data || [])
      setTotalPosts(count || 0)
    } catch (error) {
      console.error('Failed to load posts:', error)
      toast.error('Failed to load posts')
    } finally {
      setLoading(false)
    }
  }
  const handleDelete = async (postId: string) => {
    try {
      const user = await AuthService.getCurrentUser()
      if (!user) return
      const supabase = getSupabase(user.id)
      const { error } = await supabase
        .from('reddit_posts')
        .delete()
        .eq('id', postId)
      if (error) throw error
      toast.success('Post deleted successfully')
      setDeleteConfirmPost(null)
      selectedPostIds.delete(postId)
      setSelectedPostIds(new Set(selectedPostIds))
      loadPosts()
    } catch (error) {
      console.error('Failed to delete post:', error)
      toast.error('Failed to delete post')
    }
  }
  const handleDeleteMultiple = async () => {
    try {
      const user = await AuthService.getCurrentUser()
      if (!user) return
      const supabase = getSupabase(user.id)
      const idsToDelete = Array.from(selectedPostIds)
      const { error } = await supabase
        .from('reddit_posts')
        .delete()
        .in('id', idsToDelete)
      if (error) throw error
      toast.success(`${idsToDelete.length} post${idsToDelete.length > 1 ? 's' : ''} deleted successfully`)
      setSelectedPostIds(new Set())
      setShowDeleteMultipleConfirm(false)
      loadPosts()
    } catch (error) {
      console.error('Failed to delete posts:', error)
      toast.error('Failed to delete posts')
    }
  }
  const getSelectedPosts = () => {
    return posts.filter(post => selectedPostIds.has(post.id))
  }
  const exportAsCSV = async () => {
    const selectedPosts = getSelectedPosts()
    const headers = ['Post ID', 'Title', 'Author', 'Subreddit', 'Score', 'Comments', 'Upvote Ratio', 'Sentiment', 'Sentiment Score', 'Search Mode', 'Keyword Used', 'Published Date', 'Scraped Date', 'URL', 'Permalink']
    const rows = selectedPosts.map(post => [
      post.post_id,
      `"${post.title.replace(/"/g, '""')}"`,
      post.author,
      post.subreddit,
      post.score,
      post.num_comments,
      post.upvote_ratio,
      post.sentiment_label,
      post.sentiment_score,
      post.search_mode,
      post.keyword_used || '',
      new Date(post.created_utc).toISOString(),
      new Date(post.collected_at).toISOString(),
      post.url,
      post.permalink
    ])
    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const result = await window.electronAPI?.saveExportFile({
      content: csv,
      filename: 'posts_export.csv',
      format: 'csv'
    })
    if (result?.success) {
      toast.success(`Exported to: ${result.filename}`)
      await window.electronAPI?.openFolder('exports')
    } else {
      toast.error('Failed to export posts')
    }
    setShowExportDialog(false)
  }

  const exportAsJSON = async () => {
    const selectedPosts = getSelectedPosts()
    const json = JSON.stringify(selectedPosts, null, 2)
    const result = await window.electronAPI?.saveExportFile({
      content: json,
      filename: 'posts_export.json',
      format: 'json'
    })
    if (result?.success) {
      toast.success(`Exported to: ${result.filename}`)
      await window.electronAPI?.openFolder('exports')
    } else {
      toast.error('Failed to export posts')
    }
    setShowExportDialog(false)
  }

  const exportAsSQL = async () => {
    const selectedPosts = getSelectedPosts()
    let sql = '-- Reddit Posts Export\n-- Generated: ' + new Date().toISOString() + '\n\n'
    sql += 'CREATE TABLE IF NOT EXISTS reddit_posts (\n'
    sql += '  id TEXT PRIMARY KEY,\n'
    sql += '  post_id TEXT,\n'
    sql += '  title TEXT,\n'
    sql += '  body TEXT,\n'
    sql += '  author TEXT,\n'
    sql += '  subreddit TEXT,\n'
    sql += '  score INTEGER,\n'
    sql += '  num_comments INTEGER,\n'
    sql += '  upvote_ratio REAL,\n'
    sql += '  sentiment_label TEXT,\n'
    sql += '  sentiment_score REAL,\n'
    sql += '  search_mode TEXT,\n'
    sql += '  keyword_used TEXT,\n'
    sql += '  created_utc TIMESTAMP,\n'
    sql += '  collected_at TIMESTAMP,\n'
    sql += '  url TEXT,\n'
    sql += '  permalink TEXT\n'
    sql += ');\n\n'
    selectedPosts.forEach(post => {
      const escapeSql = (val: any) => {
        if (val === null || val === undefined) return 'NULL'
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
        return val
      }
      sql += `INSERT INTO reddit_posts VALUES (\n`
      sql += `  ${escapeSql(post.id)},\n`
      sql += `  ${escapeSql(post.post_id)},\n`
      sql += `  ${escapeSql(post.title)},\n`
      sql += `  ${escapeSql(post.body)},\n`
      sql += `  ${escapeSql(post.author)},\n`
      sql += `  ${escapeSql(post.subreddit)},\n`
      sql += `  ${post.score},\n`
      sql += `  ${post.num_comments},\n`
      sql += `  ${post.upvote_ratio},\n`
      sql += `  ${escapeSql(post.sentiment_label)},\n`
      sql += `  ${post.sentiment_score},\n`
      sql += `  ${escapeSql(post.search_mode)},\n`
      sql += `  ${escapeSql(post.keyword_used)},\n`
      sql += `  ${escapeSql(new Date(post.created_utc).toISOString())},\n`
      sql += `  ${escapeSql(new Date(post.collected_at).toISOString())},\n`
      sql += `  ${escapeSql(post.url)},\n`
      sql += `  ${escapeSql(post.permalink)}\n`
      sql += `);\n\n`
    })
    const result = await window.electronAPI?.saveExportFile({
      content: sql,
      filename: 'posts_export.sql',
      format: 'sql'
    })
    if (result?.success) {
      toast.success(`Exported to: ${result.filename}`)
      await window.electronAPI?.openFolder('exports')
    } else {
      toast.error('Failed to export posts')
    }
    setShowExportDialog(false)
  }

  const exportAsReadable = async () => {
    const selectedPosts = getSelectedPosts()
    const timestamp = new Date().toLocaleString()
    let text = '================================================================================\n'
    text += 'REDDIT POSTS EXPORT\n'
    text += `Generated: ${timestamp}\n`
    text += `Total Posts: ${selectedPosts.length}\n`
    text += '================================================================================\n\n'
    selectedPosts.forEach((post, index) => {
      text += `\n${'='.repeat(80)}\n`
      text += `POST #${index + 1}\n`
      text += `${'='.repeat(80)}\n\n`
      text += `TITLE:\n${post.title}\n\n`
      text += `AUTHOR: u/${post.author}\n`
      text += `SUBREDDIT: r/${post.subreddit}\n\n`
      text += `URLS:\n`
      text += `  Original: ${post.url}\n`
      text += `  Reddit:   https://reddit.com${post.permalink}\n\n`
      text += `METRICS:\n`
      text += `  Score:        ${post.score}\n`
      text += `  Comments:     ${post.num_comments}\n`
      text += `  Upvote Ratio: ${(post.upvote_ratio * 100).toFixed(1)}%\n\n`
      text += `SENTIMENT:\n`
      text += `  Label: ${post.sentiment_label}\n`
      text += `  Score: ${post.sentiment_score.toFixed(3)}\n\n`
      text += `SCRAPING INFO:\n`
      text += `  Mode:    ${post.search_mode}\n`
      text += `  Keyword: ${post.keyword_used || 'N/A'}\n`
      text += `  Preset:  ${getPresetName(post.preset_id)}\n\n`
      text += `DATES:\n`
      text += `  Published: ${new Date(post.created_utc).toLocaleString()}\n`
      text += `  Scraped:   ${new Date(post.collected_at).toLocaleString()}\n\n`
      if (post.body) {
        text += `POST BODY:\n`
        text += `${'-'.repeat(80)}\n`
        text += `${post.body}\n`
        text += `${'-'.repeat(80)}\n\n`
      }
      if (post.keywords_found) {
        text += `KEYWORDS FOUND:\n${post.keywords_found}\n\n`
      }
      if (post.entities && post.entities.length > 0) {
        text += `ENTITIES DETECTED (${post.entities.length}):\n`
        post.entities.forEach((entity: any) => {
          text += `  - ${entity.text} (${entity.label})\n`
        })
        text += `\n`
      }
      if (post.comments && post.comments.length > 0) {
        text += `COMMENTS (${post.comments.length}):\n`
        text += `${'-'.repeat(80)}\n`
        post.comments.forEach((comment: any, idx: number) => {
          text += `\n[Comment #${idx + 1}] u/${comment.author}\n`
          text += `Score: ${comment.score} | Sentiment: ${comment.sentiment_label}\n`
          text += `${comment.body}\n`
          text += `Posted: ${new Date(comment.created_utc).toLocaleString()}\n`
        })
        text += `${'-'.repeat(80)}\n\n`
      }
    })
    text += `\n${'='.repeat(80)}\n`
    text += `END OF EXPORT - ${selectedPosts.length} POSTS TOTAL\n`
    text += `${'='.repeat(80)}\n`
    const result = await window.electronAPI?.saveExportFile({
      content: text,
      filename: 'posts_export.txt',
      format: 'txt'
    })
    if (result?.success) {
      toast.success(`Exported to: ${result.filename}`)
      await window.electronAPI?.openFolder('exports')
    } else {
      toast.error('Failed to export posts')
    }
    setShowExportDialog(false)
  }
  const togglePostSelection = (postId: string) => {
    const newSelected = new Set(selectedPostIds)
    if (newSelected.has(postId)) {
      newSelected.delete(postId)
    } else {
      newSelected.add(postId)
    }
    setSelectedPostIds(newSelected)
  }
  const selectAllOnPage = () => {
    const newSelected = new Set(selectedPostIds)
    posts.forEach(post => newSelected.add(post.id))
    setSelectedPostIds(newSelected)
  }
  const deselectAllOnPage = () => {
    const newSelected = new Set(selectedPostIds)
    posts.forEach(post => newSelected.delete(post.id))
    setSelectedPostIds(newSelected)
  }
  const areAllOnPageSelected = () => {
    return posts.every(post => selectedPostIds.has(post.id)) && posts.length > 0
  }
  const getSentimentColor = (label: string) => {
    switch (label) {
      case 'positive': return 'text-green-500'
      case 'negative': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }
  const getSentimentBadgeColor = (label: string) => {
    switch (label) {
      case 'positive': return 'bg-green-500/20 text-green-500'
      case 'negative': return 'bg-red-500/20 text-red-500'
      default: return 'bg-gray-500/20 text-gray-500'
    }
  }
  const totalPages = Math.ceil(totalPosts / postsPerPage)
  const handleApplyFilters = (newFilters: PostsFilterState) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }
  const getActiveFilterCount = () => {
    let count = 0
    if (filters.searchQuery) count++
    if (filters.subreddit) count++
    if (filters.keyword) count++
    if (filters.preset) count++
    if (filters.author) count++
    if (Object.values(filters.sentiment).some(Boolean)) count++
    if (filters.minScore) count++
    if (filters.minComments) count++
    if (Object.values(filters.searchMode).some(Boolean)) count++
    if (filters.dateRange.scrapedStart || filters.dateRange.scrapedEnd) count++
    if (filters.dateRange.publishedStart || filters.dateRange.publishedEnd) count++
    return count
  }
  const getPresetName = (presetId: string) => {
    return presetMap[presetId] || 'Deleted Preset'
  }
  const getSortLabel = () => {
    switch (sortBy) {
      case 'scraped': return 'Date Scraped'
      case 'published': return 'Date Published'
      case 'score': return 'Score'
      case 'comments': return 'Comments'
      default: return 'Sort By'
    }
  }
  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
  }
  const getPageNumbers = () => {
    const maxButtons = 10
    const pages: (number | string)[] = []
    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      const halfButtons = Math.floor(maxButtons / 2)
      let startPage = Math.max(1, currentPage - halfButtons)
      let endPage = Math.min(totalPages, currentPage + halfButtons)
      if (currentPage <= halfButtons) {
        endPage = maxButtons
      } else if (currentPage >= totalPages - halfButtons) {
        startPage = totalPages - maxButtons + 1
      }
      if (startPage > 1) {
        pages.push(1)
        if (startPage > 2) pages.push('...')
      }
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i)
      }
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) pages.push('...')
        pages.push(totalPages)
      }
    }
    return pages
  }
  const activeFiltersCount = getActiveFilterCount()
  if (loading && posts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <Database className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading posts...</p>
        </div>
      </div>
    )
  }
  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">Posts</h1>
        <p className="text-muted-foreground mt-1">View and analyze your scraped Reddit posts</p>
      </div>
      <div className="glass-card rounded-xl p-6">
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
              <input
                type="text"
                placeholder="Quick search by title or body..."
                value={filters.searchQuery}
                onChange={(e) => setFilters({...filters, searchQuery: e.target.value})}
                className="w-full pl-10 pr-4 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>
            {multiSelectMode && selectedPostIds.size > 0 && (
              <>
                <button
                  onClick={() => setShowExportDialog(true)}
                  className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <Download size={16} />
                  Export ({selectedPostIds.size})
                </button>
                <button
                  onClick={() => setShowDeleteMultipleConfirm(true)}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-lg text-sm transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <Trash2 size={16} />
                  Delete ({selectedPostIds.size})
                </button>
              </>
            )}
            {multiSelectMode && (
              <button
                onClick={areAllOnPageSelected() ? deselectAllOnPage : selectAllOnPage}
                className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <CheckSquare size={16} />
                {areAllOnPageSelected() ? 'Deselect Page' : 'Select Page'}
              </button>
            )}
            <button
              onClick={() => {
                setMultiSelectMode(!multiSelectMode)
                if (multiSelectMode) {
                  setSelectedPostIds(new Set())
                }
              }}
              className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${
                multiSelectMode ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              <CheckSquare size={16} />
              {multiSelectMode ? `Multi-Select (${selectedPostIds.size})` : 'Multi-Select'}
            </button>
            <button
              onClick={() => setDetailedView(!detailedView)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${
                detailedView ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              <Columns size={16} />
              {detailedView ? 'Compact' : 'Detailed'}
            </button>
            <div className="relative">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="bg-secondary hover:bg-secondary/80 text-foreground px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <ArrowUpDown size={18} />
                {getSortLabel()}
                <ChevronDown size={16} />
              </button>
              {showSortDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-10">
                  <button
                    onClick={() => {
                      setSortBy('scraped')
                      setShowSortDropdown(false)
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-secondary/50 rounded-t-lg ${sortBy === 'scraped' ? 'bg-secondary/30' : ''}`}
                  >
                    Date Scraped
                  </button>
                  <button
                    onClick={() => {
                      setSortBy('published')
                      setShowSortDropdown(false)
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-secondary/50 ${sortBy === 'published' ? 'bg-secondary/30' : ''}`}
                  >
                    Date Published
                  </button>
                  <button
                    onClick={() => {
                      setSortBy('score')
                      setShowSortDropdown(false)
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-secondary/50 ${sortBy === 'score' ? 'bg-secondary/30' : ''}`}
                  >
                    Score
                  </button>
                  <button
                    onClick={() => {
                      setSortBy('comments')
                      setShowSortDropdown(false)
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-secondary/50 rounded-b-lg ${sortBy === 'comments' ? 'bg-secondary/30' : ''}`}
                  >
                    Comments
                  </button>
                  <div className="border-t border-border mt-1 pt-1">
                    <button
                      onClick={toggleSortOrder}
                      className="w-full text-left px-4 py-2 hover:bg-secondary/50 rounded-b-lg text-sm"
                    >
                      {sortOrder === 'desc' ? '↓ Descending' : '↑ Ascending'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowFilterDialog(true)}
              className="px-4 py-2 bg-primary/20 hover:bg-primary/30 rounded-lg text-sm transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Filter size={16} />
              {activeFiltersCount > 0 ? `Filters (${activeFiltersCount})` : 'Filters'}
            </button>
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {totalPosts.toLocaleString()} {totalPosts === 1 ? 'post' : 'posts'}
            </div>
          </div>
        </div>
        {posts.length === 0 ? (
          <div className="text-center py-16">
            <Database className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No posts found</p>
            <p className="text-xs text-muted-foreground mt-2">
              {activeFiltersCount > 0 ? 'Try adjusting your filters' : 'Start scraping to see posts here'}
            </p>
          </div>
        ) : (
          <>
            <div className={`overflow-x-auto ${detailedView ? 'max-w-full' : ''}`}>
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr className="text-left text-sm text-muted-foreground">
                    {multiSelectMode && <th className="pb-3 font-medium text-center w-12"></th>}
                    <th className="pb-3 font-medium text-left">Title</th>
                    <th className="pb-3 font-medium text-center">Subreddit</th>
                    <th className="pb-3 font-medium text-center">Score</th>
                    <th className="pb-3 font-medium text-center">Comments</th>
                    <th className="pb-3 font-medium text-center">Sentiment</th>
                    <th className="pb-3 font-medium text-center">Published</th>
                    <th className="pb-3 font-medium text-center">Scraped</th>
                    {detailedView && <th className="pb-3 font-medium text-center">Author</th>}
                    {detailedView && <th className="pb-3 font-medium text-center">Comments Collected</th>}
                    {detailedView && <th className="pb-3 font-medium text-center">Upvote %</th>}
                    {detailedView && <th className="pb-3 font-medium text-center">Keyword</th>}
                    {detailedView && <th className="pb-3 font-medium text-center">Mode</th>}
                    {detailedView && <th className="pb-3 font-medium text-center">Preset</th>}
                    <th className="pb-3 font-medium text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {posts.map((post) => (
                    <tr key={post.id} className="hover:bg-secondary/30 transition-colors">
                      {multiSelectMode && (
                        <td className="py-3 text-center">
                          <label className="flex items-center justify-center cursor-pointer">
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={selectedPostIds.has(post.id)}
                                onChange={() => togglePostSelection(post.id)}
                                className="peer sr-only"
                              />
                              <div className="w-5 h-5 border-2 border-border rounded bg-secondary/50 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                                {selectedPostIds.has(post.id) && (
                                  <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </div>
                          </label>
                        </td>
                      )}
                      <td className="py-3 max-w-md">
                        <p className="font-medium truncate">{post.title}</p>
                      </td>
                      <td className="py-3 text-center">
                        <span className="text-sm text-blue-400">r/{post.subreddit}</span>
                      </td>
                      <td className="py-3 text-sm text-center">{post.score}</td>
                      <td className="py-3 text-sm text-center">{post.num_comments}</td>
                      <td className="py-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded ${getSentimentBadgeColor(post.sentiment_label)}`}>
                          {post.sentiment_label}
                        </span>
                      </td>
                      <td className="py-3 text-sm text-muted-foreground text-center">
                        {new Date(post.created_utc).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-sm text-muted-foreground text-center">
                        {new Date(post.collected_at).toLocaleDateString()}
                      </td>
                      {detailedView && (
                        <td className="py-3 text-center">
                          <span className="text-sm text-muted-foreground">u/{post.author}</span>
                        </td>
                      )}
                      {detailedView && (
                        <td className="py-3 text-sm text-center">{post.comments?.length || 0}</td>
                      )}
                      {detailedView && (
                        <td className="py-3 text-sm text-center">{(post.upvote_ratio * 100).toFixed(0)}%</td>
                      )}
                      {detailedView && (
                        <td className="py-3 text-center">
                          <span className="text-xs text-muted-foreground">{post.keyword_used || '-'}</span>
                        </td>
                      )}
                      {detailedView && (
                        <td className="py-3 text-center">
                          <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                            {post.search_mode}
                          </span>
                        </td>
                      )}
                      {detailedView && (
                        <td className="py-3 text-center">
                          <span className="text-xs text-muted-foreground">{getPresetName(post.preset_id)}</span>
                        </td>
                      )}
                      <td className="py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => setSelectedPost(post)} 
                            className="p-2 hover:bg-primary/20 rounded transition-colors" 
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmPost(post.id)} 
                            className="p-2 hover:bg-red-500/20 text-red-500 rounded transition-colors" 
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-border">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  title="First Page"
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                {getPageNumbers().map((page, idx) => (
                  typeof page === 'number' ? (
                    <button
                      key={idx}
                      onClick={() => setCurrentPage(page)}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                        currentPage === page
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary hover:bg-secondary/80'
                      }`}
                    >
                      {page}
                    </button>
                  ) : (
                    <span key={idx} className="px-2 text-muted-foreground">
                      {page}
                    </span>
                  )
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  title="Last Page"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {deleteConfirmPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setDeleteConfirmPost(null)}>
          <div className="bg-card border border-border rounded-lg max-w-md w-full p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-2">Delete Post</h3>
            <p className="text-muted-foreground mb-6">Are you sure you want to delete this post? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmPost(null)}
                className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmPost)}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeleteMultipleConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowDeleteMultipleConfirm(false)}>
          <div className="bg-card border border-border rounded-lg max-w-md w-full p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-2">Delete Multiple Posts</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete {selectedPostIds.size} post{selectedPostIds.size > 1 ? 's' : ''}? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteMultipleConfirm(false)}
                className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteMultiple}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
      {showExportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowExportDialog(false)}>
          <div className="bg-card border border-border rounded-lg max-w-md w-full p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-2">Export Posts</h3>
            <p className="text-muted-foreground mb-6">
              Choose a format to export {selectedPostIds.size} selected post{selectedPostIds.size > 1 ? 's' : ''}
            </p>
            <div className="space-y-3">
              <button
                onClick={exportAsCSV}
                className="w-full px-4 py-3 bg-secondary hover:bg-secondary/80 rounded-lg font-medium transition-colors flex items-center gap-3"
              >
                <FileText size={20} className="text-green-400" />
                <div className="text-left flex-1">
                  <div className="font-semibold">CSV (Comma-Separated)</div>
                  <div className="text-xs text-muted-foreground">Compatible with Excel, Google Sheets</div>
                </div>
              </button>
              <button
                onClick={exportAsJSON}
                className="w-full px-4 py-3 bg-secondary hover:bg-secondary/80 rounded-lg font-medium transition-colors flex items-center gap-3"
              >
                <FileJson size={20} className="text-blue-400" />
                <div className="text-left flex-1">
                  <div className="font-semibold">JSON</div>
                  <div className="text-xs text-muted-foreground">Raw structured data with all fields</div>
                </div>
              </button>
              <button
                onClick={exportAsSQL}
                className="w-full px-4 py-3 bg-secondary hover:bg-secondary/80 rounded-lg font-medium transition-colors flex items-center gap-3"
              >
                <Code size={20} className="text-purple-400" />
                <div className="text-left flex-1">
                  <div className="font-semibold">SQL Insert Statements</div>
                  <div className="text-xs text-muted-foreground">Ready to import into databases</div>
                </div>
              </button>
              <button
                onClick={exportAsReadable}
                className="w-full px-4 py-3 bg-secondary hover:bg-secondary/80 rounded-lg font-medium transition-colors flex items-center gap-3"
              >
                <FileText size={20} className="text-orange-400" />
                <div className="text-left flex-1">
                  <div className="font-semibold">Readable Text</div>
                  <div className="text-xs text-muted-foreground">Formatted for easy reading and printing</div>
                </div>
              </button>
            </div>
            <button
              onClick={() => setShowExportDialog(false)}
              className="w-full mt-4 px-4 py-2 bg-primary/20 hover:bg-primary/30 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6" onClick={() => setSelectedPost(null)}>
          <div className="bg-card border border-border rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-card border-b border-border p-6 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold">Post Details</h2>
              <button onClick={() => setSelectedPost(null)} className="p-2 hover:bg-secondary rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">{selectedPost.title}</h3>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User size={12} />
                    u/{selectedPost.author}
                  </span>
                  <span className="flex items-center gap-1">
                    <Hash size={12} />
                    r/{selectedPost.subreddit}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    Published: {new Date(selectedPost.created_utc).toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    Scraped: {new Date(selectedPost.collected_at).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Score</p>
                  <p className="text-xl font-bold">{selectedPost.score}</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Comments</p>
                  <p className="text-xl font-bold">{selectedPost.num_comments}</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Upvote Ratio</p>
                  <p className="text-xl font-bold">{(selectedPost.upvote_ratio * 100).toFixed(0)}%</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Sentiment</p>
                  <p className={`text-xl font-bold ${getSentimentColor(selectedPost.sentiment_label)}`}>
                    {selectedPost.sentiment_label}
                  </p>
                  <p className="text-xs text-muted-foreground">{selectedPost.sentiment_score.toFixed(3)}</p>
                </div>
              </div>
              {selectedPost.body && (
                <div className="bg-secondary/20 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Post Body</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedPost.body}</p>
                </div>
              )}
              {selectedPost.keywords_found && (
                <div className="bg-secondary/20 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Keywords Found</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPost.keywords_found.split(',').map((keyword, idx) => (
                      <span key={idx} className="px-2 py-1 bg-primary/20 text-primary rounded text-xs">
                        {keyword.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selectedPost.entities && selectedPost.entities.length > 0 && (
                <div className="bg-secondary/20 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Entities Detected ({selectedPost.entities.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPost.entities.map((entity, idx) => (
                      <span key={idx} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                        {entity.text} <span className="text-blue-300">({entity.label})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selectedPost.comments && selectedPost.comments.length > 0 && (
                <div className="bg-secondary/20 rounded-lg p-4">
                  <h4 className="font-semibold mb-3">Comments ({selectedPost.comments.length})</h4>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {selectedPost.comments.map((comment, idx) => (
                      <div key={idx} className="bg-background/50 rounded-lg p-3 border border-border/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-blue-400">u/{comment.author}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">↑ {comment.score}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${getSentimentBadgeColor(comment.sentiment_label)}`}>
                              {comment.sentiment_label}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{comment.body}</p>
                        <p className="text-xs text-muted-foreground mt-2">{new Date(comment.created_utc).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="bg-secondary/20 rounded-lg p-4">
                <h4 className="font-semibold mb-3">Metadata</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Post ID:</span>
                    <span className="font-mono text-xs">{selectedPost.post_id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Search Mode:</span>
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">{selectedPost.search_mode}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Preset:</span>
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">{getPresetName(selectedPost.preset_id)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Keyword Used:</span>
                    <span>{selectedPost.keyword_used || 'None'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Batch ID:</span>
                    <span className="font-mono text-xs">{selectedPost.batch_id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Flair:</span>
                    <span>{selectedPost.link_flair_text || 'None'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">NSFW:</span>
                    <span className={selectedPost.over_18 ? 'text-red-400' : 'text-green-400'}>{selectedPost.over_18 ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Spoiler:</span>
                    <span className={selectedPost.spoiler ? 'text-yellow-400' : 'text-muted-foreground'}>{selectedPost.spoiler ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Stickied:</span>
                    <span className={selectedPost.stickied ? 'text-green-400' : 'text-muted-foreground'}>{selectedPost.stickied ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <a
                  href={selectedPost.permalink.startsWith('http') ? selectedPost.permalink : `https://reddit.com${selectedPost.permalink}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-4 py-2 bg-primary/20 hover:bg-primary/30 rounded-lg text-center font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink size={16} />
                  View on Reddit
                </a>
                <a
                  href={selectedPost.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-center font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink size={16} />
                  Original URL
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
      {showFilterDialog && (
        <PostsFilterDialog
          onClose={() => setShowFilterDialog(false)}
          onApply={handleApplyFilters}
          initialFilters={filters}
          presetMap={presetMap}
        />
      )}
    </div>
  )
}