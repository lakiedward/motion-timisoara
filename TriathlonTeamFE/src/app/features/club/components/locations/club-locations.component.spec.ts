import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

import { ClubLocationsComponent } from './club-locations.component';
import { ClubLocation, ClubService } from '../../services/club.service';

describe('ClubLocationsComponent (mini toggle)', () => {
  async function setup() {
    const clubServiceStub: Partial<ClubService> = {
      getLocations: () => of([]),
      getCourses: () => of([]),
      updateLocation: () => of({} as any),
    };

    const matDialogStub: Partial<MatDialog> = {
      open: () =>
        ({
          afterClosed: () => of(false),
        }) as any,
    };

    const snackBarStub: Partial<MatSnackBar> = {
      open: () => undefined as any,
    };

    const routerStub: Partial<Router> = {
      navigate: () => Promise.resolve(true),
    };

    await TestBed.configureTestingModule({
      imports: [ClubLocationsComponent],
      providers: [
        { provide: ClubService, useValue: clubServiceStub },
        { provide: MatDialog, useValue: matDialogStub },
        { provide: MatSnackBar, useValue: snackBarStub },
        { provide: Router, useValue: routerStub },
        { provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ClubLocationsComponent);
    fixture.detectChanges(); // run ngOnInit with stubbed service calls
    return { fixture, clubService: TestBed.inject(ClubService) };
  }

  it('renders mini-toggle ON for active locations and OFF for inactive, with correct aria-label', async () => {
    const { fixture } = await setup();

    const active: ClubLocation = {
      id: 'loc-active',
      name: 'Active location',
      address: 'Str. A',
      city: 'Timisoara',
      isActive: true,
    };

    const inactive: ClubLocation = {
      id: 'loc-inactive',
      name: 'Inactive location',
      address: 'Str. B',
      city: 'Timisoara',
      isActive: false,
    };

    fixture.componentInstance.isLoading.set(false);
    fixture.componentInstance.locations.set([active, inactive]);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    const cards = Array.from(root.querySelectorAll<HTMLElement>('article.location-card'));
    expect(cards.length).toBe(2);

    const cardFor = (id: string) =>
      cards.find(c => (c.querySelector('.location-name')?.textContent ?? '').includes(id === 'loc-active' ? 'Active' : 'Inactive'))!;

    const activeCard = cardFor('loc-active');
    const inactiveCard = cardFor('loc-inactive');

    expect(activeCard.classList.contains('location-card--inactive')).toBeFalse();
    expect(inactiveCard.classList.contains('location-card--inactive')).toBeTrue();

    const toggles = Array.from(root.querySelectorAll<HTMLElement>('.mini-toggle'));
    expect(toggles.length).toBe(2);

    const toggleButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('button.action-btn[aria-label]'));
    expect(toggleButtons.length).toBe(2);

    // Active state: toggle is ON and aria-label is "mark as unavailable"
    const activeToggle = activeCard.querySelector<HTMLElement>('.mini-toggle');
    expect(activeToggle).withContext('active location should render mini-toggle').not.toBeNull();
    expect(activeToggle!.classList.contains('mini-toggle--on')).toBeTrue();
    expect(activeToggle!.classList.contains('mini-toggle--off')).toBeFalse();

    const activeBtn = activeCard.querySelector<HTMLButtonElement>('button.action-btn[aria-label]');
    expect(activeBtn).not.toBeNull();
    expect(activeBtn!.classList.contains('action-btn--success')).toBeTrue();
    expect(activeBtn!.getAttribute('aria-label')).toContain('Dezactivează locație');
    expect(activeBtn!.getAttribute('role')).toBe('switch');
    expect(activeBtn!.getAttribute('aria-checked')).toBe('true');

    // Inactive state: toggle is OFF and aria-label is "activate"
    const inactiveToggle = inactiveCard.querySelector<HTMLElement>('.mini-toggle');
    expect(inactiveToggle).withContext('inactive location should render mini-toggle').not.toBeNull();
    expect(inactiveToggle!.classList.contains('mini-toggle--on')).toBeFalse();
    expect(inactiveToggle!.classList.contains('mini-toggle--off')).toBeTrue();

    const inactiveBtn = inactiveCard.querySelector<HTMLButtonElement>('button.action-btn[aria-label]');
    expect(inactiveBtn).not.toBeNull();
    expect(inactiveBtn!.classList.contains('action-btn--warning')).toBeTrue();
    expect(inactiveBtn!.getAttribute('aria-label')).toContain('Activează locație');
    expect(inactiveBtn!.getAttribute('role')).toBe('switch');
    expect(inactiveBtn!.getAttribute('aria-checked')).toBe('false');
  });

  it('disables toggle button and prevents concurrent updates while updating', async () => {
    const { fixture, clubService } = await setup();
    const updateSubject = new Subject<ClubLocation>();
    spyOn(clubService, 'updateLocation').and.returnValue(updateSubject.asObservable());

    const location: ClubLocation = {
      id: 'loc-1',
      name: 'Test Location',
      isActive: false, // Start inactive so we toggle to active (simpler path, no dialog)
      address: 'Test Addr',
      city: 'Test City'
    };

    fixture.componentInstance.isLoading.set(false);
    fixture.componentInstance.locations.set([location]);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    const getToggleBtn = () => root.querySelector<HTMLButtonElement>('button.action-btn[role="switch"]');
    const getEditBtn = () => root.querySelector<HTMLButtonElement>('button.action-btn--edit');
    const getDeleteBtn = () => root.querySelector<HTMLButtonElement>('button.action-btn--delete');

    // Initial state: buttons enabled
    expect(getToggleBtn()?.disabled).toBeFalse();
    expect(getEditBtn()?.disabled).toBeFalse();
    expect(getDeleteBtn()?.disabled).toBeFalse();

    // Trigger update
    fixture.componentInstance.toggleLocationStatus(location);
    fixture.detectChanges();

    // State during update: buttons disabled
    expect(fixture.componentInstance.updatingLocationId()).toBe(location.id);
    expect(clubService.updateLocation).toHaveBeenCalledTimes(1);
    expect(getToggleBtn()?.disabled).toBeTrue();
    expect(getEditBtn()?.disabled).toBeTrue();
    expect(getDeleteBtn()?.disabled).toBeTrue();

    // Attempt second trigger (concurrency check)
    fixture.componentInstance.toggleLocationStatus(location);
    fixture.detectChanges();

    // Should still be 1 call
    expect(clubService.updateLocation).toHaveBeenCalledTimes(1);

    // Complete update
    updateSubject.next({ ...location, isActive: true });
    fixture.detectChanges();

    // Final state: updating cleared, buttons enabled
    expect(fixture.componentInstance.updatingLocationId()).toBeNull();
    expect(getToggleBtn()?.disabled).toBeFalse();
  });

  it('shows snackbar message based on server-returned updated.isActive (not client intended value)', async () => {
    const { fixture, clubService } = await setup();
    const internalSnackBar = (fixture.componentInstance as any).snackBar as MatSnackBar;
    const updateSubject = new Subject<ClubLocation>();
    spyOn(clubService, 'updateLocation').and.returnValue(updateSubject.asObservable());
    const snackSpy = spyOn(internalSnackBar, 'open').and.stub();

    const location: ClubLocation = {
      id: 'loc-1',
      name: 'Test Location',
      isActive: false, // client intends to activate (newStatus=true)
      address: 'Test Addr',
      city: 'Test City'
    };

    fixture.componentInstance.isLoading.set(false);
    fixture.componentInstance.locations.set([location]);
    fixture.detectChanges();

    fixture.componentInstance.toggleLocationStatus(location);
    fixture.detectChanges();
    expect(clubService.updateLocation).toHaveBeenCalledTimes(1);

    // Server responds with different value than requested (still inactive)
    updateSubject.next({ ...location, isActive: false });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(snackSpy).toHaveBeenCalled();
    const [message, action] = snackSpy.calls.mostRecent().args;
    expect(action).toBe('OK');
    expect(String(message)).toContain('dezactivată');
  });
});


