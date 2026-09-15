import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import { useAuth } from '../composables/useAuth';

import TabsPage from '../views/TabsPage.vue';
import HomePage from '../views/HomePage.vue';
import ProfilePage from '../views/ProfilePage.vue';
import MessagesPage from '../views/MessagesPage.vue';
import ChatPage from '../views/ChatPage.vue';
import AuthPage from '../views/AuthPage.vue';
import PostDetailsPage from '../views/PostDetailsPage.vue';
import PublicProfilePage from '../views/PublicProfilePage.vue';
import EditProfilePage from '../views/EditProfilePage.vue';
import EditPostPage from '../views/EditPostPage.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/tabs/home'
  },
  {
    path: '/auth',
    name: 'Auth',
    component: AuthPage
  },
  {
    path: '/onboarding',
    name: 'Onboarding',
    component: AuthPage
  },
  {
    path: '/tabs',
    component: TabsPage,
    children: [
      {
        path: '',
        redirect: '/tabs/home'
      },
      {
        path: 'home',
        name: 'Home',
        component: HomePage
      },
      {
        path: 'messages',
        name: 'Messages',
        component: MessagesPage
      },
      {
        path: 'profile',
        name: 'Profile',
        component: ProfilePage
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
    component: ChatPage
  },
  {
    path: '/post/:id',
    name: 'PostDetails',
    component: PostDetailsPage
  },
  {
    path: '/profile/:uid',
    name: 'PublicProfile',
    component: PublicProfilePage
  },
  {
    path: '/edit-profile',
    name: 'EditProfile',
    component: EditProfilePage
  },
  {
    path: '/edit-post/:id',
    name: 'EditPost',
    component: EditPostPage
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
