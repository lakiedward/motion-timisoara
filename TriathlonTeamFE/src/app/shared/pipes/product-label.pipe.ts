import { Pipe, PipeTransform } from '@angular/core';

/**
 * Interface for payment report rows that this pipe can transform.
 * Requires productName and kind properties.
 */
interface PaymentReportLike {
  productName: string | null;
  kind: 'COURSE' | 'CAMP' | 'ACTIVITY';
}

const KIND_LABELS: Record<string, string> = {
  COURSE: 'Curs',
  CAMP: 'Tabără',
  ACTIVITY: 'Activitate'
};

/**
 * Transforms a payment report row into a human-readable product label.
 * 
 * @example
 * // In template:
 * {{ payment | productLabel }}
 * 
 * // Returns productName if available, otherwise returns localized kind label:
 * // - 'COURSE' → 'Curs'
 * // - 'CAMP' → 'Tabără'
 * // - other → 'Activitate'
 */
@Pipe({
  name: 'productLabel',
  standalone: true,
  pure: true
})
export class ProductLabelPipe implements PipeTransform {
  transform(p: PaymentReportLike | null | undefined): string {
    if (!p) return '';
    return p.productName || KIND_LABELS[p.kind] || 'Activitate';
  }
}
