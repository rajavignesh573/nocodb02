import { ref, computed, watch } from 'vue'
import { useProductMatchingApi, type Product, type ExternalProduct, type ProductMatch } from './useProductMatchingApi'

// Utility function to safely format price
const formatPrice = (price: unknown): string => {
  if (price === null || price === undefined) return '0.00'
  const numPrice = typeof price === 'string' ? Number.parseFloat(price) : Number(price)
  return Number.isNaN(numPrice) ? '0.00' : numPrice.toFixed(2)
}

export { formatPrice }

export function useProductMatching() {
  const api = useProductMatchingApi()
  
  // State - ensure these are always arrays
  const products = ref<Product[]>([])
  const selectedProduct = ref<Product | null>(null)
  const candidates = ref<ExternalProduct[]>([])
  const matches = ref<ProductMatch[]>([])
  const searchLoading = ref(false)
  const candidatesLoading = ref(false) // Loading state for candidates/matches in right panel
  const searchQuery = ref('') // Separate search input field
  const filterOptions = ref({
    brands: [] as string[],
    categories: [] as string[],
    sources: [] as Array<{code: string, name: string}>
  })
  const filters = ref({
    search: '', // This will be updated by debounced search
    brand: '',
    category: '',
    source: '',
    status: '',
    score: '', // Score range filter
    orderBy: 'score' as 'score' | 'price' | 'name'
  })

  // Computed
  const filteredProducts = computed(() => {
    // Ensure products.value is always an array
    const productsArray = Array.isArray(products.value) ? products.value : []
    let filtered = [...productsArray] // Create a copy to avoid mutations

    if (filters.value.search) {
      filtered = filtered.filter(product => 
        product.title.toLowerCase().includes(filters.value.search.toLowerCase()) ||
        product.brand?.toLowerCase().includes(filters.value.search.toLowerCase())
      )
    }

    if (filters.value.brand) {
      filtered = filtered.filter(product => product.brand === filters.value.brand)
    }

    if (filters.value.category) {
      filtered = filtered.filter(product => product.category_id === filters.value.category)
    }

    if (filters.value.status) {
      filtered = filtered.filter(product => {
        const matchesArray = Array.isArray(matches.value) ? matches.value : []
        const productMatches = matchesArray.filter(match => match.local_product_id === product.id)
        return productMatches.some(match => match.status === filters.value.status)
      })
    }

    // Note: Score filter is applied to external products in the right panel,
    // not to internal products in the left panel. This is handled in the
    // productSelectionOptions computed property.

    // Sort
    if (filters.value.orderBy === 'price') {
      filtered = filtered.sort((a, b) => (a.price || 0) - (b.price || 0))
    } else if (filters.value.orderBy === 'name') {
      filtered = filtered.sort((a, b) => a.title.localeCompare(b.title))
    } else {
      // Sort by highest match score
      filtered = filtered.sort((a, b) => {
        const matchesArray = Array.isArray(matches.value) ? matches.value : []
        const aMatches = matchesArray.filter(match => match.local_product_id === a.id)
        const bMatches = matchesArray.filter(match => match.local_product_id === b.id)
        const aMaxScore = Math.max(...aMatches.map(m => m.score), 0)
        const bMaxScore = Math.max(...bMatches.map(m => m.score), 0)
        return bMaxScore - aMaxScore
      })
    }

    return filtered
  })

  // Cache for preserving original product data during match operations
  const originalProductDataCache = ref(new Map())

  const productSelectionOptions = computed(() => {
    if (!selectedProduct.value) return []

    const options: Array<{
      id: string
      source: string
      leftProduct: Product
      rightProduct: any // Can be ExternalProduct or ProductMatch
      score: number
      priceDelta: number
      selected: boolean
      isExistingMatch: boolean
    }> = []

    // 1. First, add EXISTING CONFIRMED MATCHES from database
    const matchesArray = Array.isArray(matches.value) ? matches.value : []
    const existingConfirmedMatches = matchesArray.filter(match => 
      match.local_product_id === selectedProduct.value?.id && 
      match.status === 'matched'
    )

    for (const existingMatch of existingConfirmedMatches) {
      // Try to get original product data from cache first
      const cachedProduct = originalProductDataCache.value.get(existingMatch.external_product_key)
      
      let rightProduct
      if (cachedProduct) {
        // Use cached original data but mark as selected
        rightProduct = {
          ...cachedProduct,
          external_product_key: existingMatch.external_product_key,
        }
      } else {
        // Fallback to mock data if no cache available
        rightProduct = {
          external_product_key: existingMatch.external_product_key,
          title: `Matched Product (${existingMatch.external_product_key})`,
          brand: 'Matched',
          price: 0,
          image: '',
          image_url: '',
          source: { code: existingMatch.source_id || 'unknown' },
          score: existingMatch.score || 0
        }
      }

      options.push({
        id: `${selectedProduct.value.id}-${existingMatch.external_product_key}`,
        source: existingMatch.source_id || 'unknown',
        leftProduct: selectedProduct.value,
        rightProduct: rightProduct,
        score: existingMatch.score || 0,
        priceDelta: existingMatch.price_delta_pct || 0,
        selected: true, // Existing matches are always selected
        isExistingMatch: true
      })
    }

    // 2. Then, add NEW CANDIDATE MATCHES from AI service
    const candidatesArray = Array.isArray(candidates.value) ? candidates.value : []
    
    // Group candidates by source
    const sourceGroups = new Map<string, any[]>()
    for (const candidate of candidatesArray) {
      const sourceCode = candidate.source.code
      if (!sourceGroups.has(sourceCode)) {
        sourceGroups.set(sourceCode, [])
      }
      const group = sourceGroups.get(sourceCode)
      if (group) {
        group.push(candidate)
      }
    }

    for (const [sourceCode, sourceCandidates] of sourceGroups) {
      for (const candidate of sourceCandidates) {
        // Check if this candidate is already a confirmed match
        const isAlreadyMatched = existingConfirmedMatches.some(match => 
          match.external_product_key === candidate.external_product_key
        )

        // Cache the original product data for future use
        if (candidate.external_product_key && !originalProductDataCache.value.has(candidate.external_product_key)) {
          originalProductDataCache.value.set(candidate.external_product_key, {
            ...candidate,
            // Preserve original image data
            image: candidate.image,
            image_url: candidate.image_url,
            title: candidate.title,
            brand: candidate.brand,
            price: candidate.price,
            description: candidate.description,
            availability: candidate.availability
          })
        }

        // Only add if not already matched
        if (!isAlreadyMatched) {
          options.push({
            id: `${selectedProduct.value.id}-${candidate.external_product_key}`,
            source: sourceCode,
            leftProduct: selectedProduct.value,
            rightProduct: candidate,
            score: candidate.score,
            priceDelta: candidate.score,
            selected: false, // New candidates are not selected
            isExistingMatch: false
          })
        }
      }
    }

    // Apply score filter to external products (right panel)
    if (filters.value.score) {
      return options.filter(option => {
        const scorePercentage = option.score * 100
        
        switch (filters.value.score) {
          case '30-50':
            return scorePercentage >= 30 && scorePercentage < 50
          case '50-70':
            return scorePercentage >= 50 && scorePercentage < 70
          case '70-100':
            return scorePercentage >= 70
          default:
            return true
        }
      })
    }

    return options
  })

  // Methods
  const loadFilterOptions = async () => {
    try {
      const result = await api.getFilterOptions()
      // Ensure sources is always an array of objects with code and name
      filterOptions.value = {
        brands: Array.isArray(result.brands) ? result.brands : [],
        categories: Array.isArray(result.categories) ? result.categories : [],
        sources: Array.isArray(result.sources) ? result.sources : []
      }
      console.log('✅ Loaded filter options:', filterOptions.value)
    } catch (error) {
      console.error('❌ Failed to load filter options:', error)
      // Provide fallback with empty arrays
      filterOptions.value = { brands: [], categories: [], sources: [] }
    }
  }

  const loadProducts = async () => {
    try {
      const result = await api.getProducts({
        q: filters.value.search || undefined,
        // Remove client-side filterable parameters from server call
        // brand: filters.value.brand || undefined,
        // categoryId: filters.value.category || undefined,
        // status: filters.value.status || undefined,
        sortBy: filters.value.orderBy === 'name' ? 'title' : 'updated_at',
        sortDir: 'desc',
        limit: 250
      })
      // Ensure we always set an array
      products.value = Array.isArray(result?.items) ? result.items : []
    } catch (error) {
      console.error('Failed to load products:', error)
      // Ensure we always set an array
      products.value = []
    }
  }

  const loadCandidates = async (productId: string) => {
    candidatesLoading.value = true
    try {
      const result = await api.getCandidates(productId, {
        sources: filters.value.source ? [filters.value.source] : undefined,
        brand: filters.value.brand || undefined,
        limit: 25
      })
      // Ensure we always set an array
      candidates.value = Array.isArray(result?.items) ? result.items : []
    } catch (error) {
      console.error('Failed to load candidates:', error)
      // Ensure we always set an array
      candidates.value = []
    } finally {
      candidatesLoading.value = false
    }
  }

  const loadMatches = async () => {
    try {
      // Load ALL matches to properly determine dot colors
      const result = await api.getMatches({
        // Remove status filter to get all matches
        limit: 100
      })
      // Ensure we always set an array
      matches.value = Array.isArray(result?.items) ? result.items : []
    } catch (error) {
      console.error('Failed to load matches:', error)
      // Ensure we always set an array
      matches.value = []
    }
  }

  const selectProduct = async (product: Product) => {
    selectedProduct.value = product
    // Immediately clear old candidates to avoid showing stale data
    candidates.value = []
    // Load fresh candidates
    loadCandidates(product.id).catch(console.error)
  }

  const confirmMatch = async (optionId: string) => {
    const option = productSelectionOptions.value.find(opt => opt.id === optionId)
    if (!option) return

    try {
      const matchData = {
        local_product_id: option.leftProduct.id,
        external_product_key: option.rightProduct.external_product_key,
        source_code: option.source,
        score: option.score,
        price_delta_pct: option.priceDelta,
        rule_id: 'default-rule', // This should come from the backend
        status: 'matched' as const,
        session_id: 'sess-001', // Fixed: use existing session ID
        notes: 'Confirmed via UI'
      }

      await api.confirmMatch(matchData)
      
      // Refresh matches
      await loadMatches()
      
      // Update the option selection
      const optionIndex = productSelectionOptions.value.findIndex(opt => opt.id === optionId)
      if (optionIndex !== -1) {
        // This would update the local state to reflect the confirmed match
      }
    } catch (error) {
      console.error('Failed to confirm match:', error)
    }
  }

  const rejectMatch = async (optionId: string) => {
    const option = productSelectionOptions.value.find(opt => opt.id === optionId)
    if (!option) return

    try {
      const matchData = {
        local_product_id: option.leftProduct.id,
        external_product_key: option.rightProduct.external_product_key,
        source_code: option.source,
        score: option.score,
        price_delta_pct: option.priceDelta,
        rule_id: 'default-rule',
        status: 'not_matched' as const,
        session_id: 'sess-001', // Fixed: use existing session ID
        notes: 'Rejected via UI'
      }

      await api.confirmMatch(matchData)
      await loadMatches()
    } catch (error) {
      console.error('Failed to reject match:', error)
    }
  }

  // Manual search trigger function
  const triggerSearch = async () => {
    const query = searchQuery.value?.trim() || ''
    
    // Show loading state
    searchLoading.value = true
    
    try {
      // Update the search filter
      filters.value.search = query
      
      // The filters watcher will trigger loadProducts automatically
      // Wait a bit for the search to complete
      await new Promise(resolve => setTimeout(resolve, 100))
    } finally {
      searchLoading.value = false
    }
  }

  // Clear search function
  const clearSearch = () => {
    searchQuery.value = ''
    filters.value.search = ''
  }
  
  // Watch filters (non-debounced) - this will trigger when search is actually updated
  watch(filters, (newFilters, oldFilters) => {
    // Only reload products if search term changed (server-side filtering needed)
    if (newFilters.search !== oldFilters?.search) {
      loadProducts()
    }
    // For other filters (brand, category, source, score), we use client-side filtering
    // which is handled by the filteredProducts computed property
    
    // If source filter changed and we have a selected product, reload candidates in background
    if (newFilters.source !== oldFilters?.source && selectedProduct.value) {
      // Load candidates in background without blocking UI
      loadCandidates(selectedProduct.value.id).catch(console.error)
    }
  }, { deep: true })

  // Clear the image cache (useful for resetting state)
  const clearImageCache = () => {
    originalProductDataCache.value.clear()
  }

  // Scroll position management
  const scrollPosition = ref(0)
  
  const saveScrollPosition = (): void => {
    try {
      scrollPosition.value = window.scrollY || document.documentElement.scrollTop
      console.log('🔍 DEBUG: Scroll position saved:', scrollPosition.value)
    } catch (error) {
      console.warn('Failed to save scroll position:', error)
    }
  }

  const restoreScrollPosition = (): void => {
    try {
      if (scrollPosition.value > 0) {
        window.scrollTo(0, scrollPosition.value)
        console.log('🔍 DEBUG: Scroll position restored to:', scrollPosition.value)
      }
    } catch (error) {
      console.warn('Failed to restore scroll position:', error)
    }
  }

  // Initialize
  const initialize = async () => {
    await Promise.all([
      loadFilterOptions(),
      loadProducts(),
      loadMatches()
    ])
  }

  return {
    // State
    products: computed(() => products.value),
    selectedProduct: computed(() => selectedProduct.value),
    candidates: computed(() => candidates.value),
    matches: computed(() => matches.value),
    searchLoading: computed(() => searchLoading.value),
    candidatesLoading: computed(() => candidatesLoading.value),
    filterOptions: computed(() => filterOptions.value),
    // Expose the actual ref for direct manipulation
    _matchesRef: matches,
    filters,
    searchQuery, // Expose the separate search input field
    
    // Computed
    filteredProducts,
    productSelectionOptions,
    
    // Methods
    loadFilterOptions,
    loadProducts,
    loadCandidates,
    loadMatches,
    selectProduct,
    confirmMatch,
    rejectMatch,
    initialize,
    clearImageCache,
    triggerSearch,
    clearSearch,
    saveScrollPosition,
    restoreScrollPosition,
    
    // Utility methods
    refreshFilterOptions: loadFilterOptions, // Alias for refreshing filter options
    
    // API state
    loading: api.loading,
    error: api.error
  }
}
