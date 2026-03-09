import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ParentDashboardComponent } from './components/dashboard/parent-dashboard.component';
import { ChildProfileComponent } from './components/child-profile/child-profile.component';
import { ChildrenComponent } from './components/children/children.component';
import { CheckoutComponent } from './components/checkout/checkout.component';
import { AttendanceHistoryComponent } from './components/attendance-history/attendance-history.component';
import { EnrollmentsComponent } from './components/enrollments/enrollments.component';
import { AccountAnnouncementsComponent } from './components/announcements/announcements.component';

const routes: Routes = [
  { path: '', component: ParentDashboardComponent },
  { path: 'children', component: ChildrenComponent },
  { path: 'child/new', component: ChildProfileComponent },
  { path: 'child/:id', component: ChildProfileComponent },
  { path: 'attendance', component: AttendanceHistoryComponent },
  { path: 'enrollments', component: EnrollmentsComponent },
  { path: 'announcements', component: AccountAnnouncementsComponent },
  { path: 'checkout', component: CheckoutComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AccountRoutingModule {}
