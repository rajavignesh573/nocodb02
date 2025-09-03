<template>
  <!-- Custom Modal Implementation -->
  <div v-if="isVisible" class="modal-overlay" @click="closePopup">
    <div class="modal-container" @click.stop>
      <!-- Modal Header -->
      <div class="modal-header">
        <h2 class="modal-title">Product Details</h2>
        <button @click="closePopup" class="modal-close">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      <!-- Modal Content -->
      <div class="modal-content">
        <div v-if="productData" class="product-metadata-content">
      <!-- Header Section -->
      <div class="metadata-header">
        <div class="product-image-section">
          <div class="large-image-container">
            <img 
              v-if="productData.image_url" 
              :src="productData.image_url" 
              :alt="productData.title || productData.product_name"
              class="large-product-image"
              @error="handleImageError"
            />
            <div v-else class="no-image-placeholder">
              <GeneralIcon icon="image" class="placeholder-icon" />
              <span class="placeholder-text">No Image Available</span>
            </div>
          </div>
        </div>
        
        <div class="product-basic-info">
          <h2 class="product-title">{{ productData.title || productData.product_name }}</h2>
          <div class="product-brand">
            <span class="label">Brand:</span>
            <span class="value">{{ productData.brand || 'N/A' }}</span>
          </div>
          <div class="product-price">
            <span class="price-value">${{ formatPrice(productData.price) }}</span>
          </div>
        </div>
      </div>

      <!-- Metadata Grid -->
      <div class="metadata-grid">
        <!-- Left Panel Product Fields -->
        <template v-if="isInternalProduct">
          <div class="metadata-section">
            <h3 class="section-title">Product Information</h3>
            <div class="metadata-fields">
              <div class="field-row">
                <span class="field-label">Product ID:</span>
                <span class="field-value">{{ productData.id }}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Product Code:</span>
                <span class="field-value">{{ productData.product_code || 'N/A' }}</span>
              </div>
              <div class="field-row">
                <span class="field-label">EAN/Barcode:</span>
                <span class="field-value">{{ productData.ean || 'N/A' }}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Category:</span>
                <span class="field-value">{{ productData.category || 'N/A' }}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Source:</span>
                <span class="field-value">{{ productData.source || 'Internal' }}</span>
              </div>
            </div>
          </div>

          <!-- Internal Product Description -->
          <div v-if="productData.description" class="metadata-section">
            <h3 class="section-title">Description</h3>
            <div class="description-content">
              <p>{{ productData.description }}</p>
            </div>
          </div>
        </template>

        <!-- Right Panel Product Fields -->
        <template v-else>
          <div class="metadata-section">
            <h3 class="section-title">Product Information</h3>
            <div class="metadata-fields">
              <div class="field-row">
                <span class="field-label">Product ID:</span>
                <span class="field-value">{{ productData.id }}</span>
              </div>
              <div class="field-row">
                <span class="field-label">SKU:</span>
                <span class="field-value">{{ productData.sku || 'N/A' }}</span>
              </div>
              <div class="field-row">
                <span class="field-label">GTIN:</span>
                <span class="field-value">{{ productData.gtin || 'N/A' }}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Category:</span>
                <span class="field-value">{{ productData.category_id || 'N/A' }}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Availability:</span>
                <span class="field-value">
                  <span :class="['availability-status', productData.availability ? 'available' : 'unavailable']">
                    {{ productData.availability ? 'Available' : 'Unavailable' }}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <!-- External Product Specific Section -->
          <div v-if="productData.description" class="metadata-section">
            <h3 class="section-title">Description</h3>
            <div class="description-content">
              <p>{{ productData.description }}</p>
            </div>
          </div>

          <!-- External Product URL Section -->
          <div v-if="productData.product_url" class="metadata-section">
            <h3 class="section-title">External Link</h3>
            <div class="external-link-content">
              <a 
                :href="productData.product_url" 
                target="_blank" 
                rel="noopener noreferrer"
                class="external-product-link"
              >
                <GeneralIcon icon="externalLink" class="link-icon" />
                View on {{ getSourceName(productData.source_id) }}
              </a>
            </div>
          </div>
        </template>
      </div>

          <!-- Footer with Type Indicator -->
          <div class="metadata-footer">
            <div class="product-type-indicator">
              <span class="type-badge" :class="isInternalProduct ? 'internal' : 'external'">
                {{ isInternalProduct ? 'Internal Product' : 'External Product' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, nextTick } from 'vue'

// Types for product data
interface InternalProduct {
  id: number
  product_name: string
  product_code?: string
  ean?: string
  category?: string
  price?: number
  image_url?: string
  brand?: string
  source?: string
}

interface ExternalProduct {
  id: string
  title: string
  brand?: string
  category_id?: string
  price?: number
  gtin?: string
  sku?: string
  description?: string
  image_url?: string
  product_url?: string
  availability?: boolean
  source_id?: string
}

type ProductData = InternalProduct | ExternalProduct

interface Props {
  isVisible: boolean
  productData: ProductData | null
  productType: 'internal' | 'external'
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()



// Computed properties
const isInternalProduct = computed(() => props.productType === 'internal')

// Methods
const closePopup = () => {
  emit('close')
}

const handleModalUpdate = (open: boolean) => {
  if (!open) {
    emit('close')
  }
}

const formatPrice = (price: unknown): string => {
  if (price === null || price === undefined) return '0.00'
  const numPrice = typeof price === 'string' ? Number.parseFloat(price) : Number(price)
  return Number.isNaN(numPrice) ? '0.00' : numPrice.toFixed(2)
}

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
  // The v-else will show the placeholder
}

const getSourceName = (sourceId?: string): string => {
  const sourceMap: Record<string, string> = {
    'src-amazon-001': 'Amazon',
    'src-target-001': 'Target', 
    'src-walmart-001': 'Walmart',
    'src-buybuy-001': 'BuyBuy Baby',
    'src-babies-001': 'Babies R Us'
  }
  return sourceMap[sourceId || ''] || 'External Source'
}
</script>

<style lang="scss" scoped>
/* Custom Modal Styles */
.modal-overlay {
  @apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4;
}

.modal-container {
  @apply bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden;
}

.modal-header {
  @apply flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50;

  .modal-title {
    @apply text-xl font-semibold text-gray-900 m-0;
  }

  .modal-close {
    @apply text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 border-none bg-transparent cursor-pointer;
  }
}

.modal-content {
  @apply max-h-[calc(90vh-80px)] overflow-y-auto;
}

.product-metadata-content {
  @apply bg-white;
}

.metadata-header {
  @apply flex gap-6 p-6 border-b border-gray-200 bg-gray-50;

  .product-image-section {
    @apply flex-shrink-0;

    .large-image-container {
      @apply w-32 h-32 rounded-lg overflow-hidden border border-gray-200 bg-white;

      .large-product-image {
        @apply w-full h-full object-cover;
      }

      .no-image-placeholder {
        @apply w-full h-full flex flex-col items-center justify-center text-gray-400;

        .placeholder-icon {
          @apply w-8 h-8 mb-2;
        }

        .placeholder-text {
          @apply text-xs font-medium;
        }
      }
    }
  }

  .product-basic-info {
    @apply flex-1 min-w-0;

    .product-title {
      @apply text-xl font-bold text-gray-900 mb-3 leading-tight;
    }

    .product-brand {
      @apply flex items-center gap-2 mb-3;

      .label {
        @apply text-sm font-medium text-gray-600;
      }

      .value {
        @apply text-sm font-semibold text-gray-900;
      }
    }

    .product-price {
      .price-value {
        @apply text-2xl font-bold text-green-600;
      }
    }
  }
}

.metadata-grid {
  @apply p-6 space-y-6;
}

.metadata-section {
  .section-title {
    @apply text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100;
  }

  .metadata-fields {
    @apply space-y-3;

    .field-row {
      @apply flex items-center gap-3;

      .field-label {
        @apply text-sm font-medium text-gray-600 min-w-0 w-32 flex-shrink-0;
      }

      .field-value {
        @apply text-sm text-gray-900 font-medium flex-1 min-w-0 break-words;

        .availability-status {
          @apply px-2 py-1 rounded-full text-xs font-semibold;

          &.available {
            @apply bg-green-100 text-green-800;
          }

          &.unavailable {
            @apply bg-red-100 text-red-800;
          }
        }
      }
    }
  }

  .description-content {
    @apply text-sm text-gray-700 leading-relaxed;
  }

  .external-link-content {
    .external-product-link {
      @apply inline-flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-blue-700 hover:text-blue-800 transition-colors duration-200 text-sm font-medium;

      .link-icon {
        @apply w-4 h-4;
      }
    }
  }
}

.metadata-footer {
  @apply px-6 py-4 bg-gray-50 border-t border-gray-200;

  .product-type-indicator {
    @apply flex justify-center;

    .type-badge {
      @apply px-3 py-1 rounded-full text-xs font-semibold;

      &.internal {
        @apply bg-green-100 text-green-800;
      }

      &.external {
        @apply bg-blue-100 text-blue-800;
      }
    }
  }
}



/* Responsive design */
@media (max-width: 768px) {
  .metadata-header {
    @apply flex-col gap-4;
    
    .product-image-section {
      @apply self-center;
    }

    .product-basic-info {
      @apply text-center;
    }
  }

  .metadata-fields {
    .field-row {
      @apply flex-col items-start gap-1;

      .field-label {
        @apply w-full;
      }

      .field-value {
        @apply w-full;
      }
    }
  }
}
</style>
