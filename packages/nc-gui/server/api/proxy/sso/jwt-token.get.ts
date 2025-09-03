export default defineEventHandler(async (event) => {
  try {
    console.log('🔐 SSO Proxy endpoint called')
    
    // Get authentication cookies from the request
    const cookies = getHeader(event, 'cookie') || ''
    const authorization = getHeader(event, 'authorization') || ''
    
    console.log('📋 Request headers:', { cookies: cookies ? 'Present' : 'Missing', authorization: authorization ? 'Present' : 'Missing' })
    
    // Forward request to NocoDB backend
    const backendUrl = 'http://localhost:8086/api/v1/sso/jwt-token'
    console.log('🔄 Forwarding to backend:', backendUrl)
    
    const response = await $fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookies,
        'Authorization': authorization,
        'Content-Type': 'application/json'
      }
    })
    
    console.log('✅ Backend response received:', { success: response.success, hasToken: !!response.token })
    return response
    
  } catch (error) {
    console.error('❌ SSO proxy error:', error)
    
    // Return proper error response
    throw createError({
      statusCode: 500,
      statusMessage: 'SSO Proxy Error',
      data: {
        success: false,
        error: 'Failed to proxy SSO request',
        message: error.message || 'Internal server error',
        details: error
      }
    })
  }
})
