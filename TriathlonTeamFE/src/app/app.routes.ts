import { Routes } from '@angular/router';
import { CoreLayoutComponent } from './core/components/core-layout/core-layout.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    component: CoreLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/static/home/home-page.component').then((m) => m.HomePageComponent)
      },
      {
        path: 'cursuri',
        loadComponent: () =>
          import('./features/program/program/program.component').then((m) => m.ProgramComponent)
      },
      {
        path: 'cursuri/:id',
        loadComponent: () =>
          import('./features/program/course-details/course-details.component').then(
            (m) => m.CourseDetailsComponent
          )
      },
      {
        path: 'harta',
        loadComponent: () =>
          import('./features/program/map-page/map-page.component').then((m) => m.MapPageComponent)
      },
      {
        path: 'antrenori',
        loadComponent: () =>
          import('./features/coaches/components/coaches-list/coaches-list.component').then(
            (m) => m.CoachesListComponent
          )
      },
      {
        path: 'cluburi',
        loadComponent: () =>
          import('./features/clubs/components/clubs-list/clubs-list.component').then(
            (m) => m.ClubsListComponent
          )
      },
      {
        path: 'cluburi/:id',
        loadComponent: () =>
          import('./features/clubs/components/club-details/club-details.component').then(
            (m) => m.ClubDetailsComponent
          )
      },
      {
        path: 'antrenori/:id',
        loadComponent: () =>
          import('./features/coaches/components/coach-profile/coach-profile.component').then(
            (m) => m.CoachProfileComponent
          )
      },
      {
        path: 'tabere',
        loadComponent: () =>
          import('./features/camps/list/camps.component').then((m) => m.CampsComponent)
      },
      {
        path: 'tabere/:slug',
        loadComponent: () =>
          import('./features/camps/detail/camp-details.component').then((m) => m.CampDetailsComponent)
      },
      {
        path: 'activitati',
        loadComponent: () =>
          import('./features/activities/activities-page/activities-page.component').then((m) => m.ActivitiesPageComponent)
      },
      {
        path: 'activitati/:id',
        loadComponent: () =>
          import('./features/activities/activity-detail/activity-detail.component').then((m) => m.ActivityDetailComponent)
      },
      {
        path: 'despre',
        loadComponent: () =>
          import('./features/static/about/about-page.component').then((m) => m.AboutPageComponent)
      },
      {
        path: 'contact',
        loadComponent: () =>
          import('./features/static/contact/contact-page.component').then((m) => m.ContactPageComponent)
      },
      {
        path: 'account',
        canActivate: [authGuard, roleGuard],
        data: { roles: ['PARENT', 'COACH', 'ADMIN'] },
        loadChildren: () => import('./features/account/account.module').then((m) => m.AccountModule)
      }
    ]
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'signup',
    loadComponent: () =>
      import('./features/auth/signup-choice/signup-choice.component').then((m) => m.SignupChoiceComponent)
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent)
  },
  {
    path: 'register-coach',
    loadComponent: () =>
      import('./features/auth/coach-signup/coach-signup.component').then((m) => m.CoachSignupComponent)
  },
  {
    path: 'register-club',
    loadComponent: () =>
      import('./features/auth/club-signup/club-signup.component').then((m) => m.ClubSignupComponent)
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent
      )
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent
      )
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/auth/oauth-callback/oauth-callback.component').then(
        (m) => m.OAuthCallbackComponent
      )
  },
  // Stripe onboarding routes - NO AUTH REQUIRED (user comes from Stripe redirect)
  {
    path: 'stripe/onboarding/complete',
    loadComponent: () =>
      import('./features/coach/stripe-onboarding/stripe-onboarding-complete.component').then(
        (m) => m.StripeOnboardingCompleteComponent
      )
  },
  {
    path: 'stripe/onboarding/refresh',
    loadComponent: () =>
      import('./features/coach/stripe-onboarding/stripe-onboarding-refresh.component').then(
        (m) => m.StripeOnboardingRefreshComponent
      )
  },
  // Club Stripe onboarding routes - NO AUTH REQUIRED (user comes from Stripe redirect)
  {
    path: 'club/stripe/onboarding/complete',
    loadComponent: () =>
      import('./features/club/stripe-onboarding/club-stripe-onboarding-complete.component').then(
        (m) => m.ClubStripeOnboardingCompleteComponent
      )
  },
  {
    path: 'club/stripe/onboarding/refresh',
    loadComponent: () =>
      import('./features/club/stripe-onboarding/club-stripe-onboarding-refresh.component').then(
        (m) => m.ClubStripeOnboardingRefreshComponent
      )
  },
  {
    path: 'club',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['CLUB'] },
    loadChildren: () => import('./features/club/club.routes').then((m) => m.CLUB_ROUTES)
  },
  {
    path: 'coach',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['COACH', 'ADMIN'] },
    loadChildren: () => import('./features/coach/coach.module').then((m) => m.CoachModule)
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
    loadChildren: () => import('./features/admin/admin.module').then((m) => m.AdminModule)
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent)
  }
];
