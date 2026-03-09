import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { LoadingIndicatorService } from '../../shared/services/loading-indicator.service';

@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
  private readonly loadingService = inject(LoadingIndicatorService);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    this.loadingService.requestStarted();
    return next.handle(req).pipe(finalize(() => this.loadingService.requestEnded()));
  }
}
