import { NgModule } from '@angular/core';
import { AdminRoutingModule } from './admin-routing.module';
import { AdminLayoutComponent } from './components/layout/admin-layout.component';
import { AdminCoachListComponent } from './components/coaches/admin-coach-list.component';
import { AdminCoachFormComponent } from './components/coach-form/admin-coach-form.component';
import { AdminCoursesComponent } from './components/courses/admin-courses.component';
import { AdminCourseFormComponent } from './components/course-form/admin-course-form.component';
import { AdminCourseDialogComponent } from './components/courses/dialog/admin-course-dialog.component';
import { AdminCampsComponent } from './components/camps/admin-camps.component';
import { AdminCampFormComponent } from './components/camp-form/admin-camp-form.component';
import { AdminScheduleComponent } from './components/schedule/admin-schedule.component';
import { AdminReportsComponent } from './components/reports/admin-reports.component';
import { AdminSettingsComponent } from './components/settings/admin-settings.component';
import { AdminLocationsComponent } from './components/locations/admin-locations.component';
import { AdminLocationDialogComponent } from './components/locations/dialog/admin-location-dialog.component';
import { AdminPaymentsComponent } from './components/payments/admin-payments.component';
import { AdminClubsComponent } from './components/clubs/admin-clubs.component';
import { AdminUsersComponent } from './components/users/admin-users.component';

@NgModule({
  imports: [
    AdminRoutingModule,
    AdminLayoutComponent,
    AdminCoachListComponent,
    AdminCoachFormComponent,
    AdminCoursesComponent,
    AdminCourseDialogComponent,
    AdminCourseFormComponent,
    AdminCampsComponent,
    AdminCampFormComponent,
    AdminLocationsComponent,
    AdminLocationDialogComponent,
    AdminPaymentsComponent,
    AdminScheduleComponent,
    AdminReportsComponent,
    AdminSettingsComponent,
    AdminClubsComponent,
    AdminUsersComponent,
  ],
})
export class AdminModule {}
