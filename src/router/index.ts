import { createRouter, createWebHashHistory } from 'vue-router'
import WelcomeLayout from '../ui/layouts/WelcomeLayout.vue'
import EditorLayout from '../ui/layouts/EditorLayout.vue'
import GlyphProgrammingEditor from '../ui/views/programming/GlyphProgrammingEditor.vue'
import CharacterProgrammingEditor from '../ui/views/programming/CharacterProgrammingEditor.vue'

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
  ],
})

router.beforeEach((to, from, next) => {
  next()
})

export default router
