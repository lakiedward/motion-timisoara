import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Server,
  },
  {
    path: 'cursuri',
    renderMode: RenderMode.Server,
  },
  {
    path: 'antrenori',
    renderMode: RenderMode.Server,
  },
  {
    path: 'tabere',
    renderMode: RenderMode.Server,
  },
  {
    path: 'despre',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'contact',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'login',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'register',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'account',
    renderMode: RenderMode.Client,
  },
  {
    path: 'account/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'stripe/onboarding/complete',
    renderMode: RenderMode.Client,
  },
  {
    path: 'stripe/onboarding/refresh',
    renderMode: RenderMode.Client,
  },
  {
    path: 'club/stripe/onboarding/complete',
    renderMode: RenderMode.Client,
  },
  {
    path: 'club/stripe/onboarding/refresh',
    renderMode: RenderMode.Client,
  },
  {
    path: 'club',
    renderMode: RenderMode.Client,
  },
  {
    path: 'club/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'coach',
    renderMode: RenderMode.Client,
  },
  {
    path: 'coach/**',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
