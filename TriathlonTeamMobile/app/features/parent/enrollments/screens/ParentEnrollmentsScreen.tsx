import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { useParentEnrollments } from '../hooks/useParentEnrollments';
import { colors, radii, shadows, spacing } from '../../../../config/theme';

const formatCurrencyRON = (amount: number): string => {
  try {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} RON`;
  }
};

const ParentEnrollmentsScreen: React.FC = () => {
  const { items, loading, error, reload, cancel, purchaseCashSessions, payWithCard, submittingEnrollmentId } =
    useParentEnrollments();

  if (loading && items.length === 0) {
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

  if (items.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>Nu există încă înscrieri pentru acest cont.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isPending = item.status === 'PENDING';
          const isCourse = item.kind === 'COURSE';
          const isActive = item.status === 'ACTIVE';
          const payment = item.payment;
          const isSubmitting = submittingEnrollmentId === item.id;

          return (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.titleArea}>
                  <Text style={styles.title}>{item.entity?.name ?? 'Fără nume'}</Text>
                  <Text style={styles.meta}>Copil: {item.child.name}</Text>
                </View>
                <View style={styles.badgesRow}>
                  <View style={[styles.badge, isCourse ? styles.badgeCourse : styles.badgeCamp]}>
                    <Text style={styles.badgeText}>{isCourse ? 'Curs' : 'Tabără'}</Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      styles.statusBadge,
                      isActive
                        ? styles.statusActive
                        : isPending
                        ? styles.statusPending
                        : styles.statusOther,
                    ]}
                  >
                    <Text style={styles.badgeText}>{item.status}</Text>
                  </View>
                </View>
              </View>
              {payment ? (
                <View style={styles.paymentBlock}>
                  <Text style={styles.meta}>Plată: {payment.method}</Text>
                  <Text style={styles.meta}>Status plată: {payment.status}</Text>
                  <Text style={styles.meta}>
                    Suma: {formatCurrencyRON(payment.amount)}
                  </Text>
                </View>
              ) : null}
              {isCourse ? (
                <View style={styles.sessionsRow}>
                  <Text style={styles.meta}>
                    Ședințe: cumpărate {item.purchasedSessions} / rămase {item.remainingSessions} / folosite{' '}
                    {item.sessionsUsed}
                  </Text>
                </View>
              ) : null}

              <View style={styles.actionsRow}>
                {isPending ? (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionSecondary]}
                    onPress={() => cancel(item.id)}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.actionButtonText}>Anulează</Text>
                  </TouchableOpacity>
                ) : null}
                {isPending && payment?.method === 'CARD' && payment.status === 'PENDING' ? (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionPrimary]}
                    onPress={() => payWithCard(item.id)}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.actionButtonText}>Plătește cu cardul</Text>
                  </TouchableOpacity>
                ) : null}
                {isCourse && isActive ? (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionOutline]}
                    onPress={() => purchaseCashSessions(item.id, 4)}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.actionButtonText}>+4 ședințe (cash)</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        }}
        refreshing={loading}
        onRefresh={reload}
      />
    </View>
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
  listContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
    paddingBottom: 96,
  },
  card: {
    padding: 14,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    marginBottom: spacing.cardGap,
    ...shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  titleArea: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
    color: colors.text,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  badgesRow: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    marginLeft: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  badgeCourse: {
    backgroundColor: '#dbeafe',
  },
  badgeCamp: {
    backgroundColor: '#dcfce7',
  },
  statusBadge: {
    backgroundColor: '#fee2e2',
  },
  statusActive: {
    backgroundColor: '#dcfce7',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
  },
  statusOther: {
    backgroundColor: '#e5e7eb',
  },
  paymentBlock: {
    marginTop: 6,
  },
  sessionsRow: {
    marginTop: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  actionButton: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    marginLeft: 8,
    marginTop: 4,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  actionPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionSecondary: {
    backgroundColor: 'transparent',
  },
  actionOutline: {
    borderColor: colors.primary,
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

export default ParentEnrollmentsScreen;
