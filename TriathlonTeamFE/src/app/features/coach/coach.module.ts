import { NgModule } from '@angular/core';
import { CoachRoutingModule } from './coach-routing.module';
import { CoachLayoutComponent } from './components/layout/coach-layout.component';
import { CoachCoursesComponent } from './components/courses/coach-courses.component';
import { CoachAttendancePaymentsComponent } from './components/attendance-payments/coach-attendance-payments.component';
import { CourseFormComponent } from './components/course-form/course-form.component';
import { CoachCourseWrapperComponent } from './components/course-wrapper/coach-course-wrapper.component';
import { CoachLocationsComponent } from './components/locations/coach-locations.component';
import { CoachLocationFormComponent } from './components/location-form/coach-location-form.component';

@NgModule({
  imports: [
    CoachRoutingModule,
    CoachLayoutComponent,
    CoachCoursesComponent,
    CoachLocationFormComponent,
    CoachLocationsComponent,
    CoachAttendancePaymentsComponent,
    CourseFormComponent,
    CoachCourseWrapperComponent
  ]
})
export class CoachModule {}
