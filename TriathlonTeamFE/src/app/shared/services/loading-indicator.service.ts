import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoadingIndicatorService {
  private readonly isLoadingSubject = new BehaviorSubject<boolean>(false);
  private pendingRequests = 0;
  private delayHandle: ReturnType<typeof setTimeout> | null = null;

  get isLoading$(): Observable<boolean> {
    return this.isLoadingSubject.asObservable();
  }

  requestStarted(): void {
    this.pendingRequests++;
    if (this.delayHandle) {
      return;
    }
    this.delayHandle = setTimeout(() => {
      if (this.pendingRequests > 0) {
        this.isLoadingSubject.next(true);
      }
    }, 200);
  }

  requestEnded(): void {
    this.pendingRequests = Math.max(0, this.pendingRequests - 1);
    if (this.pendingRequests === 0) {
      if (this.delayHandle) {
        clearTimeout(this.delayHandle);
        this.delayHandle = null;
      }
      this.isLoadingSubject.next(false);
    }
  }
}
