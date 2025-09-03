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

export function useProductComparison() {
  // State
  const isComparisonVisible = ref(false)
  const internalProduct = ref<InternalProduct | null>(null)
  const externalProduct = ref<ExternalProduct | null>(null)

  // Methods
  const showProductComparison = (internal: InternalProduct, external: ExternalProduct) => {
    internalProduct.value = internal
    externalProduct.value = external
    isComparisonVisible.value = true
  }

  const hideProductComparison = () => {
    isComparisonVisible.value = false
    // Don't clear data immediately to avoid flickering during close animation
    setTimeout(() => {
      internalProduct.value = null
      externalProduct.value = null
    }, 300)
  }

  const showComparisonFromOption = (option: any) => {
    // Transform the internal product data
    const internal = {
      id: parseInt(option.leftProduct.id) || 0,
      product_name: option.leftProduct.title || option.leftProduct.product_name,
      product_code: option.leftProduct.description || option.leftProduct.product_code,
      ean: option.leftProduct.gtin || option.leftProduct.ean,
      category: option.leftProduct.category_id || option.leftProduct.category,
      price: option.leftProduct.price,
      image_url: option.leftProduct.media && option.leftProduct.media.length > 0 ? option.leftProduct.media[0].url : undefined,
      brand: option.leftProduct.brand,
      source: option.leftProduct.source || 'Internal',
      description: option.leftProduct.description || option.leftProduct.product_code || 'No description available'
    }

    // Transform the external product data
    const external = {
      id: option.rightProduct.external_product_key || option.rightProduct.id || '',
      title: option.rightProduct.title,
      brand: option.rightProduct.brand,
      category_id: option.rightProduct.category_id || option.rightProduct.category,
      price: option.rightProduct.price,
      gtin: option.rightProduct.gtin,
      sku: option.rightProduct.sku,
      description: option.rightProduct.description,
      image_url: option.rightProduct.image || option.rightProduct.image_url,
      product_url: option.rightProduct.product_url,
      availability: option.rightProduct.availability !== undefined ? option.rightProduct.availability : true,
      source_id: option.rightProduct.source?.code || option.rightProduct.source_id
    }

    showProductComparison(internal, external)
  }

  return {
    // State
    isComparisonVisible: readonly(isComparisonVisible),
    internalProduct: readonly(internalProduct),
    externalProduct: readonly(externalProduct),

    // Methods
    showProductComparison,
    hideProductComparison,
    showComparisonFromOption,
  }
}
