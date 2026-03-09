import { Routes } from '@angular/router';
import { ClubLayoutComponent } from './components/layout/club-layout.component';

export const CLUB_ROUTES: Routes = [
  {
    path: '',
    component: ClubLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./components/club-dashboard/club-dashboard.component').then(
            (m) => m.ClubDashboardComponent
          ),
        title: 'Dashboard Club'
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./components/club-profile/club-profile.component').then(
            (m) => m.ClubProfileComponent
          ),
        title: 'Profil / Setări Club'
      },
      {
        path: 'coaches',
        loadComponent: () =>
          import('./components/coaches/club-coaches.component').then(
            (m) => m.ClubCoachesComponent
          ),
        title: 'Antrenori Club'
      },
      {
        path: 'coaches/new',
        loadComponent: () =>
          import('./components/coach-form/club-coach-form.component').then(
            (m) => m.ClubCoachFormComponent
          ),
        title: 'Creează Antrenor'
      },
      {
        path: 'coaches/:id/edit',
        loadComponent: () =>
          import('./components/coach-form/club-coach-form.component').then(
            (m) => m.ClubCoachFormComponent
          ),
        title: 'Editează Antrenor'
      },
      {
        path: 'locations/new',
        loadComponent: () =>
          import('./components/location-form/club-location-form.component').then(
            (m) => m.ClubLocationFormComponent
          ),
        title: 'Creează Locație'
      },
      {
        path: 'locations/:id/edit',
        loadComponent: () =>
          import('./components/location-form/club-location-form.component').then(
            (m) => m.ClubLocationFormComponent
          ),
        title: 'Editează Locație'
      },
      {
        path: 'locations',
        loadComponent: () =>
          import('./components/locations/club-locations.component').then(
            (m) => m.ClubLocationsComponent
          ),
        title: 'Locații Club'
      },
      {
        path: 'courses/new',
        loadComponent: () =>
          import('./components/course-form/club-course-form.component').then(
            (m) => m.ClubCourseFormComponent
          ),
        title: 'Creează Curs'
      },
      {
        path: 'courses/:id/edit',
        loadComponent: () =>
          import('./components/course-form/club-course-form.component').then(
            (m) => m.ClubCourseFormComponent
          ),
        title: 'Editează Curs'
      },
      {
        path: 'courses',
        loadComponent: () =>
          import('./components/courses/club-courses.component').then(
            (m) => m.ClubCoursesComponent
          ),
        title: 'Cursuri Club'
      },
      {
        path: 'attendance-payments',
        loadComponent: () =>
          import('./components/attendance-payments/club-attendance-payments.component').then(
            (m) => m.ClubAttendancePaymentsComponent
          ),
        title: 'Prezențe & Plăți Club'
      },
      {
        path: 'announcements',
        loadComponent: () =>
          import('./components/announcements/club-announcements.component').then(
            (m) => m.ClubAnnouncementsComponent
          ),
        title: 'Anunțuri Club'
      }
    ]
  }
];
