import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useParentPayments } from '../hooks/useParentPayments';
import { colors, radii, shadows, spacing } from '../../../../config/theme';
import type { ParentEnrollmentDto, ParentPaymentDto } from '../../../../api/parentPaymentsApi';

const formatCurrency = (amount: number, currency: string | null): string => {
  try {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: currency || 'RON',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency || 'RON'}`;
  }
};

const ParentPaymentsOverviewScreen: React.FC = () => {
  const { overview, loading, error, reload } = useParentPayments();

  const enrollments: ParentEnrollmentDto[] = overview?.enrollments ?? [];
  const payments: ParentPaymentDto[] = overview?.payments ?? [];

  const activeEnrollments = useMemo(
    () => enrollments.filter((e) => e.status === 'ACTIVE'),
    [enrollments],
  );

  const unpaidEnrollments = useMemo(
    () =>
      enrollments.filter(
        (e) => e.paymentStatus && e.paymentStatus !== 'PAID' && e.paymentStatus !== 'SUCCEEDED',
      ),
    [enrollments],
  );

  const latestPayment = useMemo(() => {
    if (!payments.length) return null;
    const sorted = [...payments].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    return sorted[0];
  }, [payments]);

  if (loading && !overview) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
        <Text style={styles.link} onPress={reload}>
          Reîncearcă
        </Text>
      </View>
    );
  }

  if (!overview) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>Nu s-a putut încărca situația plăților.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Situație plăți</Text>
        <Text style={styles.summarySubtitle}>
          Vezi rapid statusul înscrierilor și istoricul plăților tale.
        </Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryPillLabel}>Înscrieri active</Text>
            <Text style={styles.summaryPillValue}>{activeEnrollments.length}</Text>
          </View>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryPillLabel}>Înscrieri cu plată în așteptare</Text>
            <Text style={styles.summaryPillValue}>{unpaidEnrollments.length}</Text>
          </View>
        </View>
        {latestPayment ? (
          <View style={styles.latestPaymentBlock}>
            <Text style={styles.latestPaymentLabel}>Ultima plată</Text>
            <Text style={styles.latestPaymentValue}>
              {formatCurrency(latestPayment.amount, latestPayment.currency)} ·{' '}
              {new Date(latestPayment.date).toLocaleDateString('ro-RO')}
            </Text>
            <Text style={styles.latestPaymentMeta}>{latestPayment.description}</Text>
          </View>
        ) : null}
      </View>

      {enrollments.length > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Înscrieri & plăți</Text>
            <Text style={styles.sectionSubtitle}>
              Statusul plăților pentru fiecare înscriere.
            </Text>
          </View>
          {enrollments.map((enr) => (
            <View key={enr.id} style={styles.enrollmentCard}>
              <Text style={styles.enrollmentTitle}>{enr.title}</Text>
              <Text style={styles.enrollmentMeta}>
                {enr.childName ? `${enr.childName} · ` : ''}
                {enr.period ?? 'Perioadă nespecificată'}
              </Text>
              {enr.location ? (
                <Text style={styles.enrollmentMeta}>Locație: {enr.location}</Text>
              ) : null}
              {enr.paymentAmount != null && enr.paymentCurrency ? (
                <Text style={styles.enrollmentMeta}>
                  Sumă: {formatCurrency(enr.paymentAmount, enr.paymentCurrency)}
                </Text>
              ) : null}
              <View style={styles.statusRow}>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{enr.statusLabel}</Text>
                </View>
                {enr.paymentStatusLabel ? (
                  <View style={styles.paymentStatusBadge}>
                    <Text style={styles.paymentStatusText}>{enr.paymentStatusLabel}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}

      {payments.length > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Istoric plăți</Text>
            <Text style={styles.sectionSubtitle}>
              Toate plățile înregistrate pentru contul tău.
            </Text>
          </View>
          {payments.map((p) => {
            const d = new Date(p.date);
            return (
              <View key={p.id} style={styles.paymentCard}>
                <View style={styles.paymentMain}>
                  <Text style={styles.paymentAmount}>
                    {formatCurrency(p.amount, p.currency)}
                  </Text>
                  <Text style={styles.paymentDescription}>{p.description}</Text>
                </View>
                <View style={styles.paymentSide}>
                  <Text style={styles.paymentMeta}>
                    {p.method} · {p.statusLabel}
                  </Text>
                  <Text style={styles.paymentDate}>{d.toLocaleDateString('ro-RO')}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {payments.length === 0 && enrollments.length === 0 && (
        <View style={styles.sectionCard}>
          <Text style={styles.empty}>Nu există încă plăți sau înscrieri pentru acest cont.</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.screenPadding,
    paddingBottom: 96,
  },
  summaryCard: {
    padding: 16,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    marginBottom: spacing.cardGap,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  summaryRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  summaryPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radii.small,
    backgroundColor: '#eff6ff',
    marginRight: 8,
  },
  summaryPillLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  summaryPillValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  latestPaymentBlock: {
    marginTop: 12,
  },
  latestPaymentLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  latestPaymentValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  latestPaymentMeta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  sectionCard: {
    padding: 14,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    marginBottom: spacing.cardGap,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  sectionHeader: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  enrollmentCard: {
    marginTop: 8,
  },
  enrollmentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  enrollmentMeta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  statusRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: '#e5e7eb',
    marginRight: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  paymentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: '#dbeafe',
  },
  paymentStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  paymentCard: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  paymentMain: {
    flex: 1,
    marginRight: 8,
  },
  paymentSide: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  paymentDescription: {
    fontSize: 13,
    color: colors.textMuted,
  },
  paymentMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  paymentDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  empty: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 8,
  },
  link: {
    color: colors.primary,
    marginTop: 4,
  },
});

export default ParentPaymentsOverviewScreen;
