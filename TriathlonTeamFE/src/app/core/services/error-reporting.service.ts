import { Injectable, isDevMode } from '@angular/core';

export interface ErrorContext {
  component?: string;
  method?: string;
  /**
   * Additional metadata for debugging.
   * SENSITIVE DATA WARNING: Do NOT include raw PII (email, SSN, card numbers, etc.)
   * or high-cardinality data that isn't useful for grouping errors.
   * While the service performs defensive sanitization, callers should avoid sending sensitive data.
   * Non-sensitive context is acceptable.
   */
  metadata?: Record<string, unknown>;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorReportingService {
  /**
   * Captures an error and sends it to the monitoring service.
   * Currently logs to console in dev mode.
   * TODO: Integrate with Sentry/Azure Application Insights using approved context fields.
   */
  captureException(error: unknown, context?: ErrorContext): void {
    const err = error instanceof Error ? error : new Error(String(error));
    
    // Sanitize context before logging/sending
    const sanitizedContext = context ? this.sanitizeContext(context) : undefined;
    
    // In a real app, you would send this to Sentry/Azure/etc.
    // e.g. Sentry.captureException(err, { extra: sanitizedContext });
    
    if (isDevMode()) {
      // eslint-disable-next-line no-console
      console.error('[ErrorReportingService]', {
        error: err,
        context: sanitizedContext
      });
    }
  }

  private sanitizeContext(context: ErrorContext): ErrorContext {
    const sensitiveKeys = ['email', 'password', 'token', 'auth', 'ssn', 'card', 'cvv', 'paymentid', 'secret'];
    
    try {
      const sanitized: ErrorContext = { ...context };
      if (sanitized.metadata) {
        sanitized.metadata = this.sanitizeValue(sanitized.metadata, undefined, sensitiveKeys) as Record<string, unknown>;
      }
      return sanitized;
    } catch (error) {
      // Fallback in case of sanitization error to prevent breaking error reporting
      if (isDevMode()) {
        console.error('[ErrorReportingService] Error sanitizing context:', error);
      }
      return {
        ...context,
        metadata: { errorSanitization: '[REDACTED]' }
      };
    }
  }

  private sanitizeValue(value: unknown, key: string | undefined, sensitiveKeys: string[]): unknown {
    if (!value) return value;

    // Check key if provided (for top-level or recursive object properties)
    if (key && sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      return '[REDACTED]';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(item => this.sanitizeValue(item, undefined, sensitiveKeys));
    }

    if (typeof value === 'object') {
      const cleanObj: Record<string, unknown> = {};
      try {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          cleanObj[k] = this.sanitizeValue(v, k, sensitiveKeys);
        }
        return cleanObj;
      } catch (e) {
        // Handle circular references or access errors
        return '[Unable to sanitize object]';
      }
    }

    return value;
  }
}
