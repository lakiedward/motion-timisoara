import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/auth';
import { catchError, map, of } from 'rxjs';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredRoles = (route.data['roles'] as Role[]) || [];
  if (requiredRoles.length === 0) {
    return true;
  }

  const evaluate = () => {
    const currentUser = authService.getCurrentUser();
    const userRole = currentUser?.role as Role | undefined;
    const hasRole = !!userRole && requiredRoles.includes(userRole);
    return hasRole ? true : router.createUrlTree(['/']);
  };

  // If we already have a user, evaluate immediately
  if (authService.getCurrentUser()) {
    return evaluate();
  }

  // Attempt to restore the session before deciding
  return authService.me().pipe(
    map(() => evaluate()),
    catchError(() => of(router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })))
  );
};