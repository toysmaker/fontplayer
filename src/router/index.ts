import { createRouter, createWebHashHistory } from 'vue-router'
import WelcomeLayout from '../ui/layouts/WelcomeLayout.vue'
import EditorLayout from '../ui/layouts/EditorLayout.vue'
import GlyphProgrammingEditor from '../ui/views/programming/GlyphProgrammingEditor.vue'
import CharacterProgrammingEditor from '../ui/views/programming/CharacterProgrammingEditor.vue'
import TypesettingPreviewPage from '../ui/views/typesetting/TypesettingPreviewPage.vue'
import ApplicationListPage from '../ui/views/applications/ApplicationListPage.vue'
import CardAppEditorPage from '../ui/views/applications/CardAppEditorPage.vue'
import LogoAppEditorPage from '../ui/views/applications/LogoAppEditorPage.vue'
import AvatarAppEditorPage from '../ui/views/applications/AvatarAppEditorPage.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'welcome',
      component: WelcomeLayout,
    },
    {
      path: '/editor',
      name: 'editor',
      component: EditorLayout,
    },
    {
      path: '/glyph-programming-editor',
      name: 'glyph-programming-editor',
      component: GlyphProgrammingEditor,
    },
    {
      path: '/character-programming-editor',
      name: 'character-programming-editor',
      component: CharacterProgrammingEditor,
    },
    {
      path: '/typesetting-preview',
      name: 'typesetting-preview',
      component: TypesettingPreviewPage,
    },
    {
      path: '/applications/card',
      name: 'application-card-list',
      component: ApplicationListPage,
      props: { type: 'card' },
    },
    {
      path: '/applications/card/editor/:appId?',
      name: 'application-card-editor',
      component: CardAppEditorPage,
    },
    {
      path: '/applications/logo',
      name: 'application-logo-list',
      component: ApplicationListPage,
      props: { type: 'logo' },
    },
    {
      path: '/applications/logo/editor/:appId?',
      name: 'application-logo-editor',
      component: LogoAppEditorPage,
    },
    {
      path: '/applications/avatar',
      name: 'application-avatar-list',
      component: ApplicationListPage,
      props: { type: 'avatar' },
    },
    {
      path: '/applications/avatar/editor/:appId?',
      name: 'application-avatar-editor',
      component: AvatarAppEditorPage,
    },
  ],
})

router.beforeEach((to, from, next) => {
  next()
})

export default router
