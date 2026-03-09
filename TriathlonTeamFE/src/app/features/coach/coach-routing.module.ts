import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CoachLayoutComponent } from './components/layout/coach-layout.component';
import { CoachDashboardComponent } from './components/dashboard/coach-dashboard.component';
import { CoachCoursesComponent } from './components/courses/coach-courses.component';
import { CoachAttendancePaymentsComponent } from './components/attendance-payments/coach-attendance-payments.component';
import { CoachCourseWrapperComponent } from './components/course-wrapper/coach-course-wrapper.component';
import { CoachCourseAnnouncementsComponent } from './components/course-announcements/coach-course-announcements.component';
import { CoachAnnouncementsGlobalComponent } from './components/announcements-global/coach-announcements-global.component';
import { CoachActivitiesComponent } from './components/activities/coach-activities.component';
import { CoachActivityFormComponent } from './components/activity-form/coach-activity-form.component';
import { CoachLocationsComponent } from './components/locations/coach-locations.component';
import { CoachLocationFormComponent } from './components/location-form/coach-location-form.component';
import { CoachMyClubsComponent } from './components/my-clubs/coach-my-clubs.component';

const routes: Routes = [
  // Stripe Onboarding Routes (standalone, outside layout)
  {
    path: 'stripe-onboarding/complete',
    loadComponent: () =>
      import('./stripe-onboarding/stripe-onboarding-complete.component').then(
        (m) => m.StripeOnboardingCompleteComponent
      )
  },
  {
    path: 'stripe-onboarding/refresh',
    loadComponent: () =>
      import('./stripe-onboarding/stripe-onboarding-refresh.component').then(
        (m) => m.StripeOnboardingRefreshComponent
      )
  },
  // Main Coach Layout Routes
  {
    path: '',
    component: CoachLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: CoachDashboardComponent },
      { path: 'my-clubs', component: CoachMyClubsComponent }, // New route for clubs management
      { path: 'courses', component: CoachCoursesComponent },
      { path: 'locations/new', component: CoachLocationFormComponent },
      { path: 'locations/:id/edit', component: CoachLocationFormComponent },
      { path: 'locations', component: CoachLocationsComponent },
      { path: 'courses/new', component: CoachCourseWrapperComponent },
      { path: 'courses/:id/edit', component: CoachCourseWrapperComponent },
      { path: 'courses/:id/announcements', component: CoachCourseAnnouncementsComponent },
      { path: 'activities', component: CoachActivitiesComponent },
      { path: 'activities/new', component: CoachActivityFormComponent },
      { path: 'activities/:id/edit', component: CoachActivityFormComponent },
      { path: 'announcements', component: CoachAnnouncementsGlobalComponent },
      { path: 'attendance-payments', component: CoachAttendancePaymentsComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CoachRoutingModule {}
