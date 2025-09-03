import { ref, computed, watch, nextTick } from 'vue'
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
  
  // State
  const products = ref<Product[]>([])
  const selectedProduct = ref<Product | null>(null)
  const candidates = ref<ExternalProduct[]>([])
  const matches = ref<ProductMatch[]>([])
  const filters = ref({
    search: '',
    brand: '',
    category: '',
    source: '',
    status: '',
    orderBy: 'score' as 'score' | 'price' | 'name'
  })
  
  // Scroll position preservation
  const scrollPosition = ref(0)
  const isUserScrolling = ref(false)

  // Computed
  const filteredProducts = computed(() => {
    let filtered = products.value

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

    // Sort
    if (filters.value.orderBy === 'price') {
      filtered = [...filtered].sort((a, b) => (a.price || 0) - (b.price || 0))
    } else if (filters.value.orderBy === 'name') {
      filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title))
    } else {
      // Sort by highest match score
      filtered = [...filtered].sort((a, b) => {
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
      // Create a mock external product from the existing match
      const mockExternalProduct = {
        external_product_key: existingMatch.external_product_key,
        title: `Matched Product (${existingMatch.external_product_key})`,
        brand: 'Matched',
        price: 0,
        image: '',
        source: { code: existingMatch.source_id || 'unknown' },
        score: existingMatch.score || 0
      }

      options.push({
        id: `${selectedProduct.value.id}-${existingMatch.external_product_key}`,
        source: existingMatch.source_id || 'unknown',
        leftProduct: selectedProduct.value,
        rightProduct: mockExternalProduct,
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

    return options
  })

  // Methods
  const loadProducts = async (preserveScroll = false) => {
    try {
      // Store current scroll position if preserving
      if (preserveScroll) {
        scrollPosition.value = window.scrollY || document.documentElement.scrollTop
      }
      
      const result = await api.getProducts({
        q: filters.value.search || undefined,
        brand: filters.value.brand || undefined,
        categoryId: filters.value.category || undefined,
        status: filters.value.status || undefined,
        sortBy: filters.value.orderBy === 'name' ? 'title' : 'updated_at',
        sortDir: 'desc',
        limit: 250
      })
      products.value = result.items
      
      // Restore scroll position after data update
      if (preserveScroll && scrollPosition.value > 0) {
        nextTick(() => {
          window.scrollTo(0, scrollPosition.value)
        })
      }
    } catch (error) {
      console.error('Failed to load products:', error)
      // Show error state instead of fallback data
      products.value = []
    }
  }

  const loadCandidates = async (productId: string) => {
    try {
      const result = await api.getCandidates(productId, {
        sources: filters.value.source ? [filters.value.source] : undefined,
        brand: filters.value.brand || undefined,
        limit: 25
      })
      candidates.value = result.items
    } catch (error) {
      console.error('Failed to load candidates:', error)
      // Show error state instead of fallback data
      candidates.value = []
    }
  }

  const loadMatches = async () => {
    try {
      // Load ALL matches to properly determine dot colors
      const result = await api.getMatches({
        // Remove status filter to get all matches
        limit: 100
      })
      matches.value = result.items
    } catch (error) {
      console.error('Failed to load matches:', error)
      // Show error state instead of fallback data
      matches.value = []
    }
  }

  const selectProduct = async (product: Product) => {
    // Store current scroll position before selection
    scrollPosition.value = window.scrollY || document.documentElement.scrollTop
    
    selectedProduct.value = product
    await loadCandidates(product.id)
    
    // Restore scroll position after selection
    nextTick(() => {
      if (scrollPosition.value > 0) {
        window.scrollTo(0, scrollPosition.value)
      }
    })
  }

  const confirmMatch = async (optionId: string) => {
    const option = productSelectionOptions.value.find(opt => opt.id === optionId)
    if (!option) return

    try {
      const matchData = {
        local_product_id: option.leftProduct.id,
        external_product_key: option.rightProduct.external_product_key,
        source_code: option.rightProduct.source.code,
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
        source_code: option.rightProduct.source.code,
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

  // Watch for filter changes
  watch(filters, () => {
    // Only preserve scroll for non-search filter changes
    const isSearchChange = filters.value.search !== ''
    loadProducts(!isSearchChange) // Preserve scroll for non-search changes
  }, { deep: true })

  // Initialize
  const initialize = async () => {
    await Promise.all([
      loadProducts(),
      loadMatches()
    ])
  }

  // Scroll position methods
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

  return {
    // State
    products: computed(() => products.value),
    selectedProduct: computed(() => selectedProduct.value),
    candidates: computed(() => candidates.value),
    matches: computed(() => matches.value),
    // Expose the actual ref for direct manipulation
    _matchesRef: matches,
    filters,
    
    // Computed
    filteredProducts,
    productSelectionOptions,
    
    // Methods
    loadProducts,
    loadCandidates,
    loadMatches,
    selectProduct,
    confirmMatch,
    rejectMatch,
    initialize,
    
    // Scroll position methods
    saveScrollPosition,
    restoreScrollPosition,
    
    // API state
    loading: api.loading,
    error: api.error
  }
}
