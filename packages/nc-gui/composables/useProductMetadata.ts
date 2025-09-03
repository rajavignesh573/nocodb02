import { ref, readonly } from 'vue'

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

type ProductData = InternalProduct | ExternalProduct
type ProductType = 'internal' | 'external'

export function useProductMetadata() {
  // State
  const isPopupVisible = ref(false)
  const currentProductData = ref<ProductData | null>(null)
  const currentProductType = ref<ProductType>('internal')

  // Methods
  const showProductMetadata = (productData: ProductData, productType: ProductType) => {
    currentProductData.value = productData
    currentProductType.value = productType
    isPopupVisible.value = true
  }

  const hideProductMetadata = () => {
    isPopupVisible.value = false
    // Don't clear data immediately to avoid flickering during close animation
    setTimeout(() => {
      currentProductData.value = null
    }, 300)
  }

  const showInternalProductMetadata = (product: InternalProduct) => {
    showProductMetadata(product, 'internal')
  }

  const showExternalProductMetadata = (product: ExternalProduct) => {
    showProductMetadata(product, 'external')
  }

  return {
    // State
    isPopupVisible: readonly(isPopupVisible),
    currentProductData: readonly(currentProductData),
    currentProductType: readonly(currentProductType),

    // Methods
    showProductMetadata,
    hideProductMetadata,
    showInternalProductMetadata,
    showExternalProductMetadata,
  }
}
