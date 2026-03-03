import { createRouter, createWebHashHistory } from 'vue-router'
import WelcomeLayout from '../ui/layouts/WelcomeLayout.vue'
import EditorLayout from '../ui/layouts/EditorLayout.vue'

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
  ],
})

router.beforeEach((to, from, next) => {
  next()
})

export default router
