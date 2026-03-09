import { NgModule } from '@angular/core';
import { AdminRoutingModule } from './admin-routing.module';
import { AdminLayoutComponent } from './components/layout/admin-layout.component';
import { AdminCoachListComponent } from './components/coaches/admin-coach-list.component';
import { AddCoachDialogComponent } from './components/coaches/add-coach-dialog.component';
import { AdminCoursesComponent } from './components/courses/admin-courses.component';
import { AdminCourseFormComponent } from './components/course-form/admin-course-form.component';
import { AdminCourseDialogComponent } from './components/courses/dialog/admin-course-dialog.component';
import { AdminCampsComponent } from './components/camps/admin-camps.component';
import { AdminCampFormComponent } from './components/camp-form/admin-camp-form.component';
import { AdminEnrollmentsComponent } from './components/enrollments/admin-enrollments.component';
import { AdminScheduleComponent } from './components/schedule/admin-schedule.component';
import { AdminReportsComponent } from './components/reports/admin-reports.component';
import { AdminSettingsComponent } from './components/settings/admin-settings.component';

@NgModule({
  imports: [
    AdminRoutingModule,
    AdminLayoutComponent,
    AdminCoachListComponent,
    AddCoachDialogComponent,
    AdminCoursesComponent,
    AdminCourseDialogComponent,
    AdminCourseFormComponent,
    AdminCampsComponent,
    AdminCampFormComponent,
    AdminEnrollmentsComponent,
    AdminScheduleComponent,
    AdminReportsComponent,
    AdminSettingsComponent,
  ],
})
export class AdminModule {}
