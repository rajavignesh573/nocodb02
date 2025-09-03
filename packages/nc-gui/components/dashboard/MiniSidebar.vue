<script lang="ts" setup>
provide(IsMiniSidebarInj, ref(true))

const router = useRouter()

const route = router.currentRoute

const { appInfo, navigateToProject, isMobileMode } = useGlobal()

const { meta: metaKey, control } = useMagicKeys()

const workspaceStore = useWorkspace()

const { activeWorkspaceId, isWorkspaceSettingsPageOpened, isIntegrationsPageOpened, isWorkspacesLoading } =
  storeToRefs(workspaceStore)

const { isChatPageOpened, isProductPageOpened, isProductMatcherPageOpened } = storeToRefs(workspaceStore)

const { navigateToWorkspaceSettings, navigateToIntegrations: _navigateToIntegrations, navigateToProductMatcher } = workspaceStore

const { basesList, showProjectList } = storeToRefs(useBases())

const { isSharedBase } = storeToRefs(useBase())

const { isUIAllowed } = useRoles()

const { setActiveCmdView } = useCommand()

// Add sidebar control
const { toggleHasSidebar } = useSidebar('nc-left-sidebar')

const isProjectListOrHomePageOpen = computed(() => {
  return (
    route.value.name?.startsWith('index-typeOrId-baseId-') ||
    route.value.name === 'index' ||
    route.value.name === 'index-typeOrId'
  )
})

const isProjectPageOpen = computed(() => {
  return (
    (route.value.name?.startsWith('index-typeOrId-baseId-') ||
      route.value.name === 'index' ||
      route.value.name === 'index-typeOrId') &&
    showProjectList.value
  )
})

const navigateToProjectPage = () => {
  // Close chatbot if open before navigating
  closeChatbot()
  
  if (route.value.name?.startsWith('index-typeOrId-baseId-')) {
    showProjectList.value = !showProjectList.value

    return
  }

  navigateToProject({ workspaceId: isEeUI ? activeWorkspaceId.value : undefined, baseId: basesList.value?.[0]?.id })
}

const navigateToSettings = () => {
  // Close chatbot if open before navigating
  closeChatbot()
  
  const cmdOrCtrl = isMac() ? metaKey.value : control.value
  cmdOrCtrl ? navigateToWorkspaceSettings('', cmdOrCtrl) : navigateToWorkspaceSettings()
}

const navigateToIntegrations = () => {
  // Close chatbot if open before navigating
  closeChatbot()
  
  const cmdOrCtrl = isMac() ? metaKey.value : control.value
  cmdOrCtrl ? _navigateToIntegrations('', cmdOrCtrl) : _navigateToIntegrations()
}

const handleProductMatcherClick = () => {
  // Close chatbot if open before navigating
  closeChatbot()
  
  const cmdOrCtrl = isMac() ? metaKey.value : control.value
  navigateToProductMatcher('', cmdOrCtrl)
}

// Helper function to safely convert Proxy objects to plain objects
const safeClone = (obj) => {
  try {
    // Try JSON serialization/deserialization first
    return JSON.parse(JSON.stringify(obj))
  } catch (error) {
    console.warn('JSON clone failed, using manual extraction:', error.message)
    // Fallback: manual extraction of known properties
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

// Track the chatbot modal for cleanup
let currentChatbotModal = null

const closeChatbot = () => {
  if (currentChatbotModal) {
    toggleHasSidebar(true)
    document.body.removeChild(currentChatbotModal)
    currentChatbotModal = null
  }
}

const openAIChatbot = () => {
  // Close any existing chatbot first
  closeChatbot()
  
  // Hide the main sidebar when opening the chat
  toggleHasSidebar(false)
  
  // Get current user info and token directly
  let userInfo = null
  let authToken = null
  
  try {
    const { user, token } = useGlobal()
    const userValue = user.value
    const tokenValue = token.value
    
    if (userValue && tokenValue) {
      userInfo = {
        id: userValue.id,
        email: userValue.email,
        display_name: userValue.display_name,
        roles: safeClone(userValue.roles) || {}
      }
      authToken = tokenValue
    } else {
      throw new Error('User not authenticated')
    }
  } catch (error) {
    alert('Please log in to NocoDB first')
    toggleHasSidebar(true)
    return
  }
  
  // Create URL with JWT token and user info
  const chatbotUrl = new URL('http://localhost:3001')
  chatbotUrl.searchParams.set('jwt', authToken)
  chatbotUrl.searchParams.set('user', JSON.stringify(userInfo))
  chatbotUrl.searchParams.set('nocodb-sso', 'true')
  
  // Create a simple modal container
  const modal = document.createElement('div')
  modal.style.position = 'fixed'
  modal.style.top = '0'
  modal.style.left = '48px'  // Start exactly where mini sidebar ends (3rem = 48px)
  modal.style.right = '0'
  modal.style.bottom = '0'
  modal.style.backgroundColor = 'white'
  modal.style.zIndex = '999999'
  modal.style.display = 'flex'
  modal.style.flexDirection = 'column'
  
  // Store reference to current modal
  currentChatbotModal = modal
  
  // Create a close button
  const closeButton = document.createElement('button')
  closeButton.innerHTML = '✕'
  closeButton.style.position = 'absolute'
  closeButton.style.top = '10px'
  closeButton.style.right = '10px'
  closeButton.style.zIndex = '1000000'
  closeButton.style.background = 'white'
  closeButton.style.border = '1px solid #ccc'
  closeButton.style.borderRadius = '50%'
  closeButton.style.width = '30px'
  closeButton.style.height = '30px'
  closeButton.style.cursor = 'pointer'
  closeButton.style.fontSize = '16px'
  closeButton.style.display = 'flex'
  closeButton.style.alignItems = 'center'
  closeButton.style.justifyContent = 'center'
  
  closeButton.onclick = () => {
    closeChatbot()
  }
  
  // Create the iframe - load AI chatbot directly
  const iframe = document.createElement('iframe')
  iframe.src = chatbotUrl.toString()
  iframe.style.width = '100%'
  iframe.style.height = '100%'
  iframe.style.border = 'none'
  iframe.style.flex = '1'
  
  // The iframe now starts exactly where the mini sidebar ends (48px from left)
  // This creates a seamless connection with no gaps
  
  // Add elements to modal
  modal.appendChild(closeButton)
  modal.appendChild(iframe)
  
  // Add modal to body
  document.body.appendChild(modal)
  
  // Handle modal click to close
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeChatbot()
    }
  }
}

  // Watch for route changes to close chatbot when navigating to other pages
  watch(() => router.currentRoute.value.fullPath, () => {
    closeChatbot()
  })



useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const isBaseSearchInput = e.target instanceof HTMLInputElement && e.target.closest('.nc-base-search-input')

  if (
    !e.altKey ||
    (!isBaseSearchInput &&
      (isActiveInputElementExist(e) ||
        cmdKActive() ||
        isCmdJActive() ||
        isNcDropdownOpen() ||
        isActiveElementInsideExtension() ||
        isDrawerOrModalExist() ||
        isExpandedFormOpenExist()))
  ) {
    return
  }

  switch (e.code) {
    case 'KeyB': {
      e.preventDefault()
      navigateToProjectPage()
      break
    }
  }
})
</script>

<template>
  <div class="nc-mini-sidebar" data-testid="nc-mini-sidebar">
    <div class="flex flex-col items-center">
      <DashboardMiniSidebarItemWrapper size="small">
        <div
          class="min-h-9 sticky top-0 bg-[var(--mini-sidebar-bg-color)]"
          :class="{
            'pt-1.5 pb-2.5': isMobileMode,
          }"
        >
          <GeneralLoader v-if="isWorkspacesLoading" size="large" />
          <WorkspaceMenu v-else />
        </div>
      </DashboardMiniSidebarItemWrapper>

      <DashboardMiniSidebarItemWrapper>
        <NcTooltip placement="right" hide-on-click :arrow="false">
          <template #title>
            <div class="flex gap-1.5">
              {{ $t('labels.baseList') }}
              <div class="px-1 text-bodySmBold text-white bg-gray-700 rounded">{{ renderAltOrOptlKey(true) }} B</div>
            </div>
          </template>
          <div class="nc-mini-sidebar-btn-full-width" data-testid="nc-sidebar-project-btn" @click="navigateToProjectPage">
            <div
              class="nc-mini-sidebar-btn"
              :class="{
                'active': isProjectPageOpen,
                'active-base': isProjectListOrHomePageOpen,
              }"
            >
              <GeneralIcon icon="ncBaseOutline" class="h-4 w-4" />
            </div>
          </div>
        </NcTooltip>
      </DashboardMiniSidebarItemWrapper>
      <div class="px-2 w-full">
        <NcDivider class="!border-nc-border-gray-dark !my-1" />
      </div>

      <template v-if="!isMobileMode">
        <DashboardMiniSidebarItemWrapper>
          <NcTooltip placement="right" hide-on-click :arrow="false">
            <template #title>
              <div class="flex items-center gap-1">{{ $t('labels.quickSearch') }} {{ renderCmdOrCtrlKey(true) }} K</div>
            </template>
            <div
              v-e="['c:quick-actions']"
              class="nc-mini-sidebar-btn-full-width"
              data-testid="nc-sidebar-cmd-k-btn"
              @click="setActiveCmdView('cmd-k')"
            >
              <div class="nc-mini-sidebar-btn">
                <GeneralIcon icon="search" class="h-4 w-4" />
              </div>
            </div>
          </NcTooltip>
        </DashboardMiniSidebarItemWrapper>
        <DashboardMiniSidebarItemWrapper>
          <NcTooltip placement="right" hide-on-click :arrow="false">
            <template #title>
              <div class="flex items-center gap-1">{{ $t('labels.recentViews') }} {{ renderCmdOrCtrlKey(true) }} L</div>
            </template>
            <div
              v-e="['c:quick-actions']"
              class="nc-mini-sidebar-btn-full-width"
              data-testid="nc-sidebar-cmd-l-btn"
              @click="setActiveCmdView('cmd-l')"
            >
              <div class="nc-mini-sidebar-btn">
                <MdiClockOutline class="h-4 w-4" />
              </div>
            </div>
          </NcTooltip>
        </DashboardMiniSidebarItemWrapper>
        <DashboardMiniSidebarItemWrapper>
          <NcTooltip placement="right" hide-on-click :arrow="false">
            <template #title>
              <div class="flex items-center gap-1">{{ $t('labels.searchDocumentation') }} {{ renderCmdOrCtrlKey(true) }} J</div>
            </template>
            <div
              v-e="['c:quick-actions']"
              class="nc-mini-sidebar-btn-full-width"
              data-testid="nc-sidebar-cmd-j-btn"
              @click="setActiveCmdView('cmd-j')"
            >
              <div class="nc-mini-sidebar-btn">
                <GeneralIcon icon="ncFile" class="h-4 w-4" />
              </div>
            </div>
          </NcTooltip>
        </DashboardMiniSidebarItemWrapper>
        <div v-if="isUIAllowed('workspaceSettings')" class="px-2 my-2 w-full">
          <NcDivider class="!my-0 !border-nc-border-gray-dark" />
        </div>
        <DashboardMiniSidebarItemWrapper v-if="isUIAllowed('workspaceSettings') || isUIAllowed('workspaceCollaborators')">
          <NcTooltip
            :title="isEeUI ? `${$t('objects.workspace')} ${$t('labels.settings')}` : $t('title.teamAndSettings')"
            placement="right"
            hide-on-click
            :arrow="false"
          >
            <div
              v-e="['c:team:settings']"
              class="nc-mini-sidebar-btn-full-width"
              data-testid="nc-sidebar-team-settings-btn"
              @click="navigateToSettings"
            >
              <div
                class="nc-mini-sidebar-btn"
                :class="{
                  active: isWorkspaceSettingsPageOpened,
                }"
              >
                <GeneralIcon icon="ncSettings" class="h-4 w-4" />
              </div>
            </div>
          </NcTooltip>
        </DashboardMiniSidebarItemWrapper>
        <DashboardMiniSidebarItemWrapper v-if="isUIAllowed('workspaceIntegrations')">
          <NcTooltip
            :title="isEeUI ? `${$t('objects.workspace')} ${$t('general.integrations')}` : $t('general.integrations')"
            placement="right"
            hide-on-click
            :arrow="false"
          >
            <div
              v-e="['c:integrations']"
              class="nc-mini-sidebar-btn-full-width"
              data-testid="nc-sidebar-integrations-btn"
              @click="navigateToIntegrations"
            >
              <div
                class="nc-mini-sidebar-btn"
                :class="{
                  active: isIntegrationsPageOpened,
                }"
              >
                <GeneralIcon icon="integration" class="h-4 w-4" />
              </div>
            </div>
          </NcTooltip>
        </DashboardMiniSidebarItemWrapper>

        <div class="px-2 w-full">
          <NcDivider class="!my-0 !border-nc-border-gray-dark !my-2" />
        </div>
        <DashboardMiniSidebarItemWrapper>
          <NcTooltip :title="$t('labels.myNotifications')" placement="right" hide-on-click :arrow="false">
            <NotificationMenu />
          </NcTooltip>
        </DashboardMiniSidebarItemWrapper>
      </template>
    </div>
    <div class="flex flex-col items-center">
      <DashboardMiniSidebarItemWrapper>
        <NcTooltip :title="$t('general.help')" placement="right" hide-on-click :arrow="false">
          <DashboardMiniSidebarHelp />
        </NcTooltip>
      </DashboardMiniSidebarItemWrapper>
      <template v-if="!isMobileMode">
        <DashboardMiniSidebarItemWrapper>
          <NcTooltip
            v-if="appInfo.feedEnabled"
            :title="`${$t('title.whatsNew')}!`"
            placement="right"
            hide-on-click
            :arrow="false"
          >
            <DashboardSidebarFeed />
          </NcTooltip>
        </DashboardMiniSidebarItemWrapper>
        <DashboardMiniSidebarItemWrapper>
          <NcTooltip :title="`${$t('labels.chatWithNocoDBSupport')}!`" placement="right" hide-on-click :arrow="false">
            <DashboardSidebarChatSupport />
          </NcTooltip>
        </DashboardMiniSidebarItemWrapper>
        
        <!-- AI Chatbot Icon -->
        <DashboardMiniSidebarItemWrapper>
          <NcTooltip :title="`Vercel`" placement="right" hide-on-click :arrow="false">
            <div
              class="nc-mini-sidebar-btn-full-width"
              data-testid="nc-sidebar-ai-chatbot-btn"
              @click="openAIChatbot"
            >
              <div class="nc-mini-sidebar-btn">
                <img src="~/assets/nc-icons/vercel.svg" class="h-4 w-4" alt="Vercel" />
              </div>
            </div>
          </NcTooltip>
        </DashboardMiniSidebarItemWrapper>
        
        <!-- Product Matcher Icon -->
        <DashboardMiniSidebarItemWrapper>
          <NcTooltip
            title="Product Matcher"
            placement="right"
            hide-on-click
            :arrow="false"
          >
            <div
              class="nc-mini-sidebar-btn-full-width"
              data-testid="nc-sidebar-product-matcher-btn"
              @click="handleProductMatcherClick"
            >
              <div
                class="nc-mini-sidebar-btn"
                :class="{
                  active: isProductMatcherPageOpened,
                }"
              >
                <GeneralIcon icon="search" class="h-4 w-4" />
              </div>
            </div>
          </NcTooltip>
        </DashboardMiniSidebarItemWrapper>
        
        <div class="px-2 w-full">
          <NcDivider class="!my-2 !border-nc-border-gray-dark" />
        </div>
        <DashboardMiniSidebarItemWrapper>
          <NcTooltip v-if="!isSharedBase" :title="$t('labels.createNew')" placement="right" hide-on-click :arrow="false">
            <DashboardMiniSidebarCreateNewActionMenu />
          </NcTooltip>
        </DashboardMiniSidebarItemWrapper>
      </template>
      <div v-else class="px-2 w-full">
        <NcDivider class="!my-2 !border-nc-border-gray-dark" />
      </div>

      <DashboardSidebarUserInfo />
    </div>
  </div>
</template>

<style lang="scss">
.nc-mini-sidebar {
  --mini-sidebar-bg-color: var(--color-grey-100);

  @apply w-[var(--mini-sidebar-width)] flex-none bg-[var(--mini-sidebar-bg-color)] flex flex-col justify-between items-center border-r-1 border-nc-border-gray-medium z-502 nc-scrollbar-thin relative;

  .nc-mini-sidebar-ws-item {
    @apply cursor-pointer h-9 w-8 rounded py-1 flex items-center justify-center children:flex-none text-nc-content-gray-muted transition-all duration-200;

    .nc-workspace-avatar {
      img {
        @apply !cursor-pointer;
      }
    }

    &.nc-small-shadow .nc-workspace-avatar {
      box-shadow: 0px 5px 0px -2px rgba(0, 0, 0, 0.4);
    }
    &.nc-medium-shadow .nc-workspace-avatar {
      box-shadow: 0px 4px 0px -2px rgba(0, 0, 0, 0.4), 0px 7px 0px -3px rgba(0, 0, 0, 0.2);
    }
  }

  .nc-mini-sidebar-btn-full-width {
    @apply w-[var(--mini-sidebar-width)] h-[var(--mini-sidebar-width)] flex-none flex justify-center items-center cursor-pointer;

    &:hover {
      .nc-mini-sidebar-btn:not(.active) {
        @apply bg-nc-bg-gray-medium;
      }
    }
  }

  .nc-mini-sidebar-btn {
    @apply cursor-pointer h-7 w-7 rounded !p-1.5 flex items-center justify-center children:flex-none !text-nc-content-gray-muted transition-all duration-200;

    &:not(.active) {
      @apply hover:bg-nc-bg-gray-medium;
    }

    &.active {
      @apply !bg-brand-100 !text-nc-content-brand;
    }

    &.active-base {
      @apply !text-nc-content-brand;
    }

    &.hovered {
      @apply bg-nc-bg-gray-medium;
    }
  }
}
</style>
