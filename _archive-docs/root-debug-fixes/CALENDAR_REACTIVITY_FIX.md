# Fix: Calendar Events Not Displaying on Initial Load

**Date**: October 21, 2025  
**Status**: ✅ Fixed  
**Priority**: 🟡 Medium  
**Component**: Frontend - Calendar Component

---

## Problem Description

### User Report

On the account dashboard (`http://localhost:4200/account`), the calendar does not display events (courses/camps) on initial load. The events only appear after navigating to a different month and then returning to the current month.

### Symptoms

1. Load `/account` page → Calendar is empty
2. Click "Previous Month" or "Next Month" button
3. Click back to current month → Events now appear ✅

### Root Cause

**Reactivity Issue with Angular Signals**

In `calendar.component.ts`:

```typescript
// BEFORE - NOT REACTIVE
@Input() events: CalendarEvent[] = [];

readonly calendarDays = computed<CalendarDay[]>(() => {
  const current = this.currentDate();
  // ...
  events: this.getEventsForDate(date)  // ❌ Uses this.events (not reactive)
});

private getEventsForDate(date: Date): CalendarEvent[] {
  return this.events.filter(...);  // ❌ this.events is not a signal
}
```

**The Problem:**

1. `@Input() events` is a plain array, **NOT a signal**
2. `calendarDays` is a `computed` signal that depends on `currentDate()` signal
3. When `events` changes from the parent component, **computed doesn't know to re-evaluate** because there's no reactive dependency
4. When user navigates months, `currentDate()` changes → triggers re-computation → uses updated `this.events`

This is why navigating months "fixes" the display - it forces a re-computation.

---

## Technical Analysis

### Angular Signals Reactivity

Angular's `computed()` creates a **reactive computation** that:
- Automatically tracks which signals are accessed during computation
- Re-runs when any tracked signal changes
- **Only tracks signal reads, not plain property access**

### The Missing Link

```typescript
readonly calendarDays = computed(() => {
  const current = this.currentDate();  // ✅ Tracked (signal)
  // ...
  this.getEventsForDate(date);  // ❌ Not tracked (plain array)
});
```

The computed signal tracks `currentDate()` but not `events` because `events` is not a signal.

---

## Solution Implemented

### Convert @Input to Signal via Setter

```typescript
// Accept events as input and sync to signal for reactivity
@Input() set events(value: CalendarEvent[]) {
  this.eventsSignal.set(value);
}

readonly eventsSignal = signal<CalendarEvent[]>([]);
```

**How it works:**
1. Parent component sets `[events]="calendarEvents()"` binding
2. Input setter is called with new value
3. Setter updates `eventsSignal` signal
4. All computed signals that read `eventsSignal()` are notified
5. Calendar re-renders with new events ✅

### Update Computed to Use Signal

```typescript
readonly calendarDays = computed<CalendarDay[]>(() => {
  const current = this.currentDate();
  const events = this.eventsSignal();  // ✅ Create reactive dependency
  
  // ... calendar logic
  events: this.getEventsForDate(date, events)
});
```

**Key change:**
- `const events = this.eventsSignal()` - **Reading the signal creates a reactive dependency**
- Pass `events` explicitly to `getEventsForDate()` to avoid accessing `this.events`

### Update Helper Method

```typescript
private getEventsForDate(date: Date, events: CalendarEvent[]): CalendarEvent[] {
  return events.filter((event) => this.isSameDay(event.date, date));
}
```

**Changes:**
- Added `events` parameter (passed from computed)
- Removed dependency on `this.events` instance property

### Update All Computed Signals

```typescript
readonly selectedDayEvents = computed(() => {
  const selected = this.selectedDate();
  if (!selected) return [];
  const events = this.eventsSignal();  // ✅ Reactive dependency
  return this.getEventsForDate(selected, events);
});
```

---

## Benefits

### ✅ Immediate Display
- Events display correctly on initial page load
- No need to navigate months to trigger display

### ✅ Full Reactivity
- Calendar updates automatically when parent changes `calendarEvents()`
- Follows Angular signals best practices

### ✅ Better Performance
- Only re-computes when actual dependencies change
- Avoids unnecessary re-renders

### ✅ Maintainable Code
- Clear reactive dependencies
- Explicit signal tracking
- Easier to debug

---

## Testing

### Test Case 1: Initial Load
1. Navigate to `/account`
2. **Expected**: Calendar displays events immediately (if any exist in current month)

### Test Case 2: Parent Data Update
1. On `/account` page
2. Wait for `calendarEvents()` signal to load from API
3. **Expected**: Calendar updates automatically with events

### Test Case 3: Month Navigation
1. Click "Next Month"
2. **Expected**: Events for next month display correctly
3. Click "Previous Month"
4. **Expected**: Events for current month still display

### Test Case 4: No Events
1. Navigate to a month with no events
2. **Expected**: Calendar displays empty (no errors)

---

## Related Files Modified

- `TriathlonTeamFE/src/app/features/account/components/calendar/calendar.component.ts`
  - Lines 31-36: Added input setter and eventsSignal
  - Lines 58-113: Updated calendarDays computed to use eventsSignal
  - Lines 120-125: Updated selectedDayEvents computed
  - Line 129: Updated ngOnInit to use eventsSignal
  - Line 163-165: Updated getEventsForDate signature

## Parent Components Using Calendar

- `TriathlonTeamFE/src/app/features/account/components/dashboard/parent-dashboard.component.ts`
  - Line 103: `<app-calendar [events]="calendarEvents()"></app-calendar>`
  - Line 71: `readonly calendarEvents = signal<CalendarEvent[]>([]);`

---

## Angular Signals Best Practices

### ✅ DO: Convert @Input to Signal for Computed Reactivity

```typescript
@Input() set myInput(value: T) {
  this.myInputSignal.set(value);
}
readonly myInputSignal = signal<T>(defaultValue);
```

### ❌ DON'T: Use Plain @Input in Computed

```typescript
@Input() myInput: T;  // ❌ Not reactive

readonly computed = computed(() => {
  return this.myInput;  // ❌ Won't trigger re-computation
});
```

### ✅ DO: Read Signals Inside Computed

```typescript
readonly computed = computed(() => {
  const value = this.mySignal();  // ✅ Creates reactive dependency
  return processValue(value);
});
```

### ❌ DON'T: Use Instance Properties in Computed

```typescript
readonly computed = computed(() => {
  return this.myArray.filter(...);  // ❌ Not reactive
});
```

---

## Prevention

### Code Review Checklist

When using Angular signals with `@Input`:

- [ ] Is the @Input used inside a `computed()` or `effect()`?
- [ ] If yes, is the @Input converted to a signal via setter?
- [ ] Are all signal dependencies explicitly read with `()`?
- [ ] Are there no plain property accesses inside computed?

### Linting Rules

Consider adding ESLint rules:
- Warn on `@Input` used directly in `computed()`
- Require signal conversion pattern for reactive inputs

---

## Deployment Notes

This is a **non-breaking change**:
- No API changes
- No backend changes
- Parent components continue to work (input binding unchanged)
- Improves UX for all calendar users

---

## Conclusion

This fix resolves a common Angular signals reactivity issue where `@Input` properties are not reactive within `computed()` contexts. By converting the input to a signal via a setter, we maintain full reactivity while preserving the component's public API.

The solution follows Angular's recommended patterns and improves the user experience by displaying events immediately on page load.



