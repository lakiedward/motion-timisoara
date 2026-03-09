# Mobile Coach - Navigation Structure

## Overview

This document provides a visual representation of the navigation structure for the Coach section of the mobile app.

---

## Root Navigation

```
App Root
├── Auth Stack (if not authenticated)
│   ├── Login
│   ├── Register
│   └── Forgot Password
│
└── Main App (if authenticated)
    ├── Parent Tabs (if role = PARENT)
    │   └── ... (parent navigation)
    │
    └── Coach Tabs (if role = COACH) ⬅️ THIS DOCUMENT
        ├── Dashboard Tab
        ├── Sessions Tab
        ├── Courses Tab
        └── Announcements Tab
```

---

## Coach Tabs Navigator (Bottom Navigation)

```
┌────────────────────────────────────────────────────┐
│                                                    │
│              [Screen Content Here]                 │
│                                                    │
│                                                    │
└────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────┐
│ [Dashboard]  [Sesiuni]  [Cursuri]  [Anunțuri]     │
│    🏠           📅          📚          📢         │
└────────────────────────────────────────────────────┘
```

---

## 1. Dashboard Tab

### Navigation Structure
```
Dashboard Tab (Single Screen)
└── CoachDashboardScreen
    ├── Navigate to → New Course (Courses Tab)
    ├── Navigate to → All Courses (Courses Tab)
    ├── Navigate to → Mark Attendance (Sessions Tab)
    ├── Navigate to → Create Announcement (Announcements Tab)
    └── Navigate to → Course Detail (from alert)
```

### Screen Flow
```
CoachDashboardScreen
│
├─→ Tap "Adaugă Curs" ──→ CoachCourseFormScreen (Create)
├─→ Tap "Creează Anunț" ──→ CoachAnnouncementFormScreen (Create)
├─→ Tap "Marchează Prezența" ──→ CoachSessionsHomeScreen
├─→ Tap "Vezi Toate Cursurile" ──→ CoachCoursesHomeScreen
├─→ Tap on Session Card ──→ CoachSessionDetailScreen
└─→ Tap on Alert ──→ CoachCourseDetailScreen
```

### Component Hierarchy
```
CoachDashboardScreen
├── ScrollView
│   ├── HeroCard
│   │   ├── Welcome Text
│   │   ├── Stats Row
│   │   └── Today Info
│   │
│   ├── Stats Grid
│   │   ├── StatCard (Total Cursuri)
│   │   ├── StatCard (Copii Înscriși)
│   │   ├── StatCard (Sesiuni Săptămână)
│   │   └── StatCard (Rată Prezență)
│   │
│   ├── Upcoming Sessions Card
│   │   ├── Section Header
│   │   └── SessionCard[] (list)
│   │
│   └── Alerts Card
│       ├── Section Header
│       └── AlertCard[] (list)
│
└── Quick Actions FAB (Floating Action Button)
    ├── Adaugă Curs
    ├── Creează Anunț
    └── Marchează Prezență
```

---

## 2. Sessions Tab (Stack Navigator)

### Navigation Structure
```
Sessions Tab (Stack Navigator)
├── CoachSessionsHomeScreen
│   └── Navigate to → CoachSessionDetailScreen (for specific session)
│       └── Navigate to → CoachPaymentManagementScreen (add/remove sessions)
```

### Screen Flow
```
CoachSessionsHomeScreen
│
├─→ Tap on Session Card ──→ CoachSessionDetailScreen
│                           │
│                           ├─→ Mark Attendance
│                           ├─→ Save Changes
│                           └─→ Tap "Gestionează Plăți" ──→ CoachPaymentManagementScreen
│                                                            │
│                                                            ├─→ Add Sessions (Dialog)
│                                                            └─→ Remove Sessions (Dialog)
```

### CoachSessionsHomeScreen - Component Hierarchy
```
CoachSessionsHomeScreen
├── Header
│   └── WeekNavigator
│       ├── [<] Previous Week Button
│       ├── "Săptămâna 21-27 Nov 2025"
│       └── [>] Next Week Button
│
└── ScrollView
    └── Day Sections (mapped)
        ├── Day Header (e.g., "Luni, 21 Nov")
        └── SessionCard[] (sessions for that day)
            ├── Course Name
            ├── Time
            ├── Enrolled Count
            ├── [Marchează Prezența] Button
            └── [Gestionează] Button
```

### CoachSessionDetailScreen - Component Hierarchy
```
CoachSessionDetailScreen
├── Header
│   ├── Course Name
│   ├── Date & Time
│   └── Location
│
├── ScrollView
│   └── Children List
│       └── ChildAttendanceRow[] (for each enrolled child)
│           ├── Avatar
│           ├── Child Name
│           ├── Sessions Remaining
│           ├── Attendance Toggle (Present/Absent)
│           └── Quick Action (Add/Remove Sessions)
│
└── Bottom Actions Bar
    ├── [Mark All Present] Button
    ├── [Mark All Absent] Button
    └── [Save Attendance] Button (Primary)
```

### CoachPaymentManagementScreen - Component Hierarchy
```
CoachPaymentManagementScreen
├── Header
│   └── Course Selector (Dropdown)
│
├── ScrollView
│   └── Children List
│       └── ChildPaymentRow[] (for each enrolled child)
│           ├── Avatar
│           ├── Child Name
│           ├── Sessions Remaining Count
│           ├── [➕ Adaugă Sesiuni] Button
│           └── [➖ Scoate Sesiuni] Button
│
└── Dialogs (rendered conditionally)
    ├── Add Sessions Dialog
    │   ├── Number Input
    │   ├── [Anulează] Button
    │   └── [Confirmă] Button
    │
    └── Remove Sessions Dialog
        ├── Number Input
        ├── Warning Text (if going below 0)
        ├── [Anulează] Button
        └── [Confirmă] Button
```

---

## 3. Courses Tab (Stack Navigator)

### Navigation Structure
```
Courses Tab (Stack Navigator)
├── CoachCoursesHomeScreen
│   └── Navigate to → CoachCourseFormScreen (create/edit)
│       └── Navigate to → CoachCourseDetailScreen (view)
│           ├── Navigate to → CoachCourseFormScreen (edit)
│           └── Navigate to → CoachCourseAnnouncementsScreen
```

### Screen Flow
```
CoachCoursesHomeScreen
│
├─→ Tap [+ Curs Nou] ──→ CoachCourseFormScreen (mode: create)
│                        │
│                        ├─→ Fill Form
│                        ├─→ Upload Hero Image
│                        └─→ [Salvează] ──→ Navigate Back (refresh list)
│
├─→ Tap on Course Card ──→ CoachCourseDetailScreen
│   │                      │
│   │                      ├─→ Tap [Editează] ──→ CoachCourseFormScreen (mode: edit)
│   │                      ├─→ Tap [Anunțuri] ──→ CoachCourseAnnouncementsScreen
│   │                      └─→ Tap [Vezi Sesiuni] ──→ Sessions Tab (filtered)
│   │
│   ├─→ Tap [Editează] ──→ CoachCourseFormScreen (mode: edit)
│   ├─→ Tap [Anunțuri] ──→ Announcements Tab (filtered to this course)
│   └─→ Tap [Toggle Status] ──→ Toggle Active/Inactive (API call)
```

### CoachCoursesHomeScreen - Component Hierarchy
```
CoachCoursesHomeScreen
├── Header
│   ├── Title & Subtitle
│   └── [+ Curs Nou] Button
│
├── Search & Filter Bar
│   ├── Search Input
│   ├── Sport Filter (Dropdown)
│   ├── Level Filter (Dropdown)
│   └── Sort Options (Recent, Name, Enrolled)
│
└── ScrollView (or FlatList)
    └── CourseCard[] (list of courses)
        ├── Hero Image
        ├── Course Name
        ├── Sport & Level
        ├── Location
        ├── Enrolled Count
        ├── Schedule Summary
        ├── Status Badge (Active/Inactive)
        └── Action Buttons
            ├── [Editează]
            ├── [Anunțuri]
            └── [Toggle Status]
```

### CoachCourseFormScreen - Component Hierarchy
```
CoachCourseFormScreen
├── Header
│   └── Title ("Curs Nou" or "Editează Curs")
│
├── ScrollView (Form)
│   │
│   ├── Section: Informații de Bază
│   │   ├── FormTextInput (Nume Curs)
│   │   ├── FormTextArea (Descriere)
│   │   ├── FormDropdown (Sport)
│   │   ├── FormDropdown (Nivel)
│   │   ├── FormNumberInput (Vârstă Min)
│   │   ├── FormNumberInput (Vârstă Max)
│   │   └── FormToggle (Status Activ)
│   │
│   ├── Section: Locație și Organizare
│   │   ├── FormDropdown (Locație)
│   │   ├── FormMultiSelect (Zile Săptămână)
│   │   ├── FormTimePicker (Oră Început)
│   │   └── FormTimePicker (Oră Sfârșit)
│   │
│   ├── Section: Pricing
│   │   ├── FormNumberInput (Preț/lună)
│   │   ├── FormNumberInput (Preț/8 sesiuni)
│   │   └── FormNumberInput (Preț/12 sesiuni)
│   │
│   └── Section: Hero Image
│       ├── Image Preview (if exists)
│       └── [Schimbă Poza] Button (opens image picker)
│
└── Bottom Actions Bar
    ├── [Anulează] Button
    └── [Salvează] Button (Primary)
```

### CoachCourseDetailScreen - Component Hierarchy
```
CoachCourseDetailScreen
├── ScrollView
│   │
│   ├── Hero Image (Full Width)
│   │
│   ├── Course Info Section (Read-Only)
│   │   ├── Name
│   │   ├── Description
│   │   ├── Sport & Level
│   │   ├── Age Range
│   │   ├── Location
│   │   ├── Schedule
│   │   ├── Pricing
│   │   └── Status
│   │
│   ├── Enrolled Children Section
│   │   ├── Section Title
│   │   ├── Count Summary
│   │   └── Children List (first 5, with "View All" link)
│   │
│   └── Recent Attendance Stats Section
│       ├── Section Title
│       └── Stats Summary (attendance rate, sessions this week)
│
└── Bottom Actions Bar
    ├── [Editează] Button
    ├── [Anunțuri] Button
    └── [Vezi Sesiuni] Button
```

---

## 4. Announcements Tab (Stack Navigator)

### Navigation Structure
```
Announcements Tab (Stack Navigator)
├── CoachAnnouncementsGlobalScreen
│   └── Navigate to → CoachAnnouncementFormScreen (create/edit)
```

### Screen Flow
```
CoachAnnouncementsGlobalScreen
│
├─→ Tap [+ Anunț Nou] ──→ CoachAnnouncementFormScreen (mode: create)
│                         │
│                         ├─→ Select Course
│                         ├─→ Enter Title & Content
│                         ├─→ Add Images (optional, max 10)
│                         ├─→ Add Video Links (optional)
│                         ├─→ Toggle Pin (optional)
│                         └─→ [Publică] ──→ Navigate Back (refresh list)
│
├─→ Tap [Edit] on Announcement ──→ CoachAnnouncementFormScreen (mode: edit)
│
├─→ Tap [Pin/Unpin] ──→ API call to toggle pin status
│
└─→ Tap [Delete] ──→ Confirmation Dialog ──→ API call to delete
```

### CoachAnnouncementsGlobalScreen - Component Hierarchy
```
CoachAnnouncementsGlobalScreen
├── Header
│   ├── Title & Subtitle
│   └── [+ Anunț Nou] Button
│
├── Filter & Sort Bar
│   ├── Course Filter (Dropdown: "Toate cursurile" or specific)
│   └── Sort Options (Recent, Pinned First, Oldest)
│
└── ScrollView (or FlatList with infinite scroll)
    └── AnnouncementCard[] (list of announcements)
        ├── Pin Indicator (if pinned)
        ├── Course Name
        ├── Title
        ├── Content Preview (first 100 chars)
        ├── Image Thumbnails (if any)
        ├── Video Indicator (if any)
        ├── Timestamp
        └── Action Buttons
            ├── [📌 Pin/Unpin]
            ├── [✏️ Edit]
            └── [🗑️ Delete]
```

### CoachAnnouncementFormScreen - Component Hierarchy
```
CoachAnnouncementFormScreen
├── Header
│   └── Title ("Anunț Nou" or "Editează Anunț")
│
├── ScrollView (Form)
│   │
│   ├── Section: Curs
│   │   └── FormDropdown (Select Course)
│   │
│   ├── Section: Conținut
│   │   ├── FormTextInput (Title, max 100 chars)
│   │   └── FormTextArea (Content, max 1000 chars)
│   │
│   ├── Section: Imagini
│   │   ├── Current Images (thumbnails grid)
│   │   │   └── [X] Delete button per image
│   │   └── [+ Adaugă Imagini] Button (multi-select, max 10)
│   │
│   ├── Section: Video Linkuri
│   │   ├── Current Video Links (list)
│   │   │   ├── URL display
│   │   │   ├── Preview (embed or icon)
│   │   │   └── [X] Delete button
│   │   └── [+ Adaugă Link Video] Button
│   │       └── Opens URL Input Dialog
│   │
│   └── Section: Opțiuni
│       └── FormToggle (Pin Announcement)
│
└── Bottom Actions Bar
    ├── [Anulează] Button
    └── [Publică] Button (Primary)
```

---

## Navigation Params Reference

### CoachSessionsStack Params
```typescript
export type CoachSessionsStackParamList = {
  CoachSessionsHome: undefined;
  CoachSessionDetail: {
    occurrenceId: string;
    courseName: string;
    date: string;
  };
  CoachPaymentManagement: {
    courseId: string;
    courseName: string;
  };
};
```

### CoachCoursesStack Params
```typescript
export type CoachCoursesStackParamList = {
  CoachCoursesHome: undefined;
  CoachCourseDetail: {
    courseId: string;
  };
  CoachCourseForm: {
    mode: 'create' | 'edit';
    courseId?: string; // required if mode = 'edit'
  };
};
```

### CoachAnnouncementsStack Params
```typescript
export type CoachAnnouncementsStackParamList = {
  CoachAnnouncementsGlobal: {
    courseId?: string; // optional, to filter by course
  };
  CoachAnnouncementForm: {
    mode: 'create' | 'edit';
    announcementId?: string; // required if mode = 'edit'
    courseId?: string; // optional pre-selection if mode = 'create'
  };
};
```

### CoachTabsParamList (Root Tabs)
```typescript
export type CoachTabsParamList = {
  CoachDashboard: undefined;
  CoachSessions: NavigatorScreenParams<CoachSessionsStackParamList>;
  CoachCourses: NavigatorScreenParams<CoachCoursesStackParamList>;
  CoachAnnouncements: NavigatorScreenParams<CoachAnnouncementsStackParamList>;
};
```

---

## Cross-Tab Navigation Examples

### From Dashboard to Other Tabs

```typescript
// Navigate to create new course
navigation.navigate('CoachCourses', {
  screen: 'CoachCourseForm',
  params: { mode: 'create' }
});

// Navigate to mark attendance
navigation.navigate('CoachSessions', {
  screen: 'CoachSessionsHome'
});

// Navigate to specific session
navigation.navigate('CoachSessions', {
  screen: 'CoachSessionDetail',
  params: {
    occurrenceId: 'occ_123',
    courseName: 'Înotători Avansați',
    date: '2025-11-21'
  }
});

// Navigate to create announcement
navigation.navigate('CoachAnnouncements', {
  screen: 'CoachAnnouncementForm',
  params: { mode: 'create' }
});

// Navigate to course detail (from alert)
navigation.navigate('CoachCourses', {
  screen: 'CoachCourseDetail',
  params: { courseId: 'course_123' }
});
```

### From Courses to Announcements

```typescript
// Navigate to announcements filtered by course
navigation.navigate('CoachAnnouncements', {
  screen: 'CoachAnnouncementsGlobal',
  params: { courseId: 'course_123' }
});
```

### From Sessions to Payments

```typescript
// Navigate to payment management from session detail
navigation.navigate('CoachPaymentManagement', {
  courseId: 'course_123',
  courseName: 'Înotători Avansați'
});
```

---

## Deep Linking Structure (Future)

```
motiontimisoara://coach/dashboard
motiontimisoara://coach/sessions
motiontimisoara://coach/sessions/:occurrenceId
motiontimisoara://coach/courses
motiontimisoara://coach/courses/new
motiontimisoara://coach/courses/:courseId
motiontimisoara://coach/courses/:courseId/edit
motiontimisoara://coach/announcements
motiontimisoara://coach/announcements/new
motiontimisoara://coach/announcements/:announcementId/edit
```

---

## State Management & Data Flow

### Global State (Context)
```
AuthContext
├── user (User object with role)
├── isAuthenticated (boolean)
├── login()
├── logout()
└── refreshToken()
```

### Coach-Specific State (Custom Hooks)
```
useCoachDashboardStats()
├── stats (computed stats)
├── loading
├── error
└── reload()

useCoachCourses()
├── courses (Course[])
├── loading
├── error
└── reload()

useCoachSessions(weekStart: string)
├── days (DaySessionsDto[])
├── loading
├── error
└── reload()

useCoachAnnouncements(courseId?: string)
├── announcements (Announcement[])
├── loading
├── error
├── reload()
└── hasMore (for infinite scroll)
```

---

## Screen Transitions

### Animation Types
- **Tab Switch**: Fade + slight scale
- **Stack Push**: Slide from right (iOS) / Slide from bottom (Android)
- **Stack Pop**: Slide to right (iOS) / Slide to top (Android)
- **Modal**: Slide from bottom + backdrop fade in
- **Dialog**: Scale + fade + backdrop fade in

---

## Summary

This navigation structure provides:
- ✅ **Clear hierarchy**: Tabs → Stacks → Screens
- ✅ **Type safety**: TypeScript param types for all navigators
- ✅ **Flexibility**: Cross-tab navigation support
- ✅ **Scalability**: Easy to add new screens
- ✅ **Consistency**: Matches web structure where applicable

All screens are designed to be:
- **Responsive**: Work on all screen sizes
- **Accessible**: Proper labels and navigation
- **Performant**: Optimized lists and images
- **User-friendly**: Clear feedback and error states
