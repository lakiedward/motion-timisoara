import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CoachLocationsComponent } from './coach-locations.component';
import { LocationService, LocationDto } from '../../../../core/services/location.service';
import { AuthService } from '../../../../core/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('CoachLocationsComponent', () => {
  let component: CoachLocationsComponent;
  let fixture: ComponentFixture<CoachLocationsComponent>;
  let locationServiceSpy: jasmine.SpyObj<LocationService>;

  beforeEach(async () => {
    const locationSpy = jasmine.createSpyObj('LocationService', [
      'getCities', 
      'getRecentLocations', 
      'searchLocations', 
      'updateLocation',
      'getTypeLabel',
      'getTypeIcon'
    ]);
    const authSpy = jasmine.createSpyObj('AuthService', [], {
      currentUser$: of({ id: 'user-1', role: 'COACH' })
    });
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    const snackBarSpyObj = jasmine.createSpyObj('MatSnackBar', ['open']);
    const dialogSpy = jasmine.createSpyObj('MatDialog', ['open']);

    // Default mock returns
    locationSpy.getCities.and.returnValue(of(['City A']));
    locationSpy.getRecentLocations.and.returnValue(of([]));
    locationSpy.searchLocations.and.returnValue(of([]));
    locationSpy.getTypeLabel.and.returnValue('Label');
    locationSpy.getTypeIcon.and.returnValue('icon');

    await TestBed.configureTestingModule({
      imports: [CoachLocationsComponent, NoopAnimationsModule],
      providers: [
        { provide: LocationService, useValue: locationSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
        { provide: MatSnackBar, useValue: snackBarSpyObj },
        { provide: MatDialog, useValue: dialogSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CoachLocationsComponent);
    component = fixture.componentInstance;
    locationServiceSpy = TestBed.inject(LocationService) as jasmine.SpyObj<LocationService>;
    
    fixture.detectChanges(); // triggers ngOnInit -> loadPageData
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should update location state based on server response, not optimistic toggle', () => {
    // Arrange
    const internalSnackBar = (component as any).snackbar as MatSnackBar;
    const openSpy = spyOn(internalSnackBar, 'open').and.stub();

    const initialLocation: LocationDto = {
      id: 'loc-1',
      name: 'Test Location',
      type: 'GYM',
      isActive: true,
      createdByUserId: 'user-1'
    };
    
    // Set initial state manually to bypass loading logic for this specific test setup
    component.locations.set([initialLocation]);
    
    // Simulate server returning FALSE (inactive) even though we tried to toggle it (likely to false anyway, but let's be explicit)
    // If we toggle from true, nextActive is false.
    // If server returns false, UI should be false.
    // If server returns TRUE (ignoring our toggle), UI should be TRUE. This is the crucial test case.
    
    const serverResponse: LocationDto = { ...initialLocation, isActive: true }; // Server refuses to deactivate
    locationServiceSpy.updateLocation.and.returnValue(of(serverResponse));

    // Act
    component.toggleLocationStatus(initialLocation);

    // Assert
    expect(locationServiceSpy.updateLocation).toHaveBeenCalledWith('loc-1', { isActive: false });
    
    const updatedLocation = component.locations().find(l => l.id === 'loc-1');
    expect(updatedLocation?.isActive).toBe(true, 'UI should reflect server response (true), not the optimistic toggle (false)');
    
    expect(openSpy).toHaveBeenCalledWith(
      'Locație activată', 
      undefined, 
      jasmine.objectContaining({ duration: 2500 })
    );
  });

  it('should correctly handle undefined isActive from server (treating as active)', () => {
    // Arrange
    const internalSnackBar = (component as any).snackbar as MatSnackBar;
    const openSpy = spyOn(internalSnackBar, 'open').and.stub();

    const initialLocation: LocationDto = {
      id: 'loc-2',
      name: 'Test Location 2',
      type: 'GYM',
      isActive: false,
      createdByUserId: 'user-1'
    };
    component.locations.set([initialLocation]);

    // Server returns object without isActive property (meaning default/active)
    const serverResponse: LocationDto = { ...initialLocation };
    delete serverResponse.isActive; 
    
    locationServiceSpy.updateLocation.and.returnValue(of(serverResponse));

    // Act
    component.toggleLocationStatus(initialLocation);

    // Assert
    expect(locationServiceSpy.updateLocation).toHaveBeenCalledWith('loc-2', { isActive: true });
    
    const updatedLocation = component.locations().find(l => l.id === 'loc-2');
    expect(updatedLocation?.isActive).toBeTrue();
    
    // Verify snackbar message logic treats undefined as active
    expect(openSpy).toHaveBeenCalledWith(
      'Locație activată', 
      undefined, 
      jasmine.objectContaining({ duration: 2500 })
    );
  });
});

