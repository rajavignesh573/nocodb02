import { ref } from 'vue'

export interface ImageFallbackOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'webp' | 'jpeg' | 'png'
}

export function useImageUtils() {
  const imageLoadErrors = ref(new Set<string>())

  // Generate a placeholder image URL using a reliable service
  const getPlaceholderImage = (options: ImageFallbackOptions = {}) => {
    const { width = 300, height = 300, quality = 80, format = 'webp' } = options
    
    // Create a data URL for a simple SVG placeholder (no external dependencies)
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="14" 
              fill="#9ca3af" text-anchor="middle" dy=".3em">
          No Image
        </text>
      </svg>
    `.trim()
    
    // Convert to data URL
    const encodedSvg = encodeURIComponent(svg)
    return `data:image/svg+xml,${encodedSvg}`
  }

  // Get product image with fallback
  const getProductImage = (media: any[] | undefined, fallbackOptions?: ImageFallbackOptions) => {
    if (media && media.length > 0 && media[0]?.url) {
      // Validate the URL before returning it
      if (isValidImageUrl(media[0].url)) {
        return media[0].url
      }
    }
    return getPlaceholderImage(fallbackOptions)
  }

  // Handle image load errors
  const handleImageError = (event: Event, fallbackOptions?: ImageFallbackOptions) => {
    const target = event.target as HTMLImageElement
    const originalSrc = target.src
    
    // Add to error tracking
    imageLoadErrors.value.add(originalSrc)
    
    // Set fallback image (only if it's not already a data URL)
    if (!originalSrc.startsWith('data:')) {
      target.src = getPlaceholderImage(fallbackOptions)
    }
    
    // Add error class for styling
    target.classList.add('image-error')
    
    // Log the error for debugging
    console.warn(`Image failed to load: ${originalSrc}`)
  }

  // Check if image URL is valid
  const isValidImageUrl = (url: string): boolean => {
    if (!url) return false
    
    // Check if it's a data URL
    if (url.startsWith('data:')) return true
    
    // Check if it's a valid HTTP/HTTPS URL
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  // Preload image for better UX
  const preloadImage = (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!isValidImageUrl(url)) {
        resolve(false)
        return
      }

      const img = new Image()
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
      img.src = url
    })
  }

  return {
    imageLoadErrors,
    getPlaceholderImage,
    getProductImage,
    handleImageError,
    isValidImageUrl,
    preloadImage
  }
}
