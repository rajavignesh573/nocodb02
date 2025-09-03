<template>
  <!-- Custom Modal Implementation -->
  <div v-if="isVisible" class="modal-overlay" @click="closePopup">
    <div class="modal-container" @click.stop>
      <!-- Modal Header -->
      <div class="modal-header">
        <h2 class="modal-title">Product Comparison</h2>
        <button @click="closePopup" class="modal-close">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      <!-- Modal Content -->
      <div class="modal-content">
        <div v-if="internalProduct && externalProduct" class="comparison-content">
          <!-- Comparison Header -->
          <div class="comparison-header">
            <div class="comparison-title">
              <h3 class="text-lg font-semibold text-gray-900">Product Match Comparison</h3>
              <p class="text-sm text-gray-600">Comparing internal and external product details</p>
            </div>
          </div>

          <!-- Side by Side Comparison -->
          <div class="comparison-grid">
            <!-- Internal Product Column -->
            <div class="product-column internal">
              <div class="product-header">
                <div class="product-image-section">
                  <div class="large-image-container">
                    <img 
                      v-if="internalProduct.image_url" 
                      :src="internalProduct.image_url" 
                      :alt="internalProduct.product_name"
                      class="large-product-image"
                      @error="handleImageError"
                    />
                    <div v-else class="no-image-placeholder">
                      <GeneralIcon icon="image" class="placeholder-icon" />
                      <span class="placeholder-text">No Image</span>
                    </div>
                  </div>
                </div>
                
                <div class="product-basic-info">
                  <h3 class="product-title">{{ internalProduct.product_name }}</h3>
                  <div class="product-brand">
                    <span class="label">Brand:</span>
                    <span class="value">{{ internalProduct.brand || 'N/A' }}</span>
                  </div>
                  <div class="product-price">
                    <span class="price-value">${{ formatPrice(internalProduct.price) }}</span>
                  </div>
                </div>
              </div>

              <div class="product-details">
                <h4 class="section-title">Internal Product Details</h4>
                <div class="details-grid">
                  <div class="detail-row">
                    <span class="detail-label">Product ID:</span>
                    <span class="detail-value">{{ internalProduct.id }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Product Code:</span>
                    <span class="detail-value">{{ internalProduct.product_code || 'N/A' }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">EAN/Barcode:</span>
                    <span class="detail-value">{{ internalProduct.ean || 'N/A' }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Category:</span>
                    <span class="detail-value">{{ internalProduct.category || 'N/A' }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Source:</span>
                    <span class="detail-value">{{ internalProduct.source || 'Internal' }}</span>
                  </div>
                </div>

                <!-- Internal Product Description -->
                <div v-if="internalProduct.description" class="description-section">
                  <h4 class="section-title">Description</h4>
                  <div class="description-content">
                    <p>{{ internalProduct.description }}</p>
                  </div>
                </div>
              </div>
            </div>



            <!-- External Product Column -->
            <div class="product-column external">
              <div class="product-header">
                <div class="product-image-section">
                  <div class="large-image-container">
                    <img 
                      v-if="externalProduct.image_url" 
                      :src="externalProduct.image_url" 
                      :alt="externalProduct.title"
                      class="large-product-image"
                      @error="handleImageError"
                    />
                    <div v-else class="no-image-placeholder">
                      <GeneralIcon icon="image" class="placeholder-icon" />
                      <span class="placeholder-text">No Image</span>
                    </div>
                  </div>
                </div>
                
                <div class="product-basic-info">
                  <h3 class="product-title">{{ externalProduct.title }}</h3>
                  <div class="product-brand">
                    <span class="label">Brand:</span>
                    <span class="value">{{ externalProduct.brand || 'N/A' }}</span>
                  </div>
                  <div class="product-price">
                    <span class="price-value">${{ formatPrice(externalProduct.price) }}</span>
                  </div>
                </div>
              </div>

              <div class="product-details">
                <h4 class="section-title">External Product Details</h4>
                <div class="details-grid">
                  <div class="detail-row">
                    <span class="detail-label">Product ID:</span>
                    <span class="detail-value">{{ externalProduct.id }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">SKU:</span>
                    <span class="detail-value">{{ externalProduct.sku || 'N/A' }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">GTIN:</span>
                    <span class="detail-value">{{ externalProduct.gtin || 'N/A' }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Category:</span>
                    <span class="detail-value">{{ externalProduct.category_id || 'N/A' }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Availability:</span>
                    <span class="detail-value">
                      <span :class="['availability-status', externalProduct.availability ? 'available' : 'unavailable']">
                        {{ externalProduct.availability ? 'Available' : 'Unavailable' }}
                      </span>
                    </span>
                  </div>
                </div>

                <!-- External Product Description -->
                <div v-if="externalProduct.description" class="description-section">
                  <h4 class="section-title">Description</h4>
                  <div class="description-content">
                    <p>{{ externalProduct.description }}</p>
                  </div>
                </div>

                <!-- External Product URL -->
                <div v-if="externalProduct.product_url" class="external-link-section">
                  <h4 class="section-title">External Link</h4>
                  <div class="external-link-content">
                    <a 
                      :href="externalProduct.product_url" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      class="external-product-link"
                    >
                      <GeneralIcon icon="externalLink" class="link-icon" />
                      View on {{ getSourceName(externalProduct.source_id) }}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer with Type Indicators -->
          <div class="comparison-footer">
            <div class="type-indicators">
              <span class="type-badge internal">Internal Product</span>
              <span class="type-badge external">External Product</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

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
  description?: string
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

interface Props {
  isVisible: boolean
  internalProduct: InternalProduct | null
  externalProduct: ExternalProduct | null
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Methods
const closePopup = () => {
  emit('close')
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
  @apply bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden;
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

.comparison-content {
  @apply bg-white;
}

.comparison-header {
  @apply p-6 border-b border-gray-200 bg-gray-50;

  .comparison-title {
    @apply text-center;

    h3 {
      @apply text-lg font-semibold text-gray-900 mb-1;
    }

    p {
      @apply text-sm text-gray-600;
    }
  }
}

.comparison-grid {
  @apply flex gap-8 p-6;
}

.product-column {
  @apply flex-1;

  &.internal {
    @apply border-r border-gray-200 pr-8;
  }

  &.external {
    @apply pl-8;
  }
}

.product-header {
  @apply flex gap-4 mb-6 p-4 bg-gray-50 rounded-lg;

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
      @apply text-lg font-bold text-gray-900 mb-2 leading-tight;
    }

    .product-brand {
      @apply flex items-center gap-2 mb-2;

      .label {
        @apply text-sm font-medium text-gray-600;
      }

      .value {
        @apply text-sm font-semibold text-gray-900;
      }
    }

    .product-price {
      .price-value {
        @apply text-xl font-bold text-green-600;
      }
    }
  }
}



.product-details {
  @apply space-y-4;

  .section-title {
    @apply text-base font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-100;
  }

  .details-grid {
    @apply space-y-2;

    .detail-row {
      @apply flex items-center gap-3;

      .detail-label {
        @apply text-sm font-medium text-gray-600 min-w-0 w-24 flex-shrink-0;
      }

      .detail-value {
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

  .description-section {
    @apply mt-4;

    .description-content {
      @apply text-sm text-gray-700 leading-relaxed;
    }
  }

  .external-link-section {
    @apply mt-4;

    .external-link-content {
      .external-product-link {
        @apply inline-flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-blue-700 hover:text-blue-800 transition-colors duration-200 text-sm font-medium;

        .link-icon {
          @apply w-4 h-4;
        }
      }
    }
  }
}

.comparison-footer {
  @apply px-6 py-4 bg-gray-50 border-t border-gray-200;

  .type-indicators {
    @apply flex justify-center gap-4;

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
@media (max-width: 1024px) {
  .comparison-grid {
    @apply flex-col gap-6;
  }

  .product-column {
    &.internal {
      @apply border-r-0 border-b border-gray-200 pr-0 pb-6;
    }

    &.external {
      @apply pl-0;
    }
  }


}

@media (max-width: 768px) {
  .modal-container {
    @apply max-w-full mx-4;
  }

  .product-header {
    @apply flex-col text-center;

    .product-image-section {
      @apply self-center;
    }
  }

  .details-grid {
    .detail-row {
      @apply flex-col items-start gap-1;

      .detail-label {
        @apply w-full;
      }

      .detail-value {
        @apply w-full;
      }
    }
  }
}
</style>
