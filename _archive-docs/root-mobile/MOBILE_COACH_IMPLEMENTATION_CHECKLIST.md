# Mobile Coach - Implementation Checklist

## Quick Reference
- 📋 Not Started
- 🔄 In Progress  
- ✅ Complete
- ⚠️ Blocked/Needs Review

---

## Phase 1: Foundation & Dashboard Enhancement

### Theme & Design System
- [ ] 📋 Update `theme.ts` with web color palette
- [ ] 📋 Add typography constants from web
- [ ] 📋 Add consistent spacing values
- [ ] 📋 Add shadow definitions
- [ ] 📋 Document theme usage

### Core Components Library
- [ ] 📋 Create `components/coach/StatCard.tsx`
- [ ] 📋 Create `components/coach/SessionCard.tsx`
- [ ] 📋 Create `components/coach/CourseCard.tsx`
- [ ] 📋 Create `components/coach/AnnouncementCard.tsx`
- [ ] 📋 Create `components/coach/AlertCard.tsx`
- [ ] 📋 Create `components/coach/WeekNavigator.tsx`
- [ ] 📋 Create `components/coach/LoadingState.tsx`
- [ ] 📋 Create `components/coach/EmptyState.tsx`
- [ ] 📋 Create `components/coach/ErrorState.tsx`

### Dashboard Enhancement
- [ ] 📋 Update `CoachDashboardScreen.tsx` layout
- [ ] 📋 Add statistics cards section
  - [ ] 📋 Total Cursuri card
  - [ ] 📋 Copii Înscriși card
  - [ ] 📋 Sesiuni Săptămână card
  - [ ] 📋 Rată Prezență card
- [ ] 📋 Enhance upcoming sessions list (use SessionCard)
- [ ] 📋 Add alerts section (use AlertCard)
- [ ] 📋 Add quick actions FAB
- [ ] 📋 Implement pull-to-refresh
- [ ] 📋 Create `useCoachDashboardStats()` hook
- [ ] 📋 Create `useCoachAlerts()` hook

### Testing - Phase 1
- [ ] 📋 Unit tests for StatCard
- [ ] 📋 Unit tests for SessionCard
- [ ] 📋 Unit tests for useCoachDashboardStats hook
- [ ] 📋 E2E test: Login as coach → View dashboard

---

## Phase 2: Sessions & Payments

### API Layer
- [ ] 📋 Create `api/coachPaymentsApi.ts`
  - [ ] 📋 `addSessions(enrollmentId, count)` function
  - [ ] 📋 `removeSessions(enrollmentId, count)` function
  - [ ] 📋 `getEnrollments(courseId)` function
- [ ] 📋 Add TypeScript types for payment DTOs

### Sessions Enhancement
- [ ] 📋 Update `CoachSessionsHome` with weekly calendar view
- [ ] 📋 Add week navigation (prev/next buttons)
- [ ] 📋 Group sessions by day
- [ ] 📋 Add quick action buttons per session
- [ ] 📋 Enhance styling to match web
- [ ] 📋 Add loading/error states

### Session Detail Updates
- [ ] 📋 Minor UI improvements to `CoachSessionDetail`
- [ ] 📋 Add "Add/Remove Sessions" button
- [ ] 📋 Link to PaymentManagement screen

### Payment Management Screen
- [ ] 📋 Create `screens/CoachPaymentManagementScreen.tsx`
- [ ] 📋 Add course selector dropdown
- [ ] 📋 Create `ChildPaymentRow` component
- [ ] 📋 Implement children list with session counts
- [ ] 📋 Create "Add Sessions" dialog
- [ ] 📋 Create "Remove Sessions" dialog
- [ ] 📋 Implement API calls for add/remove
- [ ] 📋 Add loading/error/success states
- [ ] 📋 Add confirmation dialogs

### Hooks
- [ ] 📋 Create `useCoachEnrollments(courseId)` hook
- [ ] 📋 Create `useCoachPaymentActions()` hook

### Navigation
- [ ] 📋 Update `CoachSessionsStackNavigator.tsx`
- [ ] 📋 Add PaymentManagement screen to stack
- [ ] 📋 Define param types

### Testing - Phase 2
- [ ] 📋 Unit tests for payment API functions
- [ ] 📋 Unit tests for useCoachEnrollments hook
- [ ] 📋 E2E test: Mark attendance flow
- [ ] 📋 E2E test: Add sessions to child

---

## Phase 3: Courses Module

### API Layer
- [ ] 📋 Create `api/coachCoursesApi.ts`
  - [ ] 📋 `createCourse(data)` function
  - [ ] 📋 `updateCourse(id, data)` function
  - [ ] 📋 `toggleCourseStatus(id)` function
  - [ ] 📋 `uploadHeroImage(id, imageUri)` function
  - [ ] 📋 `getCourseDetail(id)` function
- [ ] 📋 Add TypeScript types for course DTOs

### Navigation
- [ ] 📋 Create `navigation/CoachCoursesStackNavigator.tsx`
- [ ] 📋 Define param types (CoachCoursesStackParamList)
- [ ] 📋 Add to CoachTabsNavigator

### Courses Home Screen
- [ ] 📋 Create `screens/CoachCoursesHomeScreen.tsx`
- [ ] 📋 Implement header with "New Course" button
- [ ] 📋 Use CourseCard for list items
- [ ] 📋 Add search/filter functionality
- [ ] 📋 Add sort options
- [ ] 📋 Implement swipe actions (Edit, Announcements, Toggle)
- [ ] 📋 Add pull-to-refresh
- [ ] 📋 Add empty state
- [ ] 📋 Add loading state

### Course Form Screen
- [ ] 📋 Create `screens/CoachCourseFormScreen.tsx`
- [ ] 📋 Create form components:
  - [ ] 📋 `FormTextInput` component
  - [ ] 📋 `FormTextArea` component
  - [ ] 📋 `FormDropdown` component
  - [ ] 📋 `FormNumberInput` component
  - [ ] 📋 `FormTimePicker` component
  - [ ] 📋 `FormMultiSelect` component (for days of week)
  - [ ] 📋 `FormImagePicker` component
  - [ ] 📋 `FormToggle` component
- [ ] 📋 Implement "Informații de Bază" section
- [ ] 📋 Implement "Locație și Organizare" section
- [ ] 📋 Implement "Pricing" section
- [ ] 📋 Implement "Hero Image" section
- [ ] 📋 Add form validation with error messages
- [ ] 📋 Handle create mode
- [ ] 📋 Handle edit mode (pre-fill data)
- [ ] 📋 Add loading state during save
- [ ] 📋 Add success/error feedback
- [ ] 📋 Implement image crop/resize (optional)

### Course Detail Screen
- [ ] 📋 Create `screens/CoachCourseDetailScreen.tsx`
- [ ] 📋 Display hero image (full width)
- [ ] 📋 Display all course info (read-only)
- [ ] 📋 Show enrolled children summary
- [ ] 📋 Show recent attendance stats
- [ ] 📋 Add action buttons (Edit, Announcements, View Sessions)

### Hooks
- [ ] 📋 Create `useCoachCourseDetail(courseId)` hook
- [ ] 📋 Create `useCoachCourseForm(initialData?)` hook
- [ ] 📋 Create `useCoachCourseCreate()` hook
- [ ] 📋 Create `useCoachCourseUpdate(courseId)` hook

### Testing - Phase 3
- [ ] 📋 Unit tests for course API functions
- [ ] 📋 Unit tests for form validation
- [ ] 📋 Unit tests for course hooks
- [ ] 📋 E2E test: Create new course flow
- [ ] 📋 E2E test: Edit existing course flow
- [ ] 📋 E2E test: Toggle course status

---

## Phase 4: Announcements Module

### API Layer
- [ ] 📋 Enhance `api/coachAnnouncementsApi.ts`
  - [ ] 📋 `pinAnnouncement(courseId, announcementId)` function
  - [ ] 📋 `unpinAnnouncement(courseId, announcementId)` function
  - [ ] 📋 `uploadAnnouncementImages(files)` function
  - [ ] 📋 `deleteAnnouncementAttachment(attachmentId)` function
- [ ] 📋 Update TypeScript types for announcement DTOs

### Navigation
- [ ] 📋 Update `navigation/CoachAnnouncementsStackNavigator.tsx`
- [ ] 📋 Add AnnouncementForm screen to stack
- [ ] 📋 Define param types

### Announcements Global Screen
- [ ] 📋 Redesign `CoachAnnouncementsGlobalScreen.tsx`
- [ ] 📋 Implement header with "New Announcement" button
- [ ] 📋 Add course filter dropdown
- [ ] 📋 Add sort options (Recent, Pinned first, Oldest)
- [ ] 📋 Use AnnouncementCard for list items
- [ ] 📋 Implement swipe actions (Pin, Edit, Delete)
- [ ] 📋 Add pull-to-refresh
- [ ] 📋 Add infinite scroll
- [ ] 📋 Add empty state
- [ ] 📋 Add loading state

### Announcement Form Screen
- [ ] 📋 Create `screens/CoachAnnouncementFormScreen.tsx`
- [ ] 📋 Add course selector
- [ ] 📋 Add title input (max 100 chars)
- [ ] 📋 Add content textarea (max 1000 chars)
- [ ] 📋 Create `AnnouncementImagePicker` component
  - [ ] 📋 Multi-select images (max 10)
  - [ ] 📋 Show thumbnails
  - [ ] 📋 Delete individual images
- [ ] 📋 Create `AnnouncementVideoLinks` component
  - [ ] 📋 Add video URL input
  - [ ] 📋 Validate URLs (YouTube, Vimeo)
  - [ ] 📋 Show video preview/embed
  - [ ] 📋 Delete individual video links
- [ ] 📋 Add pin toggle
- [ ] 📋 Implement form validation
- [ ] 📋 Handle create mode
- [ ] 📋 Handle edit mode (pre-fill data)
- [ ] 📋 Add loading state during save
- [ ] 📋 Add success/error feedback
- [ ] 📋 Handle image uploads
- [ ] 📋 Handle video link validation

### Hooks
- [ ] 📋 Create `useCoachAnnouncements(courseId?)` hook
- [ ] 📋 Create `useCoachAnnouncementForm(initialData?)` hook
- [ ] 📋 Create `useCoachAnnouncementCreate()` hook
- [ ] 📋 Create `useCoachAnnouncementUpdate(announcementId)` hook

### Testing - Phase 4
- [ ] 📋 Unit tests for announcement API functions
- [ ] 📋 Unit tests for form validation
- [ ] 📋 Unit tests for announcement hooks
- [ ] 📋 E2E test: Create announcement with images
- [ ] 📋 E2E test: Pin/unpin announcement
- [ ] 📋 E2E test: Edit announcement
- [ ] 📋 E2E test: Delete announcement

---

## Phase 5: Polish & Optimization

### Animations & Transitions
- [ ] 📋 Add screen transition animations
- [ ] 📋 Add card hover/press animations
- [ ] 📋 Add loading animations
- [ ] 📋 Add success/error feedback animations
- [ ] 📋 Add FAB animations

### Loading States
- [ ] 📋 Implement skeleton screens for all main screens
- [ ] 📋 Add shimmer effect to skeletons
- [ ] 📋 Optimize loading indicators placement

### User Feedback
- [ ] 📋 Add pull-to-refresh to all list screens
- [ ] 📋 Add haptic feedback for key actions
- [ ] 📋 Improve toast/snackbar messages
- [ ] 📋 Add confirmation dialogs for destructive actions

### Accessibility
- [ ] 📋 Add accessibility labels to all interactive elements
- [ ] 📋 Test with screen reader
- [ ] 📋 Ensure sufficient color contrast
- [ ] 📋 Add proper focus management
- [ ] 📋 Test keyboard navigation (web)

### Performance
- [ ] 📋 Optimize image loading (lazy load)
- [ ] 📋 Implement pagination for long lists
- [ ] 📋 Memoize expensive components
- [ ] 📋 Optimize FlatList performance
- [ ] 📋 Profile and fix performance bottlenecks
- [ ] 📋 Reduce bundle size (analyze imports)

### Error Handling
- [ ] 📋 Implement global error boundary
- [ ] 📋 Add retry mechanisms for failed API calls
- [ ] 📋 Improve error messages (user-friendly)
- [ ] 📋 Add logging for debugging

### Documentation
- [ ] 📋 Document all new components
- [ ] 📋 Document all new hooks
- [ ] 📋 Document API functions
- [ ] 📋 Create usage examples
- [ ] 📋 Update README with coach features

### Testing - Phase 5
- [ ] 📋 Complete unit test coverage (>80%)
- [ ] 📋 Complete integration test coverage
- [ ] 📋 Run all E2E tests and fix failures
- [ ] 📋 Test on iOS devices
- [ ] 📋 Test on Android devices
- [ ] 📋 Test on tablets
- [ ] 📋 Performance testing
- [ ] 📋 Accessibility testing

### Bug Fixes
- [ ] 📋 Fix any outstanding bugs from previous phases
- [ ] 📋 Address user feedback (if beta testing)
- [ ] 📋 Fix edge cases

---

## Final Checklist Before Release

### Functionality
- [ ] 📋 All features from web are present in mobile
- [ ] 📋 All API calls work correctly
- [ ] 📋 All forms validate properly
- [ ] 📋 All navigation flows work
- [ ] 📋 Images upload successfully
- [ ] 📋 Announcements display correctly
- [ ] 📋 Attendance marking works
- [ ] 📋 Payment management works

### UI/UX
- [ ] 📋 Design matches web consistently
- [ ] 📋 All screens are responsive
- [ ] 📋 Loading states are smooth
- [ ] 📋 Error states are helpful
- [ ] 📋 Empty states are informative
- [ ] 📋 Animations are polished
- [ ] 📋 No UI glitches

### Performance
- [ ] 📋 App loads in < 3s
- [ ] 📋 Screens render in < 2s
- [ ] 📋 No memory leaks
- [ ] 📋 Smooth scrolling (60fps)
- [ ] 📋 Images load efficiently

### Testing
- [ ] 📋 All unit tests pass
- [ ] 📋 All integration tests pass
- [ ] 📋 All E2E tests pass
- [ ] 📋 Manual QA completed
- [ ] 📋 Beta testing feedback addressed

### Documentation
- [ ] 📋 Code is well-documented
- [ ] 📋 README is updated
- [ ] 📋 Change log is updated
- [ ] 📋 User guide is created (if needed)

---

## Notes & Decisions

### Key Technical Decisions
- **Forms**: Using react-hook-form with yup validation
- **Image Handling**: expo-image-picker + image compression
- **State Management**: React hooks (no Redux needed)
- **Navigation**: React Navigation 6 with TypeScript
- **API Layer**: Axios with TypeScript types

### Deferred Features (Post-MVP)
- Push notifications
- Offline mode
- Analytics dashboard
- Bulk actions
- Chat/messaging
- Calendar sync

### Known Issues/Risks
- [ ] Large image uploads may be slow on poor network
- [ ] Multiple image uploads need progress indicator
- [ ] Form state persistence not implemented (user loses data if navigates away)

---

## Progress Tracking

### Phase 1: 0% Complete
### Phase 2: 0% Complete
### Phase 3: 0% Complete
### Phase 4: 0% Complete
### Phase 5: 0% Complete

**Overall Progress: 0/150 items complete (0%)**

---

## Quick Commands

### Start Development
```bash
cd TriathlonTeamMobile
npm start
```

### Run on iOS
```bash
npm run ios
```

### Run on Android
```bash
npm run android
```

### Run Tests
```bash
npm test
```

### Type Check
```bash
npx tsc --noEmit
```

### Lint
```bash
npm run lint
```

---

## Contact & Resources

- **Design Reference**: Check `TriathlonTeamFE/src/app/features/coach`
- **API Docs**: Check backend Swagger at `http://localhost:8081/swagger-ui.html`
- **Questions**: Document in this file or create GitHub issues

---

_Last Updated: [Current Date]_
_Next Review: After Phase 1 completion_
