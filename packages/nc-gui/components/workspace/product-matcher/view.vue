<script lang="ts" setup>
import { useTitle } from '@vueuse/core'
import { nextTick, onMounted, onUnmounted } from 'vue'
import { useProductMatching, formatPrice } from '~/composables/useProductMatching'
import { useImageUtils } from '~/composables/useImageUtils'
import { useProductMetadata } from '~/composables/useProductMetadata'
import { useProductComparison } from '~/composables/useProductComparison'
import ProductMetadataPopup from '~/components/product-matching/ProductMetadataPopup.vue'
import ProductComparisonPopup from '~/components/product-matching/ProductComparisonPopup.vue'

const { isUIAllowed } = useRoles()

const { hideSidebar, isNewSidebarEnabled } = storeToRefs(useSidebarStore())

const workspaceStore = useWorkspace()

// Scroll position tracking
const isUserScrolling = ref(false)

const { loadRoles } = useRoles()
const { activeWorkspace: _activeWorkspace } = storeToRefs(workspaceStore)
const { loadCollaborators } = workspaceStore

const currentWorkspace = computedAsync(async () => {
  await loadRoles(undefined, {}, _activeWorkspace.value?.id)
  return _activeWorkspace.value
})

// Use the product matching composable
const {
  products,
  selectedProduct,
  candidates,
  matches,
  _matchesRef,
  filters,
  filteredProducts,
  productSelectionOptions,
  searchLoading,
  candidatesLoading,
  searchQuery,
  filterOptions,
  loadProducts,
  loadCandidates,
  loadMatches,
  selectProduct,
  confirmMatch,
  rejectMatch,
  initialize,
  triggerSearch,
  clearSearch,
  loading,
  error,
  saveScrollPosition,
  restoreScrollPosition
} = useProductMatching()

// Debug: Check if scroll methods are available
console.log('🔍 DEBUG: saveScrollPosition available:', typeof saveScrollPosition === 'function')
console.log('🔍 DEBUG: restoreScrollPosition available:', typeof restoreScrollPosition === 'function')

// Use image utilities
const { getProductImage, handleImageError } = useImageUtils()

// Use product metadata popup
const {
  isPopupVisible,
  currentProductData,
  currentProductType,
  showInternalProductMetadata,
  showExternalProductMetadata,
  hideProductMetadata
} = useProductMetadata()

// Use product comparison popup
const {
  isComparisonVisible,
  internalProduct,
  externalProduct,
  showComparisonFromOption,
  hideProductComparison
} = useProductComparison()

// Initialize the product matching system
onMounted(() => {
  // Initialize product matching immediately without awaiting
  initialize().catch(error => {
    console.error('Failed to initialize product matching:', error)
  })
  
  // Add scroll event listeners for position tracking
  const handleScroll = () => {
    if (!isUserScrolling.value) {
      isUserScrolling.value = true
      setTimeout(() => {
        isUserScrolling.value = false
      }, 100)
    }
  }
  
  window.addEventListener('scroll', handleScroll, { passive: true })
  
  // Cleanup on unmount
  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll)
  })
})

// Handle product selection
const handleProductSelection = async (product: any) => {
  try {
    // Save current scroll position before selection
    if (typeof saveScrollPosition === 'function') {
      saveScrollPosition()
    } else {
      console.warn('saveScrollPosition method not available')
    }
    
    await selectProduct(product)
    
    // Restore scroll position after selection
    nextTick(() => {
      if (typeof restoreScrollPosition === 'function') {
        restoreScrollPosition()
      } else {
        console.warn('restoreScrollPosition method not available')
      }
    })
  } catch (error) {
    console.error('Error in handleProductSelection:', error)
  }
}

// Handle option selection
const handleOptionSelection = async (optionId: string) => {
  await confirmMatch(optionId)
}

// Handle option rejection
const handleOptionRejection = async (optionId: string) => {
  await rejectMatch(optionId)
}

// Handle image clicks for metadata popup
const handleInternalProductImageClick = (product: any) => {
  // Transform the product data to match internal product structure
  const internalProduct = {
    id: parseInt(product.id) || 0,
    product_name: product.title || product.product_name,
    product_code: product.description || product.product_code,
    ean: product.gtin || product.ean,
    category: product.category_id || product.category,
    price: product.price,
    image_url: product.media && product.media.length > 0 ? product.media[0].url : undefined,
    brand: product.brand,
    source: product.source || 'Internal',
    description: product.description || product.product_code || 'No description available'
  }
  
  showInternalProductMetadata(internalProduct)
}

const handleExternalProductImageClick = (product: any) => {
  // Transform the product data to match external product structure
  const externalProduct = {
    id: product.external_product_key || product.id || '',
    title: product.title,
    brand: product.brand,
    category_id: product.category_id || product.category,
    price: product.price,
    gtin: product.gtin,
    sku: product.sku,
    description: product.description,
    image_url: product.image || product.image_url,
    product_url: product.product_url,
    availability: product.availability !== undefined ? product.availability : true,
    source_id: product.source?.code || product.source_id
  }
  
  showExternalProductMetadata(externalProduct)
}



// Track loading state for each button
const buttonLoading = ref(new Set<string>())

// Function to determine product match status
const getProductMatchStatus = (productId: string) => {
  // Ensure matches.value is always an array
  const matchesArray = Array.isArray(matches.value) ? matches.value : []
  const productMatches = matchesArray.filter(match => match.local_product_id === productId)
  
  // Check for confirmed matches first - show green dot for confirmed matches
  const confirmedMatches = productMatches.filter(match => match.status === 'matched')
  if (confirmedMatches.length > 0) {
    return 'matched'
  }
  
  // DEFAULT: All products show red dot unless they have confirmed matches
  // This includes:
  // - Products with no match history (productMatches.length === 0)
  // - Products with rejected matches (status === 'not_matched') 
  // - Products with other statuses (like 'superseded')
  return 'not_matched'
}





// Computed properties for status counts (safer and more efficient)
const statusCounts = computed(() => {
  const matchesArray = Array.isArray(matches.value) ? matches.value : []
  const productsArray = Array.isArray(filteredProducts.value) ? filteredProducts.value : []
  
  return {
    matched: productsArray.filter(p => getProductMatchStatus(p.id) === 'matched').length,
    unmatched: productsArray.filter(p => getProductMatchStatus(p.id) === 'not_matched').length,
    notProcessed: 0 // No longer used - all products show dots now
  }
})

// Helper function to get match count for tooltip
const getMatchCount = (productId: string) => {
  const matchesArray = Array.isArray(matches.value) ? matches.value : []
  return matchesArray.filter(m => m.local_product_id === productId && m.status === 'matched').length
}



// Handle match toggle (Phase 3: Full functionality)
const handleMatchToggle = async (option: any) => {
  const buttonId = option.id
  
  // Prevent multiple clicks
  if (buttonLoading.value.has(buttonId)) return
  
  try {
    buttonLoading.value.add(buttonId)
    
    if (option.selected) {
      // Currently matched - remove the match
      console.log('Removing match for:', option.id)
      
      const matchData = {
        local_product_id: option.leftProduct.id,
        external_product_key: option.rightProduct.external_product_key,
        source_code: option.source
      }
      
      // Call the remove match API
      await $fetch(`http://localhost:8087/matches/remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'default',
          'x-base-id': 'default',
          'x-user-id': 'test-user'
        },
        body: matchData
      })
      
      console.log('Match removed successfully')
      
      // Refresh matches data
      await loadMatches()
      
    } else {
      // Currently unmatched - create the match
      console.log('Creating match for:', option.id)
      
      const matchData = {
        local_product_id: option.leftProduct.id,
        external_product_key: option.rightProduct.external_product_key,
        source_code: option.source,
        score: option.score,
        price_delta_pct: option.priceDelta,
        rule_id: 'rule-default-001',
        session_id: 'sess-001',
        notes: 'Created via Match button'
      }
      
      // Call the create match API
      await $fetch(`http://localhost:8087/matches/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'default',
          'x-base-id': 'default',
          'x-user-id': 'test-user'
        },
        body: matchData
      })
      
      console.log('Match created successfully')
      
      // Refresh matches data
      await loadMatches()
    }
  } catch (error) {
    console.error('Error toggling match:', error)
    
    // Show user-friendly error message
    const errorMessage = error?.message || 'Failed to toggle match'
    console.error('Match toggle error details:', {
      optionId: option.id,
      action: option.selected ? 'remove' : 'create',
      error: errorMessage
    })
    
    // You could add a toast notification here for user feedback
    // For now, we'll just log the error
  } finally {
    buttonLoading.value.delete(buttonId)
  }
}

watch(
  () => currentWorkspace.value?.title,
  (title) => {
    if (!title) return

    const capitalizedTitle = title.charAt(0).toUpperCase() + title.slice(1)

    useTitle(capitalizedTitle)
  },
  {
    immediate: true,
  },
)

onMounted(() => {
  // Load collaborators in background without blocking UI
  until(() => currentWorkspace.value?.id)
    .toMatch((v) => !!v)
    .then(() => {
      loadCollaborators({ includeDeleted: true }, currentWorkspace.value!.id)
        .catch(error => {
          console.error('Failed to load collaborators:', error)
        })
    })
})

onBeforeMount(() => {
  // For workspace pages with mini sidebar, hide the main sidebar completely
  hideSidebar.value = isNewSidebarEnabled.value
})
</script>

<template>
  <div class="flex w-full flex-col nc-workspace-product !m-0 !p-0">
    <div class="flex gap-2 items-center min-w-0 p-2 h-[var(--topbar-height)] border-b-1 border-gray-200">
      <GeneralOpenLeftSidebarBtn v-if="!isNewSidebarEnabled" />

      <div class="flex-1 nc-breadcrumb nc-no-negative-margin pl-1">
        <div class="nc-breadcrumb-item capitalize">
          {{ currentWorkspace?.title || 'Loading...' }}
        </div>
        <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />
        <h1 class="nc-breadcrumb-item active">
          {{ $t('general.product') }}
        </h1>
      </div>

      <SmartsheetTopbarCmdK v-if="!isNewSidebarEnabled" />
    </div>
    
    <div class="flex-1 flex overflow-hidden">
      <!-- Show layout structure immediately -->
      <div class="flex w-full">
        <!-- Left Panel: Always show structure -->
        <div class="w-36/100 border-r border-gray-200 bg-white flex flex-col h-full overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-lg font-medium text-gray-900">
                Matching Products
                <span class="text-sm text-gray-400 font-normal ml-1">({{ loading ? '...' : filteredProducts.length }})</span>
              </h2>
            </div>
            
            <!-- Show filters immediately, disable when loading -->
            <div class="space-y-2">
              <div class="grid grid-cols-4 gap-2">
                <a-select 
                  v-model:value="filters.brand" 
                  placeholder="All Brands" 
                  size="small" 
                  class="minimal-select"
                  :disabled="loading"
                >
                  <a-select-option value="">All Brands</a-select-option>
                  <a-select-option 
                    v-for="brand in filterOptions.brands" 
                    :key="brand" 
                    :value="brand"
                  >
                    {{ brand }}
                  </a-select-option>
                </a-select>
                
                <a-select 
                  v-model:value="filters.category" 
                  placeholder="All Categories" 
                  size="small" 
                  class="minimal-select"
                  :disabled="loading"
                >
                  <a-select-option value="">All Categories</a-select-option>
                  <a-select-option 
                    v-for="category in filterOptions.categories" 
                    :key="category" 
                    :value="category"
                  >
                    {{ category }}
                  </a-select-option>
                </a-select>
                
                <a-select 
                  v-model:value="filters.source" 
                  placeholder="All Sources" 
                  size="small" 
                  class="minimal-select"
                  :disabled="loading"
                >
                  <a-select-option value="">All Sources</a-select-option>
                  <a-select-option 
                    v-for="source in filterOptions.sources" 
                    :key="source.code" 
                    :value="source.code"
                  >
                    {{ source.name }}
                  </a-select-option>
                </a-select>
                
                <a-select 
                  v-model:value="filters.score" 
                  placeholder="All Scores" 
                  size="small" 
                  class="minimal-select"
                  :disabled="loading"
                >
                  <a-select-option value="">All Scores</a-select-option>
                  <a-select-option value="30-50">30-50%</a-select-option>
                  <a-select-option value="50-70">50-70%</a-select-option>
                  <a-select-option value="70-100">70%+</a-select-option>
                </a-select>
              </div>
              
              <div class="flex gap-2">
                <a-select 
                  v-model:value="filters.orderBy" 
                  size="small" 
                  class="minimal-sort-select w-32"
                  :suffixIcon="null"
                  :disabled="loading"
                >
                  <template #suffixIcon>
                    <GeneralIcon 
                      :icon="filters.orderBy === 'score' ? 'ncArrowDown2' : 'ncArrowUp2'" 
                      class="w-3 h-3 text-gray-400"
                    />
                  </template>
                  <a-select-option value="score">Match Score</a-select-option>
                  <a-select-option value="price">Price</a-select-option>
                  <a-select-option value="name">Name</a-select-option>
                </a-select>
                
                <a-input-search 
                  v-model:value="searchQuery" 
                  placeholder="Search products..." 
                  size="small"
                  class="minimal-search flex-1"
                  :loading="searchLoading"
                  :disabled="loading"
                  @search="triggerSearch"
                  @clear="clearSearch"
                  @pressEnter="triggerSearch"
                />
              </div>
            </div>
          </div>
          
          <!-- Product List Area -->
          <div class="flex-1 overflow-y-auto" style="height: 0;">
            <!-- Loading State for Products -->
            <div v-if="loading" class="flex items-center justify-center py-12">
              <div class="text-center">
                <a-spin size="large" class="mb-4" />
                <div class="text-sm text-gray-500">Loading products...</div>
              </div>
            </div>
            
            <!-- Error State -->
            <div v-else-if="error" class="flex items-center justify-center py-12">
              <div class="text-center">
                <div class="text-red-500 text-sm font-semibold mb-2">Error Loading Products</div>
                <div class="text-gray-600 text-xs mb-4">{{ error }}</div>
                <a-button size="small" type="primary" @click="initialize">Retry</a-button>
              </div>
            </div>
            
            <!-- Products Content -->
            <div v-else class="space-y-3">
              <!-- No Products Found Message -->
              <div v-if="filteredProducts.length === 0" class="text-center py-8">
                <div class="mb-3">
                  <GeneralIcon icon="search" class="h-10 w-10 text-gray-300 mx-auto" />
                </div>
                <h3 class="text-base font-medium text-gray-900 mb-1">No Products Found</h3>
                <p class="text-sm text-gray-500">
                  {{ filters.search ? `No products match "${filters.search}"` : 'No products available in your catalog' }}
                </p>
              </div>

              <!-- Products List -->
              <div
                v-for="product in filteredProducts"
                :key="product.id"
                @click="handleProductSelection(product)"
                :class="[
                  'p-4 rounded-xl cursor-pointer transition-all duration-200 border-2',
                  selectedProduct?.id === product.id
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 shadow-sm' 
                    : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
                ]"
              >
                <div class="flex items-center gap-4">
                  <div class="relative">
                    <img 
                      :src="getProductImage(product.media, { width: 56, height: 56 })" 
                      :alt="product.title"
                      class="w-14 h-14 rounded-lg object-cover bg-gray-100 border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                      @error="handleImageError($event, { width: 56, height: 56 })"
                      @click.stop="handleInternalProductImageClick(product)"
                    />
                    <!-- Match Status Dot - Always show: Red by default, Green when matched -->
                    <div 
                      :class="[
                        'absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white cursor-help',
                        getProductMatchStatus(product.id) === 'matched' 
                          ? 'bg-green-500' 
                          : 'bg-red-500'
                      ]"
                      :title="getProductMatchStatus(product.id) === 'matched' 
                        ? `Has ${getMatchCount(product.id)} confirmed match(es)` 
                        : 'No confirmed matches found'"
                    ></div>
                  </div>
                  
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-3 mb-2">
                      <h3 class="text-sm font-semibold text-gray-900 truncate">
                        {{ product.title }}
                      </h3>
                    </div>
                    
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-medium text-gray-500">Brand</span>
                        <span class="text-sm font-bold text-gray-900">{{ product.brand || 'N/A' }}</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-semibold text-gray-900">${{ formatPrice(product.price) }}</span>

                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Right Panel: Selection Options -->
        <div class="w-64/100 bg-white">
          <div class="p-6 border-b border-gray-100 bg-white">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold text-gray-900">
                Matches & Options
                <span class="text-gray-500 font-normal ml-2">
                  ({{ candidatesLoading ? '...' : productSelectionOptions.length }})
                </span>
              </h2>
              <a-button type="text" size="middle" class="text-gray-600 hover:text-gray-900">
                No Option
              </a-button>
            </div>
          </div>
          
          <div class="p-6 space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto">
            <!-- Loading State for Matches -->
            <div v-if="candidatesLoading" class="flex items-center justify-center py-12">
              <div class="text-center">
                <a-spin size="large" class="mb-4" />
                <div class="text-sm text-gray-500">Loading matches...</div>
              </div>
            </div>
            
            <!-- No Options Found Message -->
            <div v-else-if="productSelectionOptions.length === 0" class="text-center py-8">
              <div class="mb-3">
                <GeneralIcon icon="link" class="h-10 w-10 text-gray-300 mx-auto" />
              </div>
              <h3 class="text-base font-medium text-gray-900 mb-1">No Matches Found</h3>
              <p class="text-sm text-gray-500">
                {{ selectedProduct 
                  ? `No matching products found for "${selectedProduct.title}"` 
                  : 'Select a product from the left panel to find matches' 
                }}
              </p>
            </div>

            <!-- Matches List - Only show when not loading -->
            <div
              v-else
              v-for="option in productSelectionOptions"
              :key="option.id"
              :class="[
                'p-4 rounded-lg transition-all duration-200 border',
                option.selected 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-white border-gray-200 hover:border-gray-300'
              ]"
            >
              <!-- Single Row Layout: [Image 1] [Image 2] [Details 1] [Details 2] -->
              <div class="flex items-start gap-6">
                <!-- Image 1 -->
                <div class="flex-shrink-0">
                  <img 
                    :key="`int-${option.id}-${option.leftProduct.id}`"
                    :src="getProductImage(option.leftProduct.media, { width: 96, height: 96 })" 
                    :alt="option.leftProduct.title"
                    class="w-24 h-24 rounded-lg object-cover bg-gray-200 border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity"
                    @error="handleImageError($event, { width: 96, height: 96 })"
                    @click.stop="showComparisonFromOption(option)"
                    title="Click to compare products"
                  />
                </div>
                
                <!-- Image 2 -->
                <div class="flex-shrink-0">
                  <img 
                    :key="`ext-${option.id}-${option.rightProduct.id || option.rightProduct.external_product_key}`"
                    :src="option.rightProduct.image || option.rightProduct.image_url || getProductImage([], { width: 96, height: 96 })" 
                    :alt="option.rightProduct.title"
                    class="w-24 h-24 rounded-lg object-cover bg-gray-200 border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity"
                    @error="handleImageError($event, { width: 96, height: 96 })"
                    @click.stop="showComparisonFromOption(option)"
                    title="Click to compare products"
                  />
                </div>
                
                <!-- Details Section -->
                <div class="flex-1 min-w-0 space-y-3">
                  <!-- Product Names and Brands -->
                  <div class="grid grid-cols-2 gap-4">
                    <!-- Internal Product -->
                    <div class="text-right">
                      <div class="font-semibold text-gray-900 text-sm leading-tight truncate">{{ option.leftProduct.title }}</div>
                      <div class="text-xs text-gray-600">{{ option.leftProduct.brand || 'N/A' }}</div>
                      <div class="text-xs text-gray-500 font-mono">{{ option.leftProduct.gtin || 'N/A' }}</div>
                      <div class="font-bold text-gray-900 text-base">${{ formatPrice(option.leftProduct.price) }}</div>
                    </div>
                    
                    <!-- External Product -->
                    <div class="text-left">
                      <div class="font-semibold text-gray-900 text-sm leading-tight truncate">{{ option.rightProduct.title }}</div>
                      <div class="text-xs text-gray-600">{{ option.rightProduct.brand || 'N/A' }}</div>
                      <div class="text-xs text-gray-500 font-mono">{{ option.rightProduct.gtin || 'N/A' }}</div>
                      <div class="font-bold text-gray-900 text-base">${{ formatPrice(option.rightProduct.price) }}</div>
                    </div>
                  </div>
                  
                  <!-- Match Quality Indicators -->
                  <div class="border-t pt-2">
                    <!-- Only Show Match Score -->
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-semibold text-gray-700">
                        {{ Math.round(option.score * 100) }}% Match
                      </span>
                      <span class="text-xs text-gray-500">{{ option.source }}</span>
                    </div>
                  </div>
                </div>
                
                <!-- Match Button -->
                <div class="flex-shrink-0">
                  <button
                    type="button"
                    :disabled="buttonLoading.has(option.id)"
                    :class="[
                      'px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
                      option.selected
                        ? 'bg-red-100 text-red-700 hover:bg-red-200 focus:ring-red-500 border border-red-300'
                        : 'bg-green-100 text-green-700 hover:bg-green-200 focus:ring-green-500 border border-green-300'
                    ]"
                    @click.stop="handleMatchToggle(option)"
                  >
                    <span v-if="buttonLoading.has(option.id)" class="inline-flex items-center">
                      <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {{ option.selected ? 'Unmatching...' : 'Matching...' }}
                    </span>
                    <span v-else>
                      {{ option.selected ? 'Unmatch' : 'Match' }}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Product Metadata Popup -->
    <ProductMetadataPopup
      :is-visible="isPopupVisible"
      :product-data="currentProductData"
      :product-type="currentProductType"
      @close="hideProductMetadata"
    />

    <!-- Product Comparison Popup -->
    <ProductComparisonPopup
      :is-visible="isComparisonVisible"
      :internal-product="internalProduct"
      :external-product="externalProduct"
      @close="hideProductComparison"
    />
  </div>
</template>

<style lang="scss" scoped>
.nc-workspace-product {
  @apply h-full;
}

// Minimalistic filter styling
.minimal-select {
  :deep(.ant-select-selector) {
    border-radius: 6px !important;
    border: 1px solid #e5e7eb !important;
    background-color: #ffffff !important;
    transition: all 0.15s ease;
    height: 32px !important;
    padding: 0 8px !important;
    
    &:hover {
      border-color: #d1d5db !important;
      background-color: #f9fafb !important;
    }
  }
  
  :deep(.ant-select-focused .ant-select-selector) {
    border-color: #3b82f6 !important;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1) !important;
    background-color: #ffffff !important;
  }
  
  :deep(.ant-select-selection-placeholder) {
    color: #9ca3af;
    font-size: 13px;
    font-weight: 400;
  }
  
  :deep(.ant-select-selection-item) {
    color: #374151;
    font-size: 13px;
    font-weight: 500;
  }
  
  :deep(.ant-select-arrow) {
    color: #9ca3af;
    font-size: 12px;
  }
  
  // Disabled state
  &.ant-select-disabled {
    :deep(.ant-select-selector) {
      background-color: #f3f4f6 !important;
      border-color: #e5e7eb !important;
      color: #9ca3af !important;
      cursor: not-allowed !important;
    }
  }
}

.minimal-sort-select {
  :deep(.ant-select-selector) {
    border-radius: 6px !important;
    border: 1px solid #e5e7eb !important;
    background-color: #f8fafc !important;
    transition: all 0.15s ease;
    height: 32px !important;
    padding: 0 8px !important;
    
    &:hover {
      border-color: #3b82f6 !important;
      background-color: #ffffff !important;
    }
  }
  
  :deep(.ant-select-focused .ant-select-selector) {
    border-color: #3b82f6 !important;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1) !important;
    background-color: #ffffff !important;
  }
  
  :deep(.ant-select-selection-item) {
    color: #374151;
    font-size: 13px;
    font-weight: 500;
  }
  
  // Disabled state
  &.ant-select-disabled {
    :deep(.ant-select-selector) {
      background-color: #f3f4f6 !important;
      border-color: #e5e7eb !important;
      color: #9ca3af !important;
      cursor: not-allowed !important;
    }
  }
}

.minimal-search {
  :deep(.ant-input-search) {
    border-radius: 6px !important;
    border: 1px solid #e5e7eb !important;
    background-color: #ffffff !important;
    transition: all 0.15s ease;
    height: 32px !important;
    
    &:hover {
      border-color: #d1d5db !important;
      background-color: #f9fafb !important;
    }
    
    &:focus-within {
      border-color: #3b82f6 !important;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1) !important;
      background-color: #ffffff !important;
    }
  }
  
  :deep(.ant-input) {
    border: none !important;
    background: transparent !important;
    padding: 4px 8px !important;
    font-size: 13px !important;
    color: #374151 !important;
    
    &::placeholder {
      color: #9ca3af !important;
      font-weight: 400 !important;
    }
  }
  
  :deep(.ant-input-search-button) {
    border: none !important;
    background: transparent !important;
    height: 30px !important;
    width: 30px !important;
    
    .anticon {
      color: #9ca3af !important;
      font-size: 12px !important;
    }
  }
  
  // Disabled state
  &.ant-input-search-disabled {
    :deep(.ant-input-search) {
      background-color: #f3f4f6 !important;
      border-color: #e5e7eb !important;
      cursor: not-allowed !important;
    }
    
    :deep(.ant-input) {
      background-color: transparent !important;
      color: #9ca3af !important;
      cursor: not-allowed !important;
    }
  }
}

// Sort dropdown specific styling
.sort-dropdown-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  
  .sort-label {
    font-size: 12px;
    font-weight: 600;
    color: #4b5563;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 2px;
  }
}

.sort-select {
  :deep(.ant-select-selector) {
    border-radius: 8px !important;
    border: 2px solid #e5e7eb !important;
    background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%) !important;
    transition: all 0.2s ease;
    height: 44px !important;
    padding: 0 12px !important;
    
    &:hover {
      border-color: #3b82f6 !important;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15) !important;
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%) !important;
    }
  }
  
  :deep(.ant-select-focused .ant-select-selector) {
    border-color: #3b82f6 !important;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
    background: #ffffff !important;
  }
  
  :deep(.ant-select-selection-item) {
    color: #1f2937;
    font-size: 14px;
    font-weight: 600;
    padding: 0 !important;
  }
  
  .sort-icon-container {
    display: flex;
    align-items: center;
    padding-right: 4px;
    
    .sort-icon {
      width: 16px;
      height: 16px;
      color: #3b82f6;
    }
  }
}

// Sort option styling in dropdown
.sort-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  
  .option-icon {
    width: 14px;
    height: 14px;
    color: #6b7280;
    flex-shrink: 0;
  }
  
  span:first-of-type {
    font-weight: 600;
    color: #1f2937;
  }
  
  .sort-direction {
    font-size: 12px;
    color: #6b7280;
    font-weight: 400;
    margin-left: auto;
  }
}

// Enhanced dropdown options styling
.sort-select {
  :deep(.ant-select-dropdown) {
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    border: 1px solid #e5e7eb;
    padding: 4px;
  }
  
  :deep(.ant-select-item) {
    border-radius: 6px;
    margin: 2px 0;
    padding: 8px 12px;
    transition: all 0.15s ease;
    
    &:hover {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      color: #1e40af;
    }
    
    &.ant-select-item-option-selected {
      background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
      color: #1e40af;
      font-weight: 600;
      
      .sort-option {
        .option-icon {
          color: #3b82f6;
        }
      }
    }
  }
}

// Score filter specific styling
.score-filter-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  
  .filter-label {
    font-size: 12px;
    font-weight: 600;
    color: #7c3aed;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 2px;
  }
}

.score-filter-select {
  :deep(.ant-select-selector) {
    border-radius: 8px !important;
    border: 2px solid #e5e7eb !important;
    background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%) !important;
    transition: all 0.2s ease;
    height: 44px !important;
    padding: 0 12px !important;
    
    &:hover {
      border-color: #7c3aed !important;
      box-shadow: 0 2px 8px rgba(124, 58, 237, 0.15) !important;
      background: linear-gradient(135deg, #faf5ff 0%, #f1e8ff 100%) !important;
    }
  }
  
  :deep(.ant-select-focused .ant-select-selector) {
    border-color: #7c3aed !important;
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1) !important;
    background: #ffffff !important;
  }
  
  :deep(.ant-select-selection-item) {
    color: #581c87;
    font-size: 14px;
    font-weight: 600;
    padding: 0 !important;
  }
  
  .filter-icon-container {
    display: flex;
    align-items: center;
    padding-right: 4px;
    
    .filter-icon {
      width: 16px;
      height: 16px;
      color: #7c3aed;
    }
  }
  
  :deep(.ant-select-dropdown) {
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    border: 1px solid #e5e7eb;
    padding: 4px;
  }
  
  :deep(.ant-select-item) {
    border-radius: 6px;
    margin: 2px 0;
    padding: 8px 12px;
    transition: all 0.15s ease;
    
    &:hover {
      background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
      color: #6b21a8;
    }
    
    &.ant-select-item-option-selected {
      background: linear-gradient(135deg, #e9d5ff 0%, #ddd6fe 100%);
      color: #6b21a8;
      font-weight: 600;
      
      .filter-option {
        .option-icon {
          color: #7c3aed;
        }
      }
    }
  }
}

// Filter option styling in dropdown
.filter-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  
  .option-icon {
    width: 14px;
    height: 14px;
    color: #6b7280;
    flex-shrink: 0;
  }
  
  span:first-of-type {
    font-weight: 600;
    color: #1f2937;
  }
  
  .filter-description {
    font-size: 12px;
    color: #6b7280;
    font-weight: 400;
    margin-left: auto;
  }
}

// Professional search input styling
.search-input {
  :deep(.ant-input-search) {
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    background-color: #ffffff;
    transition: all 0.2s ease;
    height: 40px;
    
    &:hover {
      border-color: #d1d5db;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    
    &:focus-within {
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }
  }
  
  :deep(.ant-input) {
    border: none;
    background: transparent;
    padding: 8px 12px;
    font-size: 14px;
    color: #374151;
    font-weight: 400;
    
    &::placeholder {
      color: #6b7280;
      font-weight: 400;
    }
  }
  
  :deep(.ant-input-search-button) {
    border: none;
    background: transparent;
    border-radius: 0 8px 8px 0;
    height: 100%;
    padding: 0 12px;
    transition: all 0.2s ease;
    
    &:hover {
      background: #f3f4f6;
    }
    
    .anticon {
      color: #6b7280;
    }
  }
  
  :deep(.ant-input-clear-icon) {
    color: #9ca3af;
    
    &:hover {
      color: #6b7280;
    }
  }
}

/* Image error state styling */
.image-error {
  background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 12px;
  text-align: center;
  padding: 8px;
}

/* Image loading states */
img {
  transition: opacity 0.2s ease-in-out;
}

img:not(.image-error) {
  opacity: 1;
}

img.image-error {
  opacity: 0.8;
}

/* Responsive image sizing */
@media (max-width: 768px) {
  .w-14 {
    width: 3rem;
    height: 3rem;
  }
  
  .w-24 {
    width: 5rem;
    height: 5rem;
  }
}
</style>
