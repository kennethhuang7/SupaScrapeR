import { useState, useEffect } from 'react'
import { Download, Flag, X, Target, Users, Settings, Layers3, Filter, FilterX, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { centralSupabase } from '@/lib/centralSupabase'
import { AuthService } from '@/services/auth'
import { useSearchParams } from 'react-router-dom'
import FilterDialog, { FilterState } from '@/components/FilterDialog'

interface CommunityPreset {
  id: string
  user_id: string
  username: string
  name: string
  description: string
  keywords: string[]
  subreddits: string[]
  mode: string
  config: any
  is_public: boolean
  uses_count: number
  created_at: string
  source_preset_id?: string
}

export default function UserPresetsPage() {
  const [searchParams] = useSearchParams()
  const username = searchParams.get('username')
  const [presets, setPresets] = useState<CommunityPreset[]>([])
  const [filteredPresets, setFilteredPresets] = useState<CommunityPreset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('popular')
  const [showKeywordsPopup, setShowKeywordsPopup] = useState<string[] | null>(null)
  const [showSubredditsPopup, setShowSubredditsPopup] = useState<string[] | null>(null)
  const [showReportDialog, setShowReportDialog] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [reportedPresets, setReportedPresets] = useState<Set<string>>(new Set())
  const [downloadedPresets, setDownloadedPresets] = useState<Set<string>>(new Set())
  const [showFilterDialog, setShowFilterDialog] = useState(false)
  const [activeFilters, setActiveFilters] = useState<FilterState>({
    searchTitle: '',
    searchDescription: '',
    searchAuthor: '',
    modes: { keyword: false, deepscan: false, both: false },
    keywords: { include: '', exclude: '' },
    subreddits: { include: '', exclude: '' },
    subredditsBoth: {
      keywordInclude: '',
      keywordExclude: '',
      deepscanInclude: '',
      deepscanExclude: ''
    }
  })

  useEffect(() => {
    if (username) {
      loadUserPresets()
      loadUserReports()
      loadDownloadedPresets()
    }
  }, [username, filter])

  useEffect(() => {
    applyFilters()
  }, [presets, activeFilters])

  const loadUserPresets = async () => {
    try {
      setIsLoading(true)
      let query = centralSupabase
        .from('community_presets')
        .select('*')
        .eq('username', username)
        .eq('is_public', true)
      if (filter === 'popular') {
        query = query.order('uses_count', { ascending: false })
      } else if (filter === 'recent') {
        query = query.order('created_at', { ascending: false })
      }
      const { data, error } = await query
      if (error) {
        console.error('Failed to load user presets:', error)
        toast.error('Failed to load user presets')
        return
      }
      setPresets(data || [])
    } catch (error) {
      console.error('Error loading user presets:', error)
      toast.error('Failed to load user presets')
    } finally {
      setIsLoading(false)
    }
  }

  const loadDownloadedPresets = async () => {
    try {
      const user = await AuthService.getCurrentUser()
      if (!user) return
      const { data, error } = await centralSupabase
        .from('user_presets')
        .select('source_community_preset_id')
        .eq('user_id', user.id)
        .not('source_community_preset_id', 'is', null)
      if (error) throw error
      const downloaded = new Set(data?.map(p => p.source_community_preset_id).filter(Boolean) || [])
      setDownloadedPresets(downloaded)
    } catch (error) {
      console.error('Failed to load downloaded presets:', error)
    }
  }

  const applyFilters = () => {
    let filtered = [...presets]
    if (activeFilters.searchTitle.trim()) {
      const searchLower = activeFilters.searchTitle.toLowerCase()
      filtered = filtered.filter(p => p.name.toLowerCase().includes(searchLower))
    }
    if (activeFilters.searchDescription.trim()) {
      const searchLower = activeFilters.searchDescription.toLowerCase()
      filtered = filtered.filter(p => p.description && p.description.toLowerCase().includes(searchLower))
    }
    const selectedModes = Object.entries(activeFilters.modes)
      .filter(([_, selected]) => selected)
      .map(([mode, _]) => mode)
    if (selectedModes.length > 0) {
      filtered = filtered.filter(p => selectedModes.includes(p.mode))
    }
    if (activeFilters.keywords.include.trim()) {
      const includeKeywords = activeFilters.keywords.include.split(',').map(k => k.trim().toLowerCase()).filter(k => k)
      filtered = filtered.filter(p =>
        includeKeywords.some(kw => p.keywords.some(pk => pk.toLowerCase().includes(kw)))
      )
    }
    if (activeFilters.keywords.exclude.trim()) {
      const excludeKeywords = activeFilters.keywords.exclude.split(',').map(k => k.trim().toLowerCase()).filter(k => k)
      filtered = filtered.filter(p =>
        !excludeKeywords.some(kw => p.keywords.some(pk => pk.toLowerCase().includes(kw)))
      )
    }
    if (activeFilters.modes.both) {
      if (activeFilters.subredditsBoth.keywordInclude.trim()) {
        const includeSubs = activeFilters.subredditsBoth.keywordInclude.split(',').map(s => s.trim().toLowerCase()).filter(s => s)
        filtered = filtered.filter(p =>
          p.mode === 'both' &&
          includeSubs.some(sub => p.config?.keywordSubreddits?.some((ps: string) => ps.toLowerCase().includes(sub)))
        )
      }
      if (activeFilters.subredditsBoth.keywordExclude.trim()) {
        const excludeSubs = activeFilters.subredditsBoth.keywordExclude.split(',').map(s => s.trim().toLowerCase()).filter(s => s)
        filtered = filtered.filter(p =>
          p.mode !== 'both' ||
          !excludeSubs.some(sub => p.config?.keywordSubreddits?.some((ps: string) => ps.toLowerCase().includes(sub)))
        )
      }
      if (activeFilters.subredditsBoth.deepscanInclude.trim()) {
        const includeSubs = activeFilters.subredditsBoth.deepscanInclude.split(',').map(s => s.trim().toLowerCase()).filter(s => s)
        filtered = filtered.filter(p =>
          p.mode === 'both' &&
          includeSubs.some(sub => p.config?.deepscanSubreddits?.some((ps: string) => ps.toLowerCase().includes(sub)))
        )
      }
      if (activeFilters.subredditsBoth.deepscanExclude.trim()) {
        const excludeSubs = activeFilters.subredditsBoth.deepscanExclude.split(',').map(s => s.trim().toLowerCase()).filter(s => s)
        filtered = filtered.filter(p =>
          p.mode !== 'both' ||
          !excludeSubs.some(sub => p.config?.deepscanSubreddits?.some((ps: string) => ps.toLowerCase().includes(sub)))
        )
      }
    } else {
      if (activeFilters.subreddits.include.trim()) {
        const includeSubs = activeFilters.subreddits.include.split(',').map(s => s.trim().toLowerCase()).filter(s => s)
        filtered = filtered.filter(p =>
          includeSubs.some(sub => p.subreddits.some(ps => ps.toLowerCase().includes(sub)))
        )
      }
      if (activeFilters.subreddits.exclude.trim()) {
        const excludeSubs = activeFilters.subreddits.exclude.split(',').map(s => s.trim().toLowerCase()).filter(s => s)
        filtered = filtered.filter(p =>
          !excludeSubs.some(sub => p.subreddits.some(ps => ps.toLowerCase().includes(sub)))
        )
      }
    }
    setFilteredPresets(filtered)
  }

  const getActiveFilterCount = () => {
    let count = 0
    if (activeFilters.searchTitle.trim() || activeFilters.searchDescription.trim()) count++
    if (Object.values(activeFilters.modes).some(Boolean)) count++
    if (activeFilters.keywords.include.trim() || activeFilters.keywords.exclude.trim()) count++
    if (activeFilters.modes.both) {
      if (
        activeFilters.subredditsBoth.keywordInclude.trim() ||
        activeFilters.subredditsBoth.keywordExclude.trim() ||
        activeFilters.subredditsBoth.deepscanInclude.trim() ||
        activeFilters.subredditsBoth.deepscanExclude.trim()
      ) count++
    } else {
      if (activeFilters.subreddits.include.trim() || activeFilters.subreddits.exclude.trim()) count++
    }
    return count
  }

  const handleApplyFilters = (filters: FilterState) => {
    setActiveFilters(filters)
  }

  const handleClearFilters = () => {
    setActiveFilters({
      searchTitle: '',
      searchDescription: '',
      searchAuthor: '',
      modes: { keyword: false, deepscan: false, both: false },
      keywords: { include: '', exclude: '' },
      subreddits: { include: '', exclude: '' },
      subredditsBoth: {
        keywordInclude: '',
        keywordExclude: '',
        deepscanInclude: '',
        deepscanExclude: ''
      }
    })
  }

  const loadUserReports = async () => {
    try {
      const user = await AuthService.getCurrentUser()
      if (!user) return
      const { data, error } = await centralSupabase
        .from('reported_presets')
        .select('preset_id')
        .eq('reported_by', user.id)
      if (error) {
        console.error('Failed to load user reports:', error)
        return
      }
      const reportedIds = new Set(data.map(r => r.preset_id))
      setReportedPresets(reportedIds)
    } catch (error) {
      console.error('Error loading user reports:', error)
    }
  }
  
  const handleDownloadPreset = async (preset: CommunityPreset) => {
    try {
      const user = await AuthService.getCurrentUser()
      if (!user) {
        toast.error('Please log in to download presets')
        return
      }
      const { error: insertError } = await centralSupabase
        .from('user_presets')
        .insert([{
          user_id: user.id,
          name: preset.name,
          description: preset.description,
          keywords: preset.keywords,
          subreddits: preset.subreddits,
          mode: preset.mode,
          config: preset.config,
          is_public: false,
          download_count: 0,
          source_community_preset_id: preset.id
        }])
      if (insertError) throw insertError
      const { error: updateError } = await centralSupabase
        .from('community_presets')
        .update({ uses_count: preset.uses_count + 1 })
        .eq('id', preset.id)
      if (updateError) console.error('Failed to update download count:', updateError)
      toast.success(`Downloaded "${preset.name}" to your presets!`)
      setDownloadedPresets(prev => new Set([...prev, preset.id]))
      loadUserPresets()
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Failed to download preset')
    }
  }

  const handleDeleteDownloaded = async (preset: CommunityPreset) => {
    try {
      const user = await AuthService.getCurrentUser()
      if (!user) {
        toast.error('Please log in')
        return
      }
      const { data: userPreset } = await centralSupabase
        .from('user_presets')
        .select('id')
        .eq('user_id', user.id)
        .eq('source_community_preset_id', preset.id)
        .single()
      if (!userPreset) {
        toast.error('Preset not found in your collection')
        return
      }
      const { error: deleteError } = await centralSupabase
        .from('user_presets')
        .delete()
        .eq('id', userPreset.id)
      if (deleteError) throw deleteError
      const { error: updateError } = await centralSupabase
        .from('community_presets')
        .update({ uses_count: Math.max(0, preset.uses_count - 1) })
        .eq('id', preset.id)
      if (updateError) console.error('Failed to update download count:', updateError)
      toast.success('Preset deleted from your collection')
      setDownloadedPresets(prev => {
        const newSet = new Set(prev)
        newSet.delete(preset.id)
        return newSet
      })
      loadUserPresets()
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete preset')
    }
  }
  
  const handleReport = async (presetId: string) => {
    try {
      const user = await AuthService.getCurrentUser()
      if (!user) {
        toast.error('Please log in to report presets')
        return
      }
      const { error } = await centralSupabase
        .from('reported_presets')
        .insert([{
          preset_id: presetId,
          reported_by: user.id,
          reason: reportReason.trim() || 'No reason provided'
        }])
      if (error) {
        if (error.code === '23505') {
          toast.error('You have already reported this preset')
        } else {
          throw error
        }
        return
      }
      setReportedPresets(prev => new Set([...prev, presetId]))
      toast.success('Preset reported successfully')
      setShowReportDialog(null)
      setReportReason('')
    } catch (error) {
      console.error('Report error:', error)
      toast.error('Failed to report preset')
    }
  }

  const handleRevokeReport = async (presetId: string) => {
    try {
      const user = await AuthService.getCurrentUser()
      if (!user) return
      const { error } = await centralSupabase
        .from('reported_presets')
        .delete()
        .eq('preset_id', presetId)
        .eq('reported_by', user.id)
      if (error) throw error
      setReportedPresets(prev => {
        const newSet = new Set(prev)
        newSet.delete(presetId)
        return newSet
      })
      toast.success('Report revoked')
    } catch (error) {
      console.error('Revoke report error:', error)
      toast.error('Failed to revoke report')
    }
  }

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'keyword': return 'Keyword'
      case 'deepscan': return 'DeepScan'
      case 'both': return 'Keyword & DeepScan'
      default: return mode
    }
  }

  const filterCount = getActiveFilterCount()
  const hasActiveFilters = filterCount > 0

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-secondary/50 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-secondary/50 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-secondary/50 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">{username}'s Presets</h1>
        <p className="text-muted-foreground mt-1">Public presets shared by {username}</p>
      </div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('popular')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'popular' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
            }`}
          >
            Most Popular
          </button>
          <button
            onClick={() => setFilter('recent')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'recent' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
            }`}
          >
            Recent
          </button>
          {hasActiveFilters ? (
            <button
              onClick={handleClearFilters}
              className="bg-secondary hover:bg-secondary/80 text-foreground px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <FilterX size={18} />
              Filters ({filterCount})
            </button>
          ) : (
            <button
              onClick={() => setShowFilterDialog(true)}
              className="bg-secondary hover:bg-secondary/80 text-foreground px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Filter size={18} />
              Filter
            </button>
          )}
        </div>
      </div>
      {filteredPresets.length === 0 ? (
        <div className="text-center py-12">
          <div className="mb-4">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
              <Download size={32} className="text-primary" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-2">{presets.length === 0 ? 'No public presets' : 'No presets match your filters'}</h3>
          <p className="text-muted-foreground mb-6">
            {presets.length === 0 
              ? `${username} hasn't shared any presets with the community yet` 
              : 'Try adjusting your filters to see more presets'}
          </p>
          {presets.length > 0 && (
            <button
              onClick={handleClearFilters}
              className="bg-secondary hover:bg-secondary/80 px-6 py-3 rounded-lg inline-flex items-center gap-2"
            >
              <FilterX size={20} />
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPresets.map((preset) => (
            <div key={preset.id} className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-all duration-300 relative flex flex-col">
              <div className="absolute top-4 right-4 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(29, 59, 42, 0.3)', color: '#c6f6d5' }}>
                <Download size={12} />
                <span>{preset.uses_count}</span>
              </div>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Layers3 className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-lg">{preset.name}</h3>
                </div>
                {preset.description && (
                  <p className="text-sm text-muted-foreground">{preset.description}</p>
                )}
              </div>
              <div className="space-y-3 mb-5">
                {preset.keywords.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Target className="h-4 w-4" />
                      <span>Keywords</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {preset.keywords.slice(0, 3).map((kw, i) => (
                        <span key={i} className="px-2.5 py-1 bg-background text-xs rounded font-medium border border-border">
                          {kw}
                        </span>
                      ))}
                      {preset.keywords.length > 3 && (
                        <button
                          onClick={() => setShowKeywordsPopup(preset.keywords)}
                          className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-xs rounded font-medium cursor-pointer"
                        >
                          +{preset.keywords.length - 3} more
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {preset.subreddits.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Users className="h-4 w-4" />
                      <span>Subreddits {preset.mode === 'both' ? '(Keyword)' : ''}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {preset.subreddits.slice(0, 3).map((sub, i) => (
                        <span key={i} className="px-2.5 py-1 bg-background text-xs rounded font-medium border border-border">
                          r/{sub}
                        </span>
                      ))}
                      {preset.subreddits.length > 3 && (
                        <button
                          onClick={() => setShowSubredditsPopup(preset.subreddits)}
                          className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-xs rounded font-medium cursor-pointer"
                        >
                          +{preset.subreddits.length - 3} more
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {preset.mode === 'both' && preset.config?.deepscanSubreddits && (
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Users className="h-4 w-4" />
                      <span>Subreddits (DeepScan)</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {preset.config.deepscanSubreddits.slice(0, 3).map((sub: string, i: number) => (
                        <span key={i} className="px-2.5 py-1 bg-background text-xs rounded font-medium border border-border">
                          r/{sub}
                        </span>
                      ))}
                      {preset.config.deepscanSubreddits.length > 3 && (
                        <button
                          onClick={() => setShowSubredditsPopup(preset.config.deepscanSubreddits)}
                          className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-xs rounded font-medium cursor-pointer"
                        >
                          +{preset.config.deepscanSubreddits.length - 3} more
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Mode:</span>
                  <span className="font-semibold">{getModeLabel(preset.mode)}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-auto">
                {downloadedPresets.has(preset.id) ? (
                  <button
                    onClick={() => handleDeleteDownloaded(preset)}
                    className="flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30"
                  >
                    <Trash2 size={16} />
                    Delete Preset
                  </button>
                ) : (
                  <button
                    onClick={() => handleDownloadPreset(preset)}
                    className="flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                    style={{ backgroundColor: '#1d3b2a', border: '1px solid #23533a', color: '#c6f6d5' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#204330'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1d3b2a'}
                  >
                    <Download size={16} />
                    Download Preset
                  </button>
                )}
                {reportedPresets.has(preset.id) ? (
                  <button
                    onClick={() => handleRevokeReport(preset.id)}
                    className="bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/30 px-3 py-2 rounded-lg flex items-center justify-center transition-colors"
                    title="Revoke Report"
                  >
                    <Flag size={16} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    onClick={() => setShowReportDialog(preset.id)}
                    className="bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 px-3 py-2 rounded-lg flex items-center justify-center transition-colors"
                    title="Report Preset"
                  >
                    <Flag size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {showKeywordsPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4" onClick={() => setShowKeywordsPopup(null)}>
          <div className="bg-card border border-border rounded-lg max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">All Keywords</h3>
              <button
                onClick={() => setShowKeywordsPopup(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {showKeywordsPopup.map((kw, i) => (
                <span key={i} className="px-3 py-1.5 bg-background text-sm rounded font-medium border border-border">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      {showSubredditsPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSubredditsPopup(null)}>
          <div className="bg-card border border-border rounded-lg max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">All Subreddits</h3>
              <button
                onClick={() => setShowSubredditsPopup(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {showSubredditsPopup.map((sub, i) => (
                <span key={i} className="px-3 py-1.5 bg-background text-sm rounded font-medium border border-border">
                  {sub}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      {showReportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Report Preset</h3>
              <button
                onClick={() => {
                  setShowReportDialog(null)
                  setReportReason('')
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={24} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Please provide a reason for reporting this preset (optional)
            </p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              placeholder="e.g., Inappropriate content, spam, misleading information..."
              rows={4}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReportDialog(null)
                  setReportReason('')
                }}
                className="flex-1 bg-secondary hover:bg-secondary/80 px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReport(showReportDialog)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
      {showFilterDialog && (
        <FilterDialog
          onClose={() => setShowFilterDialog(false)}
          onApply={handleApplyFilters}
          initialFilters={activeFilters}
          showAuthorSearch={false}
        />
      )}
    </div>
  )
}