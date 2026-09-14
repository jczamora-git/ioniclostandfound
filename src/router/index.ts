import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import { useAuth } from '../composables/useAuth';

import TabsPage from '../views/TabsPage.vue';
import HomePage from '../views/HomePage.vue';
import ProfilePage from '../views/ProfilePage.vue';
import MessagesPage from '../views/MessagesPage.vue';
import ChatPage from '../views/ChatPage.vue';
import OnboardingPage from '../views/OnboardingPage.vue';
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
    path: '/onboarding',
    name: 'Onboarding',
    component: OnboardingPage
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
  const { initAuth, hasProfile } = useAuth();
  
  // Await anonymous sign-in and profile fetch
  await initAuth();

  if (!hasProfile.value && to.path !== '/onboarding') {
    next('/onboarding');
  } else if (hasProfile.value && to.path === '/onboarding') {
    next('/tabs/home');
  } else {
    next();
  }
});

export default router;
