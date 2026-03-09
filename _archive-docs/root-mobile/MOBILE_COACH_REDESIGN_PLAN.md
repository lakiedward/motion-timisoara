# Mobile App - Coach Redesign Plan

## Executive Summary

Redesign-ul aplicației mobile pentru coach va aduce funcționalitatea la paritate cu site-ul web, păstrând în același timp o experiență optimizată pentru mobile. Acest document detaliază structura, funcționalitățile și designul consistent cu web-ul.

---

## Current State Analysis

### Web (Angular) - Coach Features
1. **Dashboard**
   - Statistici detaliate (cursuri totale, copii înscriși, sesiuni săptămână curentă, rată prezență)
   - Sesiuni următoare (top 5)
   - Alerte și notificări
   - Acțiuni rapide (Adaugă curs, Creează anunț, Marchează prezență, Vezi cursuri)

2. **Cursuri (Courses)**
   - Listare cursuri cu thumbnail hero
   - Creare curs nou (formular complet)
   - Editare curs existent
   - Toggle activ/inactiv
   - Acces rapid la anunțuri per curs

3. **Anunțuri (Announcements)**
   - Anunțuri globale (toate cursurile)
   - Anunțuri per curs
   - Creare anunț cu imagini și video links
   - Pin/unpin anunțuri
   - Ștergere anunțuri

4. **Prezențe & Plăți (Attendance & Payments)**
   - Calendar săptămânal cu toate sesiunile
   - Marcare prezență per sesiune
   - Gestionare plăți
   - Vizualizare istoric prezență
   - Adăugare/scoatere sesiuni pentru copii

### Mobile (React Native) - Current State
1. **Dashboard**
   - Statistici de bază
   - Acțiuni rapide limitate
   - UI simplu

2. **Sessions**
   - Listare sesiuni zilnice
   - Marcare prezență
   - Calendar săptămânal simplificat

3. **Courses**
   - Doar listare
   - Fără funcționalitate de creare/editare

4. **Announcements**
   - Funcționalitate de bază

### Gap Analysis
**Missing Features in Mobile:**
- [ ] Course creation/editing
- [ ] Payment management UI
- [ ] Advanced announcement features (pin, multiple images/videos)
- [ ] Detailed statistics
- [ ] Alerts system
- [ ] Weekly calendar with full controls

---

## Design System Consistency

### Color Palette (From Web)
```typescript
const colors = {
  primary: '#3b82f6',        // Blue
  primaryHover: '#2563eb',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  surface: '#ffffff',
  background: '#f8fafc',
  text: '#1e293b',
  textMuted: '#64748b',
  border: '#e2e8f0',
  borderSubtle: '#f1f5f9'
};
```

### Typography
```typescript
const typography = {
  heading1: { fontSize: 32, fontWeight: '700', lineHeight: 40 },
  heading2: { fontSize: 24, fontWeight: '600', lineHeight: 32 },
  heading3: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '500', lineHeight: 16 }
};
```

### Spacing
```typescript
const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  screenPadding: 16
};
```

### Component Patterns (From Web)
- **Cards**: Elevated with subtle shadow, rounded corners (12px)
- **Buttons**: 
  - Primary: Filled with primary color
  - Secondary: Outlined
  - Icon buttons: Square/circular with icon
- **Lists**: Card-based with dividers
- **Stats Cards**: Icon + value + label layout
- **Forms**: Material-style inputs with labels

---

## Proposed Structure

### Tab Navigation (Updated)
```
┌─────────────────────────────────────────┐
│  Dashboard  │  Sesiuni  │  Cursuri  │  Anunțuri  │
└─────────────────────────────────────────┘
```

### 1. Dashboard Tab ✅ (Enhanced)

#### Screen: CoachDashboardScreen (ENHANCED)

**Hero Section**
- Welcome message with coach name
- Today's date and session count
- Quick stats chips (Active courses, Week sessions)

**Statistics Cards Grid (4 cards)**
```
┌──────────────┬──────────────┐
│  Total       │  Copii       │
│  Cursuri     │  Înscriși    │
│  [icon] 12   │  [icon] 145  │
└──────────────┴──────────────┘
┌──────────────┬──────────────┐
│  Sesiuni     │  Rată        │
│  Săptămână   │  Prezență    │
│  [icon] 24   │  [icon] 85%  │
└──────────────┴──────────────┘
```

**Upcoming Sessions List (Card)**
- Next 5 sessions
- Course name, date, time, enrolled count
- Quick action button to mark attendance

**Alerts Section (Card)**
- Low sessions warnings
- Missing attendance alerts
- Tap to navigate to relevant screen

**Quick Actions (Bottom)**
- Floating action button group:
  - Adaugă curs nou
  - Creează anunț
  - Marchează prezență
  - Vezi toate cursurile

---

### 2. Sesiuni Tab ✅ (Enhanced)

#### Stack Navigator
```
CoachSessionsStack
  ├─ CoachSessionsHome (Weekly Calendar)
  ├─ CoachSessionDetail (Attendance Marking)
  └─ CoachPaymentManagement (NEW)
```

#### Screen: CoachSessionsHome (ENHANCED)

**Weekly Calendar View**
```
┌─────────────────────────────────────────┐
│  [<] Săptămâna 21-27 Nov 2025 [>]       │
├─────────────────────────────────────────┤
│  Luni, 21 Nov                           │
│  ┌────────────────────────────────────┐ │
│  │ 🏊 Înotători Avansați               │ │
│  │ 10:00 - 11:30 • 15 înscriși        │ │
│  │ [Marchează Prezența] [Gestionează]│ │
│  └────────────────────────────────────┘ │
│                                         │
│  Marți, 22 Nov                          │
│  ┌────────────────────────────────────┐ │
│  │ 🚴 Ciclism Intermediari             │ │
│  │ 16:00 - 17:30 • 12 înscriși        │ │
│  │ [Marchează Prezența] [Gestionează]│ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Features:**
- Weekly navigation (prev/next)
- Sessions grouped by day
- Course icon/color coding
- Enrolled count
- Quick actions per session
- Pull to refresh

#### Screen: CoachSessionDetail (CURRENT - Minor Enhancements)

**Header**
- Course name
- Date and time
- Location (if available)

**Enrolled Children List**
- Avatar/photo
- Name
- Attendance status toggle (Present/Absent)
- Sessions remaining count
- Quick payment action

**Actions**
- Mark all present
- Mark all absent
- Save attendance
- Add/remove sessions (opens PaymentManagement)

#### Screen: CoachPaymentManagement (NEW)

**Purpose:** Manage session payments for enrolled children

**Sections:**

1. **Course Selection**
   - Dropdown to select course
   - Shows enrolled children count

2. **Children List**
   ```
   ┌────────────────────────────────────┐
   │ 👤 Ion Popescu                     │
   │ Sesiuni rămase: 5                  │
   │ [➕ Adaugă Sesiuni] [➖ Scoate]    │
   └────────────────────────────────────┘
   ```

3. **Add Sessions Dialog**
   - Number of sessions input
   - Confirmation

4. **Remove Sessions Dialog**
   - Number of sessions input
   - Confirmation (with warning if going below 0)

---

### 3. Cursuri Tab 🔄 (Major Overhaul)

#### Stack Navigator
```
CoachCoursesStack
  ├─ CoachCoursesHome (List)
  ├─ CoachCourseDetail (View/Edit)
  ├─ CoachCourseForm (Create/Edit Form)
  └─ CoachCourseAnnouncements (Per-course announcements)
```

#### Screen: CoachCoursesHome (REDESIGNED)

**Header**
- Title: "Cursurile mele"
- Subtitle: "Administrează cursurile tale"
- Action: [+ Curs Nou] button

**Courses List (Cards)**
```
┌─────────────────────────────────────────┐
│ [Hero Image]                            │
│                                         │
│ Înotători Avansați                      │
│ Sport: Înot • Nivel: Avansat           │
│ 📍 Bazin Olimpic                        │
│                                         │
│ 👥 45 copii înscriși (40 plătiți)      │
│ 📅 Luni, Miercuri 10:00-11:30          │
│                                         │
│ Status: ● ACTIV                         │
│                                         │
│ [Editează] [Anunțuri] [Dezactivează]   │
└─────────────────────────────────────────┘
```

**Each Card Shows:**
- Hero image thumbnail
- Course name
- Sport + Level
- Location
- Enrolled count (paid/unpaid)
- Schedule summary
- Active/Inactive status
- Action buttons

**Features:**
- Search/filter by sport, level, status
- Sort by name, date, enrolled count
- Pull to refresh
- Swipe actions (Edit, Announcements, Toggle active)

#### Screen: CoachCourseForm (NEW - Complex Form)

**Purpose:** Create or edit a course

**Form Sections:**

1. **Informații de Bază**
   - Nume curs (text input)
   - Descriere (textarea, max 500 chars)
   - Sport (dropdown: Înot, Alergare, Ciclism, Triatlon)
   - Nivel (dropdown: Începător, Intermediar, Avansat)
   - Vârstă min/max (number inputs)
   - Status (toggle: Activ/Inactiv)

2. **Locație și Organizare**
   - Locație (dropdown from available locations)
   - Zi/zile săptămână (multi-select: L, Ma, Mi, J, V, S, D)
   - Oră început (time picker)
   - Oră sfârșit (time picker)

3. **Pricing**
   - Preț pe lună (number input)
   - Preț pe 8 sesiuni (number input)
   - Preț pe 12 sesiuni (number input)

4. **Hero Image**
   - Current image thumbnail (if editing)
   - [Schimbă Poza] button
   - Image picker (camera or gallery)
   - Crop/resize functionality

5. **Actions**
   - [Salvează] (primary button)
   - [Anulează] (secondary button)

**Validation:**
- All required fields must be filled
- Age min < Age max
- Start time < End time
- Prices > 0
- Hero image required

#### Screen: CoachCourseDetail (NEW - View Mode)

**Purpose:** View course details before editing

**Sections:**
- Hero image (full width)
- Course info (read-only display of all fields)
- Enrolled children list (summary)
- Recent attendance stats
- Quick actions: [Editează], [Anunțuri], [Vezi Sesiuni]

---

### 4. Anunțuri Tab 🔄 (Major Overhaul)

#### Stack Navigator
```
CoachAnnouncementsStack
  ├─ CoachAnnouncementsGlobal (All announcements)
  └─ CoachAnnouncementForm (Create/Edit announcement)
```

#### Screen: CoachAnnouncementsGlobal (REDESIGNED)

**Header**
- Title: "Anunțurile mele"
- Subtitle: "Toate anunțurile din cursurile tale"
- Action: [+ Anunț Nou] button

**Filters Section**
- Course selector (dropdown): "Toate cursurile" or specific course
- Sort: Recent, Pinned first, Oldest

**Announcements List (Cards)**
```
┌─────────────────────────────────────────┐
│ 📌 PINNED                               │
│                                         │
│ Înotători Avansați                      │
│ Schimbare program săptămâna viitoare    │
│                                         │
│ [Image thumbnails if any]               │
│ [Video embed icon if any]               │
│                                         │
│ Luni, 21 Nov 2025 • 10:30              │
│                                         │
│ [📌 Unpinned] [✏️ Edit] [🗑️ Delete]   │
└─────────────────────────────────────────┘
```

**Each Card Shows:**
- Pin indicator (if pinned)
- Course name
- Announcement title
- Content preview (first 100 chars)
- Image thumbnails (if any)
- Video indicator (if any)
- Timestamp
- Action buttons (Pin/Unpin, Edit, Delete)

**Features:**
- Filter by course
- Sort options
- Pull to refresh
- Swipe actions (Pin, Edit, Delete)
- Infinite scroll

#### Screen: CoachAnnouncementForm (NEW - Complex Form)

**Purpose:** Create or edit an announcement

**Form Sections:**

1. **Curs**
   - Course selector (dropdown from coach's courses)

2. **Conținut**
   - Title (text input, max 100 chars)
   - Content (textarea, max 1000 chars)

3. **Media**
   - **Images Section**
     - Current images thumbnails (if editing)
     - [+ Adaugă Imagini] button
     - Image picker (multi-select, max 10)
     - Delete individual images
   
   - **Videos Section**
     - Current video links (if editing)
     - [+ Adaugă Link Video] button
     - URL input (YouTube, Vimeo, etc.)
     - Delete individual video links
     - Preview video embed

4. **Options**
   - Pin announcement (toggle)

5. **Actions**
   - [Publică] (primary button)
   - [Salvează ca Draft] (if implementing drafts)
   - [Anulează] (secondary button)

**Validation:**
- Course must be selected
- Title required (1-100 chars)
- Content required (1-1000 chars)
- Max 10 images
- Valid video URLs

---

## UI Components Library

### Reusable Components (To Create/Update)

1. **StatCard**
   - Props: icon, value, label, sublabel, color
   - Used in: Dashboard

2. **SessionCard**
   - Props: session object, actions
   - Used in: Dashboard, SessionsHome

3. **CourseCard**
   - Props: course object, actions, mode (compact/full)
   - Used in: Dashboard, CoursesHome

4. **AnnouncementCard**
   - Props: announcement object, actions, showCourse
   - Used in: AnnouncementsGlobal

5. **ChildAttendanceRow**
   - Props: child object, attendance status, onToggle, actions
   - Used in: SessionDetail

6. **ChildPaymentRow**
   - Props: child object, sessions count, actions
   - Used in: PaymentManagement

7. **FormField Components**
   - TextInput
   - TextArea
   - Dropdown (Picker)
   - MultiSelect
   - DatePicker
   - TimePicker
   - ImagePicker
   - Toggle/Switch

8. **AlertCard**
   - Props: alert object, onTap
   - Used in: Dashboard

9. **WeekNavigator**
   - Props: currentWeek, onPrev, onNext
   - Used in: SessionsHome

10. **LoadingState**
    - Skeleton screens for each main screen

11. **EmptyState**
    - Props: icon, message, action
    - Used when lists are empty

12. **ErrorState**
    - Props: message, onRetry
    - Used when API calls fail

---

## API Integration

### Required API Endpoints (Already Available)

#### Courses
- `GET /api/coach/courses` - List coach's courses
- `GET /api/coach/courses/{id}` - Get course details
- `POST /api/coach/courses` - Create course
- `PUT /api/coach/courses/{id}` - Update course
- `PATCH /api/coach/courses/{id}/status` - Toggle active status
- `POST /api/coach/courses/{id}/hero-image` - Upload hero image
- `GET /api/coach/courses/{id}/hero-image` - Get hero image

#### Announcements
- `GET /api/courses/{courseId}/announcements` - List announcements
- `POST /api/courses/{courseId}/announcements` - Create announcement
- `PUT /api/courses/{courseId}/announcements/{id}` - Update announcement
- `DELETE /api/courses/{courseId}/announcements/{id}` - Delete announcement
- `PATCH /api/courses/{courseId}/announcements/{id}/pin` - Pin announcement
- `PATCH /api/courses/{courseId}/announcements/{id}/unpin` - Unpin announcement
- `GET /api/courses/{courseId}/announcements/{announcementId}/attachments/{attachmentId}/image` - Get image

#### Sessions & Attendance
- `GET /api/coach/weekly-calendar?weekStart={date}` - Weekly sessions
- `GET /api/coach/today` - Today's sessions
- `GET /api/coach/attendance/{occurrenceId}` - Get attendance for session
- `POST /api/coach/attendance/{occurrenceId}` - Mark attendance

#### Payments
- `POST /api/coach/enrollments/{enrollmentId}/add-sessions` - Add sessions
- `POST /api/coach/enrollments/{enrollmentId}/remove-sessions` - Remove sessions
- `GET /api/coach/courses/{courseId}/enrollments` - Get enrollments for course

### New API Services (To Create in Mobile)

1. **coachCoursesApi.ts**
   - createCourse()
   - updateCourse()
   - toggleCourseStatus()
   - uploadHeroImage()

2. **coachPaymentsApi.ts**
   - addSessions()
   - removeSessions()
   - getEnrollments()

3. **Enhanced coachAnnouncementsApi.ts**
   - pinAnnouncement()
   - unpinAnnouncement()
   - uploadAnnouncementImages()
   - deleteAnnouncementAttachment()

---

## State Management

### Context/Hooks Structure

#### Existing (To Enhance)
- `useCoachTodayAttendance()` ✅
- `useCoachWeeklySchedule()` ✅
- `useCoachCourses()` ✅

#### New Hooks
```typescript
// Course Management
useCoachCourseDetail(courseId: string)
useCoachCourseForm(initialData?: Course)
useCoachCourseCreate()
useCoachCourseUpdate(courseId: string)

// Announcements
useCoachAnnouncements(courseId?: string)
useCoachAnnouncementForm(initialData?: Announcement)
useCoachAnnouncementCreate()
useCoachAnnouncementUpdate(announcementId: string)

// Payments
useCoachEnrollments(courseId: string)
useCoachPaymentActions()

// Dashboard
useCoachDashboardStats()
useCoachUpcomingSessions()
useCoachAlerts()
```

---

## Implementation Phases

### Phase 1: Foundation & Dashboard (Week 1-2)
- [ ] Update theme config with web colors
- [ ] Create component library (StatCard, SessionCard, etc.)
- [ ] Enhance CoachDashboardScreen
  - [ ] Add statistics cards
  - [ ] Add alerts section
  - [ ] Add quick actions FAB
- [ ] Create loading/error/empty states

### Phase 2: Sessions & Payments (Week 3-4)
- [ ] Enhance CoachSessionsHome with weekly calendar
- [ ] Minor updates to CoachSessionDetail
- [ ] Create CoachPaymentManagement screen
- [ ] Implement payment API calls
- [ ] Create payment-related hooks

### Phase 3: Courses Module (Week 5-7)
- [ ] Create CoachCoursesStack navigator
- [ ] Redesign CoachCoursesHome with cards
- [ ] Create CoachCourseForm screen
  - [ ] All form sections
  - [ ] Image picker
  - [ ] Validation
- [ ] Create CoachCourseDetail screen
- [ ] Implement course API calls
- [ ] Create course-related hooks
- [ ] Test create/edit flow end-to-end

### Phase 4: Announcements Module (Week 8-10)
- [ ] Create CoachAnnouncementsStack navigator
- [ ] Redesign CoachAnnouncementsGlobal
- [ ] Create CoachAnnouncementForm screen
  - [ ] Image picker (multi-select)
  - [ ] Video link input
  - [ ] Preview functionality
- [ ] Implement announcement API calls
- [ ] Create announcement-related hooks
- [ ] Test create/edit/pin/delete flow

### Phase 5: Polish & Testing (Week 11-12)
- [ ] Add animations and transitions
- [ ] Improve loading states
- [ ] Add pull-to-refresh everywhere
- [ ] Add haptic feedback
- [ ] Accessibility improvements
- [ ] Performance optimization
- [ ] E2E testing for critical flows
- [ ] Bug fixes
- [ ] Documentation

---

## Design Mockups Reference

### Key Screens to Design First
1. Enhanced Dashboard
2. Weekly Sessions Calendar
3. Payment Management
4. Course List with Cards
5. Course Form (multiple sections)
6. Announcement Form with Media

### Design Tools
- Figma (recommended for mockups)
- Reference web version for consistency
- Test on both iOS and Android simulators

---

## Technical Considerations

### Navigation
- Use React Navigation 6
- Maintain tab navigation as root
- Use stack navigators for each section
- Handle deep linking (future)

### Forms
- Consider using `react-hook-form` for complex forms
- Input validation with `yup` or `zod`
- Form state persistence (if user navigates away)

### Images
- Use `expo-image-picker` for image selection
- Implement image cropping/resizing
- Optimize images before upload
- Handle multiple image uploads

### Performance
- Lazy load images
- Implement pagination for lists
- Use `FlatList` with proper optimization
- Memoize expensive computations
- Use `React.memo` for components

### Offline Support (Future Enhancement)
- Cache API responses
- Queue actions when offline
- Sync when back online

### Error Handling
- Global error boundary
- Specific error states per screen
- User-friendly error messages
- Retry mechanisms

---

## Testing Strategy

### Unit Tests
- Test hooks logic
- Test utility functions
- Test components in isolation

### Integration Tests
- Test API calls
- Test navigation flows
- Test form submissions

### E2E Tests (Priority Flows)
1. Coach login → Dashboard view
2. Mark attendance for today's session
3. Create new course
4. Edit existing course
5. Create announcement with images
6. Add/remove sessions for child

---

## Success Metrics

### Feature Parity
- ✅ All web features available in mobile
- ✅ UI consistency with web design

### Performance
- Screen load time < 2s
- Image upload < 5s
- Form submission < 1s (excluding upload)

### User Experience
- Intuitive navigation
- Minimal taps to complete tasks
- Clear feedback on actions
- Responsive UI (no janky animations)

---

## Future Enhancements (Post-MVP)

1. **Push Notifications**
   - New enrollments
   - Session reminders
   - Low session warnings

2. **Offline Mode**
   - View cached data
   - Queue actions

3. **Analytics Dashboard**
   - Attendance trends
   - Enrollment graphs
   - Revenue tracking

4. **Bulk Actions**
   - Mark attendance for multiple sessions
   - Bulk announcement creation

5. **Chat/Messaging**
   - Direct messages to parents
   - Group messages per course

6. **Calendar Integration**
   - Export sessions to device calendar
   - Sync with Google Calendar

---

## Conclusion

This redesign will bring the mobile coach experience to full parity with the web version while maintaining a mobile-first, intuitive interface. The phased implementation approach allows for iterative development and testing, ensuring quality at each stage.

Key priorities:
1. **Consistency** - Match web design system
2. **Completeness** - All web features available
3. **Usability** - Optimized for mobile interactions
4. **Performance** - Fast and responsive
5. **Reliability** - Robust error handling

By following this plan, the mobile app will become a powerful tool for coaches to manage their courses, sessions, and communication on the go.
