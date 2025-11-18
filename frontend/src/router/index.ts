import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/attendee'
  },
  {
    path: '/attendee',
    name: 'Attendee',
    component: () => import('../views/AttendeeView.vue'),
    meta: {
      title: 'Order Coffee'
    }
  },
  {
    path: '/barista',
    name: 'Barista',
    component: () => import('../views/BaristaView.vue'),
    meta: {
      title: 'Barista Dashboard'
    }
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

router.beforeEach((to, _from, next) => {
  document.title = (to.meta.title as string) || 'Coffee Ordering System';
  next();
});

export default router;
