import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number; // in milliseconds, 0 means persistent
  action?: {
    label: string;
    callback: () => void;
  };
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private toastsSubject = new Subject<Toast[]>();
  private toasts: Toast[] = [];

  toasts$: Observable<Toast[]> = this.toastsSubject.asObservable();

  constructor() {}

  show(toast: Omit<Toast, 'id'>): string {
    const id = this.generateId();
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000 // Default 5 seconds
    };

    this.toasts.push(newToast);
    this.toastsSubject.next([...this.toasts]);

    // Auto-remove after duration (if not persistent)
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, newToast.duration);
    }

    return id;
  }

  success(title: string, message: string, options?: Partial<Toast>): string {
    return this.show({
      type: 'success',
      title,
      message,
      ...options
    });
  }

  error(title: string, message: string, options?: Partial<Toast>): string {
    return this.show({
      type: 'error',
      title,
      message,
      duration: 0, // Persistent by default for errors
      ...options
    });
  }

  warning(title: string, message: string, options?: Partial<Toast>): string {
    return this.show({
      type: 'warning',
      title,
      message,
      ...options
    });
  }

  info(title: string, message: string, options?: Partial<Toast>): string {
    return this.show({
      type: 'info',
      title,
      message,
      ...options
    });
  }

  remove(id: string): void {
    this.toasts = this.toasts.filter(toast => toast.id !== id);
    this.toastsSubject.next([...this.toasts]);
  }

  clear(): void {
    this.toasts = [];
    this.toastsSubject.next([]);
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
