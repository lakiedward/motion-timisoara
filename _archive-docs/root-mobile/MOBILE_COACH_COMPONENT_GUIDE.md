# Mobile Coach - Component Design Guide

## Quick Reference

This document provides essential design patterns and component examples for the Coach mobile app.

---

## Theme Reference

### Colors
```typescript
primary: '#3b82f6'        success: '#10b981'
warning: '#f59e0b'        error: '#ef4444'
surface: '#ffffff'        background: '#f8fafc'
text: '#1e293b'          textMuted: '#64748b'
border: '#e2e8f0'
```

### Typography
```typescript
h1: { fontSize: 32, fontWeight: '700' }
h2: { fontSize: 24, fontWeight: '600' }
h3: { fontSize: 20, fontWeight: '600' }
body: { fontSize: 16, fontWeight: '400' }
caption: { fontSize: 12, fontWeight: '500' }
```

### Spacing
```typescript
xs: 4, sm: 8, md: 16, lg: 24, xl: 32
screenPadding: 16, cardPadding: 16
```

---

## Component Patterns

### 1. StatCard - Display Statistics
```typescript
<StatCard
  icon="school-outline"
  value={12}
  label="Total Cursuri"
  sublabel="8 active"
  color={colors.primary}
/>
```

**Key Features:**
- Icon with colored background circle
- Large value display
- Label and optional sublabel
- Card with shadow

---

### 2. SessionCard - Display Session Info
```typescript
<SessionCard
  courseName="Înotători Avansați"
  date="21 Nov 2025"
  time="10:00 - 11:30"
  enrolledCount={15}
  onMarkAttendance={() => navigate('Detail')}
/>
```

**Key Features:**
- Course name header
- Date, time, location with icons
- Enrolled count
- Primary + secondary action buttons

---

### 3. CourseCard - Full Course Display
```typescript
<CourseCard
  name="Înotători Avansați"
  sport="Înot"
  level="Avansat"
  heroImageUrl="..."
  active={true}
  onEdit={() => {}}
  onAnnouncements={() => {}}
/>
```

**Key Features:**
- Hero image or placeholder
- Course metadata (sport, level, location)
- Status badge (Active/Inactive)
- Multiple action buttons

---

### 4. AnnouncementCard
```typescript
<AnnouncementCard
  courseName="Înotători Avansați"
  title="Schimbare program"
  pinned={true}
  hasImages={true}
  onPin={() => {}}
  onEdit={() => {}}
/>
```

**Key Features:**
- Pinned banner (if pinned)
- Course name badge
- Title and content preview
- Media indicators
- Multiple actions

---

## Form Components

### FormTextInput
```typescript
<FormTextInput
  label="Nume Curs"
  value={name}
  onChangeText={setName}
  required={true}
  maxLength={100}
  error={errors.name}
/>
```

### FormDropdown
```typescript
<FormDropdown
  label="Sport"
  value={sport}
  options={sportOptions}
  onSelect={setSport}
  required={true}
/>
```

---

## Loading & Empty States

### LoadingState
```typescript
<LoadingState message="Se încarcă cursurile..." />
```

### EmptyState
```typescript
<EmptyState
  icon="school-outline"
  message="Nu există cursuri încă"
  actionLabel="Adaugă Curs"
  onAction={() => navigate('Create')}
/>
```

### ErrorState
```typescript
<ErrorState
  message="Nu am putut încărca datele"
  onRetry={() => reload()}
/>
```

---

## Button Styles

### Primary Button
```typescript
style={{
  backgroundColor: colors.primary,
  paddingVertical: 12,
  paddingHorizontal: 24,
  borderRadius: 8,
}}
```

### Secondary Button
```typescript
style={{
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  paddingVertical: 12,
  paddingHorizontal: 24,
  borderRadius: 8,
}}
```

---

## Layout Patterns

### Screen with ScrollView
```typescript
<ScrollView style={styles.container}>
  <View style={styles.content}>
    {/* Content here */}
  </View>
</ScrollView>

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenPadding },
});
```

### Grid Layout (2 columns)
```typescript
<View style={styles.grid}>
  <StatCard {...} />
  <StatCard {...} />
</View>

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
```

---

## Best Practices

1. **Always use theme values** - Never hardcode colors, spacing, or typography
2. **Add proper TypeScript types** - Define props interfaces
3. **Include loading/error states** - Handle all API call states
4. **Add accessibility labels** - Use `accessibilityLabel` prop
5. **Optimize images** - Use appropriate sizes and compression
6. **Test on both iOS/Android** - Ensure consistent behavior

---

## File Structure
```
components/
├── coach/
│   ├── StatCard.tsx
│   ├── SessionCard.tsx
│   ├── CourseCard.tsx
│   ├── AnnouncementCard.tsx
│   ├── AlertCard.tsx
│   ├── LoadingState.tsx
│   ├── EmptyState.tsx
│   ├── ErrorState.tsx
│   └── forms/
│       ├── FormTextInput.tsx
│       ├── FormDropdown.tsx
│       ├── FormNumberInput.tsx
│       └── FormImagePicker.tsx
```

---

## Next Steps

1. Review `MOBILE_COACH_REDESIGN_PLAN.md` for full implementation plan
2. Follow `MOBILE_COACH_IMPLEMENTATION_CHECKLIST.md` for task tracking
3. Reference web components in `TriathlonTeamFE/src/app/features/coach`
4. Start with Phase 1: Foundation & Dashboard

---

For detailed component implementations, see the web version at:
`TriathlonTeamFE/src/app/features/coach/components`
