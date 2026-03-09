import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent } from './components/layout/admin-layout.component';
import { AdminCoachListComponent } from './components/coaches/admin-coach-list.component';
import { AdminCoursesComponent } from './components/courses/admin-courses.component';
import { AdminCourseFormComponent } from './components/course-form/admin-course-form.component';
import { AdminCampsComponent } from './components/camps/admin-camps.component';
import { AdminCampFormComponent } from './components/camp-form/admin-camp-form.component';
import { AdminEnrollmentsComponent } from './components/enrollments/admin-enrollments.component';
import { AdminReportsComponent } from './components/reports/admin-reports.component';
import { AdminSettingsComponent } from './components/settings/admin-settings.component';
import { AdminScheduleComponent } from './components/schedule/admin-schedule.component';

const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'coaches' },
      { path: 'coaches', component: AdminCoachListComponent },
      { path: 'courses/:id/edit', component: AdminCourseFormComponent },
      { path: 'courses', component: AdminCoursesComponent },
      { path: 'camps/new', component: AdminCampFormComponent },
      { path: 'camps/:campId/edit', component: AdminCampFormComponent },
      { path: 'camps', component: AdminCampsComponent },
      { path: 'enrollments', component: AdminEnrollmentsComponent },
      { path: 'payments', redirectTo: 'enrollments' },
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
