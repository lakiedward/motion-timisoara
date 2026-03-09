import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent } from './components/layout/admin-layout.component';
import { AdminCoachListComponent } from './components/coaches/admin-coach-list.component';
import { AdminCoachFormComponent } from './components/coach-form/admin-coach-form.component';
import { AdminCoursesComponent } from './components/courses/admin-courses.component';
import { AdminCourseFormComponent } from './components/course-form/admin-course-form.component';
import { AdminCampsComponent } from './components/camps/admin-camps.component';
import { AdminLocationsComponent } from './components/locations/admin-locations.component';
import { AdminLocationFormComponent } from './components/location-form/admin-location-form.component';
import { AdminCampFormComponent } from './components/camp-form/admin-camp-form.component';
import { AdminReportsComponent } from './components/reports/admin-reports.component';
import { AdminSettingsComponent } from './components/settings/admin-settings.component';
import { AdminScheduleComponent } from './components/schedule/admin-schedule.component';
import { AdminSportsListComponent } from './components/sports/admin-sports-list.component';
import { AdminCoursePhotosComponent } from './components/course-photos/admin-course-photos.component';
import { AdminAttendancePaymentsComponent } from './components/attendance-payments/admin-attendance-payments.component';
import { AdminPaymentsComponent } from './components/payments/admin-payments.component';
import { AdminActivitiesComponent } from './components/activities/admin-activities.component';
import { AdminActivityFormComponent } from './components/activity-form/admin-activity-form.component';
import { AdminClubsComponent } from './components/clubs/admin-clubs.component';
import { AdminClubFormComponent } from './components/club-form/admin-club-form.component';
import { AdminUsersComponent } from './components/users/admin-users.component';
import { AdminParentFormComponent } from './components/parent-form/admin-parent-form.component';

const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'coaches' },
      { path: 'coaches/new', component: AdminCoachFormComponent },
      { path: 'coaches/:id/edit', component: AdminCoachFormComponent },
      { path: 'coaches', component: AdminCoachListComponent },
      { path: 'sports', component: AdminSportsListComponent },
      { path: 'courses/new', component: AdminCourseFormComponent },
      { path: 'courses/:id/edit', component: AdminCourseFormComponent },
      { path: 'courses/:id/photos', component: AdminCoursePhotosComponent },
      { path: 'courses', component: AdminCoursesComponent },
      { path: 'camps/new', component: AdminCampFormComponent },
      { path: 'camps/:campId/edit', component: AdminCampFormComponent },
      { path: 'camps', component: AdminCampsComponent },
      { path: 'activities/new', component: AdminActivityFormComponent },
      { path: 'activities/:id/edit', component: AdminActivityFormComponent },
      { path: 'activities', component: AdminActivitiesComponent },
      { path: 'clubs', component: AdminClubsComponent },
      { path: 'clubs/:id', component: AdminClubFormComponent },
      { path: 'users', component: AdminUsersComponent },
      { path: 'users/:id/edit', component: AdminParentFormComponent },
      { path: 'locations/new', component: AdminLocationFormComponent },
      { path: 'locations/:id/edit', component: AdminLocationFormComponent },
      { path: 'locations', component: AdminLocationsComponent },
      { path: 'attendance-payments', component: AdminAttendancePaymentsComponent },
      { path: 'payments', component: AdminPaymentsComponent },
      { path: 'reports', component: AdminReportsComponent },
      { path: 'settings', component: AdminSettingsComponent },
      // Legacy route kept for backwards compatibility
      { path: 'schedule', component: AdminScheduleComponent },
      { path: '**', redirectTo: 'coaches' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule {}
