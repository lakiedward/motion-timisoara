import { NgModule } from '@angular/core';
import { AccountRoutingModule } from './account-routing.module';
import { ParentDashboardComponent } from './components/dashboard/parent-dashboard.component';
import { ChildProfileComponent } from './components/child-profile/child-profile.component';
import { ChildrenComponent } from './components/children/children.component';
import { ChildFormComponent } from './components/child-form/child-form.component';
import { CheckoutComponent } from './components/checkout/checkout.component';
import { AttendanceHistoryComponent } from './components/attendance-history/attendance-history.component';
import { EnrollmentsComponent } from './components/enrollments/enrollments.component';
import { CalendarComponent } from './components/calendar/calendar.component';

@NgModule({
  imports: [
    AccountRoutingModule,
    ParentDashboardComponent,
    ChildProfileComponent,
    ChildrenComponent,
    ChildFormComponent,
    AttendanceHistoryComponent,
    EnrollmentsComponent,
    CheckoutComponent,
    CalendarComponent
  ],
})
export class AccountModule {}
