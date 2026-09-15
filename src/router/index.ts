import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/tabs/home'
  },
  {
    path: '/auth',
    name: 'Auth',
    component: () => import('../views/AuthPage.vue')
  },
  {
    path: '/onboarding',
    name: 'Onboarding',
    component: () => import('../views/AuthPage.vue')
  },
  {
    path: '/tabs',
    component: () => import('../views/TabsPage.vue'),
    children: [
      {
        path: '',
        redirect: '/tabs/home'
      },
      {
        path: 'home',
        name: 'Home',
        component: () => import('../views/HomePage.vue')
      },
      {
        path: 'messages',
        name: 'Messages',
        component: () => import('../views/MessagesPage.vue')
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('../views/ProfilePage.vue')
      }
    ]
  },
  {
    path: '/messages',
    redirect: '/tabs/messages'
  },
  {
    path: '/chat/:conversationId',
    name: 'Chat',
    component: () => import('../views/ChatPage.vue')
  },
  {
    path: '/post/:id',
    name: 'PostDetails',
    component: () => import('../views/PostDetailsPage.vue')
  },
  {
    path: '/profile/:uid',
    name: 'PublicProfile',
    component: () => import('../views/PublicProfilePage.vue')
  },
  {
    path: '/edit-profile',
    name: 'EditProfile',
    component: () => import('../views/EditProfilePage.vue')
  },
  {
    path: '/edit-post/:id',
    name: 'EditPost',
    component: () => import('../views/EditPostPage.vue')
  },
  // Legacy route redirects
  {
    path: '/items',
    redirect: '/tabs/home'
  },
  {
    path: '/home',
    redirect: '/tabs/home'
  },
  {
    path: '/activity',
    redirect: '/tabs/profile'
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

// Authentication and Onboarding navigation guard
router.beforeEach(async (to, from, next) => {
  const { initializeAuthSession, currentUser, hasProfile } = useAuth();
  
  // Await auth initialization
  await initializeAuthSession();

  const isAuthRoute = to.path === '/auth' || to.path === '/onboarding';
  const user = currentUser.value;

  if (!user) {
    // 1. No authenticated user -> redirect to Auth screen
    if (!isAuthRoute) {
      next('/auth');
    } else {
      next();
    }
  } else if (user.isAnonymous) {
    // 2. Authenticated anonymous user with unfinished account -> redirect to Create Account / Onboarding
    if (!isAuthRoute) {
      next('/auth');
    } else {
      next();
    }
  } else if (!hasProfile.value) {
    // 3. Authenticated non-anonymous user without completed profile
    if (!isAuthRoute) {
      next('/auth');
    } else {
      next();
    }
  } else {
    // 4. Authenticated non-anonymous user with full profile
    if (isAuthRoute) {
      next('/tabs/home');
    } else {
      next();
    }
  }
});

export default router;
