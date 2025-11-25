import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Copy, Play, Target, Users, Settings, Layers3, X, Star, ChevronDown, ArrowUpDown, Filter, FilterX, Download } from 'lucide-react'
import { toast } from 'sonner'
import { centralSupabase } from '@/lib/centralSupabase'
import { AuthService } from '@/services/auth'
import FilterDialog, { FilterState } from '@/components/FilterDialog'

interface Preset {
  id: string
  user_id: string
  name: string
  description: string
  keywords: string[]
  subreddits: string[]
  mode: string
  config: any
  created_at: string
  updated_at?: string
  last_used_at?: string
  is_public?: boolean
  is_favorited?: boolean
  download_count?: number
  source_community_preset_id?: string
}

export default function PresetsPage() {
  const [presets, setPresets] = useState<Preset[]>([])
  const [filteredPresets, setFilteredPresets] = useState<Preset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null)
  const [showSubredditsPopup, setShowSubredditsPopup] = useState<string[] | null>(null)
  const [showKeywordsPopup, setShowKeywordsPopup] = useState<string[] | null>(null)
  const [sortBy, setSortBy] = useState<'modified' | 'used' | 'alphabetical'>('modified')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [showFilterDialog, setShowFilterDialog] = useState(false)
  const [activeFilters, setActiveFilters] = useState<FilterState>({
    searchTitle: '',
    searchDescription: '',
    searchAuthor: '',
    modes: { keyword: false, deepscan: false, both: false },
    presetSource: { created: false, downloaded: false },
    keywords: { include: '', exclude: '' },
    subreddits: { include: '', exclude: '' },
    subredditsBoth: {
      keywordInclude: '',
      keywordExclude: '',
      deepscanInclude: '',
      deepscanExclude: ''
    }
  })
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    keywords: '',
    subreddits: '',
    deepscanSubreddits: '',
    mode: 'keyword'
  })

  useEffect(() => {
    loadPresets()
  }, [sortBy, sortOrder])

  useEffect(() => {
    applyFilters()
  }, [presets, activeFilters])

  useEffect(() => {
    const handleOpenDialog = () => {
      setTimeout(() => setShowDialog(true), 500)
    }
    window.addEventListener('openCreateDialog', handleOpenDialog)
    const params = new URLSearchParams(window.location.search)
    if (params.get('create') === 'true') {
      setTimeout(() => setShowDialog(true), 500)
      window.history.replaceState({}, '', '/presets')
    }
    return () => {
      window.removeEventListener('openCreateDialog', handleOpenDialog)
    }
  }, [])
  const loadPresets = async () => {
    try {
      const user = await AuthService.getCurrentUser()
      if (!user) {
        toast.error('Please log in to view presets')
        return
      }
      let query = centralSupabase
        .from('user_presets')
        .select('*')
        .eq('user_id', user.id)
      if (sortBy === 'modified') {
        query = query.order('updated_at', { ascending: sortOrder === 'asc', nullsFirst: false })
      } else if (sortBy === 'used') {
        query = query.order('last_used_at', { ascending: sortOrder === 'asc', nullsFirst: false })
      } else if (sortBy === 'alphabetical') {
        query = query.order('name', { ascending: sortOrder === 'asc' })
      }
      const { data, error } = await query
      if (error) {
        console.error('Preset load error:', error)
        toast.error('Failed to load presets')
        return
      }
      const sortedData = (data || []).sort((a, b) => {
        if (a.is_favorited && !b.is_favorited) return -1
        if (!a.is_favorited && b.is_favorited) return 1
        return 0
      })
      setPresets(sortedData)
    } catch (error) {
      console.error('Error loading presets:', error)
      toast.error('Failed to load presets')
    } finally {
      setIsLoading(false)
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
    const sourceSelected = activeFilters.presetSource?.created || activeFilters.presetSource?.downloaded
    if (sourceSelected) {
      filtered = filtered.filter(p => {
        const isDownloaded = !!p.source_community_preset_id
        if (activeFilters.presetSource?.created && !isDownloaded) return true
        if (activeFilters.presetSource?.downloaded && isDownloaded) return true
        return false
      })
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
    if (activeFilters.presetSource && Object.values(activeFilters.presetSource).some(Boolean)) count++
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
      presetSource: { created: false, downloaded: false },
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
  const getSortLabel = () => {
    switch (sortBy) {
      case 'modified': return 'Last Modified'
      case 'used': return 'Recently Used'
      case 'alphabetical': return 'Alphabetically'
      default: return 'Sort By'
    }
  }
  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
  }
  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a preset name')
      return
    }
    if (formData.mode === 'keyword' && !formData.keywords.trim()) {
      toast.error('Please enter keywords for keyword mode')
      return
    }
    if (formData.mode === 'deepscan' && !formData.subreddits.trim()) {
      toast.error('Please enter subreddits for deepscan mode')
      return
    }
    if (formData.mode === 'both' && (!formData.keywords.trim() || !formData.subreddits.trim() || !formData.deepscanSubreddits.trim())) {
      toast.error('Please enter keywords, keyword subreddits, and deepscan subreddits for both mode')
      return
    }
    try {
      const user = await AuthService.getCurrentUser()
      if (!user) return
      const { error } = await centralSupabase
        .from('user_presets')
        .insert([{
          user_id: user.id,
          name: formData.name.trim(),
          description: formData.description.trim(),
          keywords: formData.mode === 'deepscan' ? [] : formData.keywords.split(',').map(k => k.trim()).filter(k => k),
          subreddits: formData.mode === 'both' ? [] : formData.subreddits.split(',').map(s => s.trim()).filter(s => s),
          mode: formData.mode,
          config: formData.mode === 'both' ? {
            keywordSubreddits: formData.subreddits.split(',').map(s => s.trim()).filter(s => s),
            deepscanSubreddits: formData.deepscanSubreddits.split(',').map(s => s.trim()).filter(s => s)
          } : {},
          is_public: false,
          is_favorited: false,
          download_count: 0,
          last_used_at: null
        }])
      if (error) throw error
      toast.success('Preset created successfully')
      setShowDialog(false)
      resetForm()
      loadPresets()
    } catch (error) {
      console.error('Create error:', error)
      toast.error('Failed to create preset')
    }
  }
  const handleUpdate = async () => {
    if (!editingPreset) return
    try {
      const { error } = await centralSupabase
        .from('user_presets')
        .update({
          name: formData.name.trim(),
          description: formData.description.trim(),
          keywords: formData.mode === 'deepscan' ? [] : formData.keywords.split(',').map(k => k.trim()).filter(k => k),
          subreddits: formData.mode === 'both' ? [] : formData.subreddits.split(',').map(s => s.trim()).filter(s => s),
          mode: formData.mode,
          config: formData.mode === 'both' ? {
            keywordSubreddits: formData.subreddits.split(',').map(s => s.trim()).filter(s => s),
            deepscanSubreddits: formData.deepscanSubreddits.split(',').map(s => s.trim()).filter(s => s)
          } : {},
          updated_at: new Date().toISOString()
        })
        .eq('id', editingPreset.id)
      if (error) throw error
      toast.success('Preset updated successfully')
      setShowDialog(false)
      setEditingPreset(null)
      resetForm()
      loadPresets()
    } catch (error) {
      console.error('Update error:', error)
      toast.error('Failed to update preset')
    }
  }
  const handleDelete = async (id: string, sourceCommunityPresetId?: string) => {
    if (!confirm('Are you sure you want to delete this preset?')) return
    try {
      const { error } = await centralSupabase
        .from('user_presets')
        .delete()
        .eq('id', id)
      if (error) throw error
      if (sourceCommunityPresetId) {
        const { data: communityPreset } = await centralSupabase
          .from('community_presets')
          .select('uses_count')
          .eq('id', sourceCommunityPresetId)
          .single()
        if (communityPreset) {
          await centralSupabase
            .from('community_presets')
            .update({ uses_count: Math.max(0, communityPreset.uses_count - 1) })
            .eq('id', sourceCommunityPresetId)
        }
      }
      toast.success('Preset deleted')
      loadPresets()
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete preset')
    }
  }
  const handleToggleFavorite = async (preset: Preset) => {
    try {
      const { error } = await centralSupabase
        .from('user_presets')
        .update({ is_favorited: !preset.is_favorited })
        .eq('id', preset.id)
      if (error) throw error
      toast.success(preset.is_favorited ? 'Removed from favorites' : 'Added to favorites')
      loadPresets()
    } catch (error) {
      console.error('Toggle favorite error:', error)
      toast.error('Failed to update favorite status')
    }
  }
  const handleClone = async (preset: Preset) => {
    try {
      const user = await AuthService.getCurrentUser()
      if (!user) return
      const { data: existingClones } = await centralSupabase
        .from('user_presets')
        .select('name')
        .eq('user_id', user.id)
        .like('name', `${preset.name} Clone%`)
      let cloneNumber = 1
      if (existingClones && existingClones.length > 0) {
        const cloneNumbers = existingClones
          .map(p => {
            const match = p.name.match(/Clone (\d+)$/)
            return match ? parseInt(match[1]) : 0
          })
          .filter(n => n > 0)
        if (cloneNumbers.length > 0) {
          cloneNumber = Math.max(...cloneNumbers) + 1
        }
      }
      const cloneName = `${preset.name} Clone ${cloneNumber}`
      const { error } = await centralSupabase
        .from('user_presets')
        .insert([{
          user_id: user.id,
          name: cloneName,
          description: preset.description,
          keywords: preset.keywords,
          subreddits: preset.subreddits,
          mode: preset.mode,
          config: preset.config,
          is_public: false,
          is_favorited: false,
          download_count: 0,
          source_preset_id: preset.id,
          last_used_at: null
        }])
      if (error) throw error
      toast.success(`Cloned as "${cloneName}"`)
      loadPresets()
    } catch (error) {
      console.error('Clone error:', error)
      toast.error('Failed to clone preset')
    }
  }
  const handleTogglePublic = async (preset: Preset) => {
    try {
      const newPublicStatus = !preset.is_public
      const { error } = await centralSupabase
        .from('user_presets')
        .update({ is_public: newPublicStatus })
        .eq('id', preset.id)
      if (error) throw error
      if (newPublicStatus) {
        const user = await AuthService.getCurrentUser()
        if (!user) return
        const { error: communityError } = await centralSupabase
          .from('community_presets')
          .insert([{
            user_id: user.id,
            username: user.username,
            name: preset.name,
            description: preset.description,
            keywords: preset.keywords,
            subreddits: preset.mode === 'both' ? (preset.config?.keywordSubreddits || []) : preset.subreddits,
            mode: preset.mode,
            config: preset.config,
            is_public: true,
            uses_count: 0,
            source_preset_id: preset.id
          }])
        if (communityError) throw communityError
        toast.success('Preset is now public!')
      } else {
        const { error: deleteError } = await centralSupabase
          .from('community_presets')
          .delete()
          .eq('source_preset_id', preset.id)
        if (deleteError) throw deleteError
        toast.success('Preset is now private')
      }
      loadPresets()
    } catch (error) {
      console.error('Toggle public error:', error)
      toast.error('Failed to update preset visibility')
    }
  }
  const handleEdit = (preset: Preset) => {
    setEditingPreset(preset)
    setFormData({
      name: preset.name,
      description: preset.description || '',
      keywords: preset.keywords.join(', '),
      subreddits: preset.mode === 'both' 
        ? preset.config?.keywordSubreddits?.join(', ') || ''
        : preset.subreddits.join(', '),
      deepscanSubreddits: preset.config?.deepscanSubreddits?.join(', ') || '',
      mode: preset.mode
    })
    setShowDialog(true)
  }
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      keywords: '',
      subreddits: '',
      deepscanSubreddits: '',
      mode: 'keyword'
    })
    setEditingPreset(null)
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
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">My Presets</h1>
          <p className="text-muted-foreground mt-1">Private presets with your keywords and subreddit combinations</p>
        </div>
        <div className="flex gap-2">
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
                    setSortBy('modified')
                    setShowSortDropdown(false)
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-secondary/50 rounded-t-lg ${sortBy === 'modified' ? 'bg-secondary/30' : ''}`}
                >
                  Last Modified
                </button>
                <button
                  onClick={() => {
                    setSortBy('used')
                    setShowSortDropdown(false)
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-secondary/50 ${sortBy === 'used' ? 'bg-secondary/30' : ''}`}
                >
                  Recently Used
                </button>
                <button
                  onClick={() => {
                    setSortBy('alphabetical')
                    setShowSortDropdown(false)
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-secondary/50 rounded-b-lg ${sortBy === 'alphabetical' ? 'bg-secondary/30' : ''}`}
                >
                  Alphabetically
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
            onClick={() => {
              resetForm()
              setShowDialog(true)
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Plus size={20} />
            Create Preset
          </button>
        </div>
      </div>
      {filteredPresets.length === 0 ? (
        <div className="text-center py-12">
          <div className="mb-4">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
              <Plus size={32} className="text-primary" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-2">{presets.length === 0 ? 'No presets yet' : 'No presets match your filters'}</h3>
          <p className="text-muted-foreground mb-6">
            {presets.length === 0 
              ? 'Create your first private preset with keywords and subreddits' 
              : 'Try adjusting your filters to see more presets'}
          </p>
          {presets.length === 0 ? (
            <button
              onClick={() => setShowDialog(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-lg inline-flex items-center gap-2"
            >
              <Plus size={20} />
              Create Your First Preset
            </button>
          ) : (
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
              <div className="absolute top-4 right-4 flex items-center gap-2">
                {preset.source_community_preset_id ? (
                  <>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                      <Download size={12} />
                      Downloaded
                    </span>
                    <button
                      onClick={() => handleToggleFavorite(preset)}
                      className={`px-3 py-1 rounded-full transition-colors ${
                        preset.is_favorited 
                          ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30' 
                          : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                      }`}
                      title={preset.is_favorited ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star size={14} fill={preset.is_favorited ? 'currentColor' : 'none'} strokeWidth={2} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleTogglePublic(preset)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        preset.is_public 
                          ? 'bg-green-500/20 text-green-500' 
                          : 'bg-gray-500/20 text-gray-500'
                      }`}
                    >
                      {preset.is_public ? 'Public' : 'Private'}
                    </button>
                    <button
                      onClick={() => handleToggleFavorite(preset)}
                      className={`px-3 py-1 rounded-full transition-colors ${
                        preset.is_favorited 
                          ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30' 
                          : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                      }`}
                      title={preset.is_favorited ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star size={14} fill={preset.is_favorited ? 'currentColor' : 'none'} strokeWidth={2} />
                    </button>
                  </>
                )}
              </div>
              <div className="mb-4 mt-2">
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
                {(preset.subreddits.length > 0 || (preset.mode === 'both' && preset.config?.keywordSubreddits)) && (
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Users className="h-4 w-4" />
                      <span>Subreddits {preset.mode === 'both' ? '(Keywords)' : ''}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(preset.mode === 'both' ? (preset.config?.keywordSubreddits || []) : preset.subreddits).slice(0, 3).map((sub, i) => (
                        <span key={i} className="px-2.5 py-1 bg-background text-xs rounded font-medium border border-border">
                          r/{sub}
                        </span>
                      ))}
                      {(preset.mode === 'both' ? (preset.config?.keywordSubreddits || []) : preset.subreddits).length > 3 && (
                        <button
                          onClick={() => setShowSubredditsPopup(preset.mode === 'both' ? (preset.config?.keywordSubreddits) : preset.subreddits)}
                          className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-xs rounded font-medium cursor-pointer"
                        >
                          +{(preset.mode === 'both' ? (preset.config?.keywordSubreddits || []) : preset.subreddits).length - 3} more
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {preset.mode === 'both' && preset.config?.deepscanSubreddits && preset.config.deepscanSubreddits.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Users className="h-4 w-4" />
                      <span>Subreddits (DeepScan)</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {preset.config.deepscanSubreddits.slice(0, 3).map((sub, i) => (
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
                <button
                  onClick={() => handleEdit(preset)}
                  className="flex-1 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                  style={{ backgroundColor: '#1d3b2a', border: '1px solid #23533a', color: '#c6f6d5' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#204330'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1d3b2a'}
                >
                  <Play size={16} />
                  Run Preset
                </button>
                <button
                  onClick={() => preset.source_community_preset_id ? null : handleEdit(preset)}
                  disabled={!!preset.source_community_preset_id}
                  className={`bg-secondary/50 px-3 py-2 rounded-lg flex items-center justify-center transition-colors ${
                    preset.source_community_preset_id 
                      ? 'opacity-40 cursor-not-allowed' 
                      : 'hover:bg-secondary'
                  }`}
                  title={preset.source_community_preset_id ? 'Cannot edit downloaded presets. Clone to customize.' : 'Edit'}
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleClone(preset)}
                  className="bg-secondary/50 hover:bg-secondary px-3 py-2 rounded-lg flex items-center justify-center transition-colors"
                  title="Clone"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={() => handleDelete(preset.id, preset.source_community_preset_id)}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-500 px-3 py-2 rounded-lg flex items-center justify-center transition-colors"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {showKeywordsPopup && (
        <div className="fixed top-0 left-0 w-full h-full bg-black/50 z-50 animate-fade-in" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div className="bg-card border border-border rounded-lg max-w-2xl w-full p-6 animate-scale-in" style={{
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
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
                  r/{sub}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-lg max-w-2xl w-full p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{editingPreset ? 'Edit Preset' : 'Create New Preset'}</h2>
              <button
                onClick={() => {
                  setShowDialog(false)
                  setEditingPreset(null)
                  resetForm()
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={24} />
              </button>
            </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Preset Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., Tech News Collection"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Brief description of what this preset collects"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Mode</label>
                  <select
                    value={formData.mode}
                    onChange={(e) => setFormData({...formData, mode: e.target.value})}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="keyword">Keyword</option>
                    <option value="deepscan">DeepScan</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div className={`transition-all duration-300 overflow-hidden ${
                  formData.mode === 'deepscan' 
                    ? 'max-h-0 opacity-0 transform -translate-y-2' 
                    : 'max-h-32 opacity-100 transform translate-y-0'
                }`}>
                  <div>
                    <label className="block text-sm font-medium mb-2">Keywords</label>
                    <input
                      type="text"
                      value={formData.keywords}
                      onChange={(e) => setFormData({...formData, keywords: e.target.value})}
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="technology, AI, programming (comma separated)"
                      disabled={formData.mode === 'deepscan'}
                    />
                  </div>
                </div>
                <div className="transition-all duration-300 overflow-hidden max-h-32 opacity-100 transform translate-y-0">
                  <label className="block text-sm font-medium mb-2">
                    Subreddits {formData.mode === 'both' ? '(for Keywords)' : ''}
                  </label>
                  <input
                    type="text"
                    value={formData.subreddits}
                    onChange={(e) => setFormData({...formData, subreddits: e.target.value})}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="technology, programming, webdev (comma separated)"
                  />
                </div>
                <div className={`transition-all duration-300 overflow-hidden ${
                  formData.mode === 'both' 
                    ? 'max-h-32 opacity-100 transform translate-y-0' 
                    : 'max-h-0 opacity-0 transform -translate-y-2'
                }`}>
                  <div>
                    <label className="block text-sm font-medium mb-2">Subreddits (for DeepScan)</label>
                    <input
                      type="text"
                      value={formData.deepscanSubreddits || ''}
                      onChange={(e) => setFormData({...formData, deepscanSubreddits: e.target.value})}
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="AskReddit, science, politics (comma separated)"
                      disabled={formData.mode !== 'both'}
                    />
                  </div>
                </div>
              </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDialog(false)
                  setEditingPreset(null)
                  resetForm()
                }}
                className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={editingPreset ? handleUpdate : handleCreate}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium"
              >
                {editingPreset ? 'Update' : 'Create'}
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
          showPresetSourceFilter={true}
        />
      )}
    </div>
  )
}