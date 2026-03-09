import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { of, catchError, map } from 'rxjs';

export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (authService.isLoggedIn()) {
    return true;
  }
  // Try to restore session on hard reloads before deciding
  return authService.me().pipe(
    map(() => true),
    catchError(() =>
      of(router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }))
    )
  );
};
