<template>
  <div class="nc-chat-support">
    <!-- Chat Icon Button for Mini Sidebar -->
    <div
      v-if="isMiniSidebar"
      class="nc-mini-sidebar-btn-full-width"
      data-testid="nc-sidebar-chat-support"
      @click="toggleChat"
    >
      <div
        class="nc-mini-sidebar-btn"
        :class="{ active: isChatOpen }"
      >
        <GeneralIcon icon="messageCircle" class="h-4 w-4" />
      </div>
    </div>
    
    <!-- Chat Icon Button for Regular Sidebar -->
    <NcButton
      v-else
      type="text"
      full-width
      size="xsmall"
      class="w-full !h-7 !rounded-md !pl-3 !pr-2"
      data-testid="nc-sidebar-chat-support"
      :centered="false"
      :class="{
        '!text-brand-600 !bg-brand-50 !hover:bg-brand-50 active': isChatOpen,
        '!hover:(bg-gray-200 text-gray-700)': !isChatOpen,
      }"
      @click="toggleChat"
    >
      <div class="flex !w-full items-center gap-2">
        <GeneralIcon icon="messageCircle" class="!h-4" />
        <span>{{ $t('labels.chatWithNocoDBSupport') }}</span>
      </div>
    </NcButton>

    <!-- Chat Interface -->
    <div
      v-if="isChatOpen"
      class="nc-chat-interface fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 z-1000 flex items-center justify-center"
      @click="closeChat"
    >
      <div
        class="nc-chat-modal bg-white rounded-lg shadow-xl w-11/12 h-5/6 max-w-4xl max-h-4xl flex flex-col"
        @click.stop
      >
        <!-- Chat Header -->
        <div class="nc-chat-header flex items-center justify-between p-4 border-b border-gray-200">
          <div class="flex items-center gap-2">
            <GeneralIcon icon="messageCircle" class="h-5 w-5 text-blue-600" />
            <h3 class="text-lg font-semibold text-gray-900">AI Assistant</h3>
          </div>
          <button
            class="nc-chat-close text-gray-400 hover:text-gray-600 transition-colors"
            @click="closeChat"
          >
            <GeneralIcon icon="close" class="h-5 w-5" />
          </button>
        </div>

        <!-- Chat Content -->
        <div class="nc-chat-content flex-1 p-4 overflow-hidden">
          <!-- Iframe for Vercel AI Chatbot -->
          <iframe
            v-if="chatbotUrl"
            :src="chatbotUrl"
            class="w-full h-full border-0 rounded"
            title="AI Chatbot"
            allow="microphone; camera"
          ></iframe>
          
          <!-- Fallback Content -->
          <div v-else class="nc-chat-fallback flex items-center justify-center h-full text-gray-500">
            <div class="text-center">
              <GeneralIcon icon="messageCircle" class="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p class="text-lg">AI Chatbot Loading...</p>
              <p class="text-sm mt-2">Please ensure the chatbot service is running</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
const isMiniSidebar = inject(IsMiniSidebarInj, undefined)
const isChatOpen = ref(false)
const chatbotUrl = ref('')

// Helper function to safely convert Proxy objects to plain objects
const safeClone = (obj) => {
  try {
    return JSON.parse(JSON.stringify(obj))
  } catch (error) {
    console.warn('JSON clone failed, using manual extraction:', error.message)
    if (obj && typeof obj === 'object') {
      const plain = {}
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          try {
            plain[key] = obj[key]
          } catch (e) {
            plain[key] = null
          }
        }
      }
      return plain
    }
    return obj
  }
}

const toggleChat = async () => {
  if (!isChatOpen.value) {
    // Generate chatbot URL with JWT token when opening
    try {
      const { user, token } = useGlobal()
      const userValue = user.value
      const tokenValue = token.value
      
      if (userValue && tokenValue) {
        const userInfo = {
          id: userValue.id,
          email: userValue.email,
          display_name: userValue.display_name,
          roles: safeClone(userValue.roles) || {}
        }
        
        // Create URL with JWT token and user info
        const url = new URL('http://localhost:3001')
        url.searchParams.set('jwt', tokenValue)
        url.searchParams.set('user', JSON.stringify(userInfo))
        url.searchParams.set('nocodb-sso', 'true')
        
        chatbotUrl.value = url.toString()
      } else {
        throw new Error('User not authenticated')
      }
    } catch (error) {
      console.error('Failed to generate chatbot URL:', error)
      alert('Please log in to NocoDB first')
      return
    }
  }
  
  isChatOpen.value = !isChatOpen.value
}

const closeChat = () => {
  isChatOpen.value = false
  chatbotUrl.value = '' // Clear URL when closing
}

// Close chat when pressing Escape key
useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isChatOpen.value) {
    closeChat()
  }
})
</script>

<style lang="scss" scoped>
.nc-chat-support {
  position: relative;
}

.nc-chat-btn {
  &:hover {
    background-color: var(--color-grey-200);
  }
}

.nc-chat-interface {
  animation: fadeIn 0.2s ease-out;
}

.nc-chat-modal {
  animation: slideIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
