import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { ParentTabsParamList } from '../../../navigation/ParentTabsNavigator';
import { useAuth } from '../../../store/AuthContext';
import { useChildren } from '../children/hooks/useChildren';
import { useParentSchedule } from '../schedule/hooks/useParentSchedule';
import { useParentAnnouncementsFeed } from '../announcements/hooks/useParentAnnouncementsFeed';
import { useParentEnrollments } from '../enrollments/hooks/useParentEnrollments';
import { colors, radii, shadows, spacing } from '../../../config/theme';

import type { ParentCalendarEventDto } from '../../../api/parentScheduleApi';
import type { AnnouncementDto } from '../../../api/parentAnnouncementsApi';

type NavProp = BottomTabNavigationProp<ParentTabsParamList, 'Home'>;

const isSameDay = (a: Date, b: Date): boolean => {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
};

const addDays = (date: Date, days: number): Date => {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
};

const formatHour = (date: Date | null, fallback: string | null): string | null => {
  if (date) {
    return date.toLocaleTimeString('ro-RO', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (fallback) {
    return fallback.substring(0, 5);
  }
  return null;
};

const formatFriendlyWhen = (event: ParentCalendarEventDto | null): string | null => {
  if (!event) return null;
  const eventDate = new Date(event.date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

  const diffMs = eventDay.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'astăzi';
  if (diffDays === 1) return 'mâine';
  if (diffDays > 1 && diffDays <= 7) {
    return `în ${diffDays} zile`;
  }
  return null;
};

const formatDateShort = (d: Date): string => {
  return d.toLocaleDateString('ro-RO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

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

const HomeParentScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();

  const { children, loading: loadingChildren } = useChildren();
  const { events, loading: loadingSchedule } = useParentSchedule();
  const { items: announcements, loading: loadingAnnouncements } = useParentAnnouncementsFeed();
  const { items: enrollments, loading: loadingEnrollments } = useParentEnrollments();

  const nextEvent = useMemo<ParentCalendarEventDto | null>(() => {
    if (!events.length) return null;
    const sorted = [...events].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    return sorted[0] ?? null;
  }, [events]);

  const scheduleSummary = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekEnd = addDays(today, 7);

    let todayCount = 0;
    let weekCount = 0;
    const sampleUpcoming: ParentCalendarEventDto[] = [];

    for (const ev of events) {
      const d = new Date(ev.date);
      const dayOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());

      if (dayOnly >= today && dayOnly <= weekEnd) {
        weekCount += 1;
        if (sampleUpcoming.length < 3) {
          sampleUpcoming.push(ev);
        }
      }
      if (isSameDay(dayOnly, today)) {
        todayCount += 1;
      }
    }

    return { todayCount, weekCount, sampleUpcoming };
  }, [events]);

  const childrenSummary = useMemo(
    () => {
      return children.map((child) => {
        const activeEnrollments = enrollments.filter(
          (enr) => enr.child.id === child.id && enr.status === 'ACTIVE',
        );
        const remainingSessions = activeEnrollments.reduce(
          (sum, enr) => sum + (enr.remainingSessions ?? 0),
          0,
        );
        return { child, remainingSessions };
      });
    },
    [children, enrollments],
  );

  const actionableSummary = useMemo(() => {
    let pendingCash = 0;
    let pendingCard = 0;
    let pendingEnrollments = 0;

    enrollments.forEach((enr) => {
      const payment = enr.payment;
      if (enr.status === 'PENDING') {
        pendingEnrollments += 1;
      }
      if (payment?.status === 'PENDING') {
        if (payment.method === 'CASH') pendingCash += 1;
        if (payment.method === 'CARD') pendingCard += 1;
      }
    });

    return { pendingCash, pendingCard, pendingEnrollments };
  }, [enrollments]);

  const latestPayments = useMemo(
    () => {
      const withPayment: {
        id: string;
        amount: number;
        method: string;
        status: string;
        createdAt: string;
        entityName: string | null;
      }[] = [];

      enrollments.forEach((enr) => {
        if (!enr.payment) return;
        withPayment.push({
          id: enr.payment.id,
          amount: enr.payment.amount,
          method: enr.payment.method,
          status: enr.payment.status,
          createdAt: enr.payment.createdAt,
          entityName: enr.entity?.name ?? null,
        });
      });

      withPayment.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      return withPayment.slice(0, 2);
    },
    [enrollments],
  );

  const latestAnnouncements = useMemo<AnnouncementDto[]>(() => {
    if (!announcements.length) return [];
    const sorted = [...announcements].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return sorted.slice(0, 3);
  }, [announcements]);

  const hasGlobalLoading =
    loadingChildren && loadingSchedule && loadingAnnouncements && loadingEnrollments;

  if (hasGlobalLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const parentName = user?.name ?? 'Părinte';
  const childrenCount = children.length;

  const nextEventDate = nextEvent ? new Date(nextEvent.date) : null;
  const nextEventHour = formatHour(nextEventDate, nextEvent?.time ?? null);
  const nextEventWhen = formatFriendlyWhen(nextEvent);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Bine ai venit</Text>
        <Text style={styles.heroTitle}>{parentName}</Text>
        <Text style={styles.heroSubtitle}>
          Gestionează într-un singur loc copiii, înscrierile, plățile și orarul.
        </Text>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatChip}>
            <Text style={styles.heroStatLabel}>Copii înscriși</Text>
            <Text style={styles.heroStatValue}>{childrenCount}</Text>
          </View>
          <View style={styles.heroStatChip}>
            <Text style={styles.heroStatLabel}>Ședințe săptămâna asta</Text>
            <Text style={styles.heroStatValue}>{scheduleSummary.weekCount}</Text>
          </View>
        </View>

        {nextEvent ? (
          <View style={styles.nextSessionCard}>
            <View style={styles.nextSessionHeaderRow}>
              <Text style={styles.nextSessionLabel}>Următoarea ședință</Text>
              {nextEventWhen ? (
                <Text style={styles.nextSessionWhen}>{nextEventWhen}</Text>
              ) : null}
            </View>
            <Text style={styles.nextSessionTitle}>{nextEvent.title}</Text>
            <Text style={styles.nextSessionMeta}>
              {nextEvent.childName ? `${nextEvent.childName} · ` : ''}
              {nextEventDate ? formatDateShort(nextEventDate) : ''}
              {nextEventHour ? ` · ${nextEventHour}` : ''}
            </Text>
            {nextEvent.location ? (
              <Text style={styles.nextSessionMeta}>Locație: {nextEvent.location}</Text>
            ) : null}
            <TouchableOpacity
              style={styles.nextSessionCta}
              onPress={() => navigation.navigate('Schedule')}
            >
              <Text style={styles.nextSessionCtaText}>Vezi orarul complet</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {(actionableSummary.pendingCash > 0 ||
        actionableSummary.pendingCard > 0 ||
        actionableSummary.pendingEnrollments > 0) && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>De făcut acum</Text>
            <Text style={styles.sectionSubtitle}>Rezolvă rapid lucrurile urgente</Text>
          </View>
          <View style={styles.pillsRow}>
            {actionableSummary.pendingEnrollments > 0 && (
              <View style={[styles.pillBase, styles.pillNeutral]}>
                <Text style={styles.pillText}>
                  {actionableSummary.pendingEnrollments} înscrieri în așteptare
                </Text>
              </View>
            )}
            {actionableSummary.pendingCash > 0 && (
              <View style={[styles.pillBase, styles.pillWarning]}>
                <Text style={styles.pillText}>
                  {actionableSummary.pendingCash} plăți cash de confirmat
                </Text>
              </View>
            )}
            {actionableSummary.pendingCard > 0 && (
              <View style={[styles.pillBase, styles.pillAccent]}>
                <Text style={styles.pillText}>
                  {actionableSummary.pendingCard} plăți card nefinalizate
                </Text>
              </View>
            )}
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Enrollments')}
            >
              <Text style={styles.primaryButtonText}>Gestionează înscrieri & plăți</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Acțiuni rapide</Text>
          <Text style={styles.sectionSubtitle}>Intră direct în secțiunile principale</Text>
        </View>
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('Children')}
          >
            <Text style={styles.quickActionLabel}>Copiii mei</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('Enrollments')}
          >
            <Text style={styles.quickActionLabel}>Înscrieri & plăți</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('Schedule')}
          >
            <Text style={styles.quickActionLabel}>Orar complet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('Announcements')}
          >
            <Text style={styles.quickActionLabel}>Anunțuri</Text>
          </TouchableOpacity>
        </View>
      </View>

      {childrenSummary.length > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Copiii tăi</Text>
            <Text style={styles.sectionSubtitle}>Vezi rapid situația fiecărui copil</Text>
          </View>
          <View style={styles.childrenRow}>
            {childrenSummary.slice(0, 3).map(({ child, remainingSessions }) => (
              <View key={child.id} style={styles.childCard}>
                <View style={styles.childAvatar}>
                  <Text style={styles.childAvatarText}>
                    {child.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.childName}>{child.name}</Text>
                {child.level ? (
                  <Text style={styles.childMeta}>Nivel: {child.level}</Text>
                ) : null}
                <Text style={styles.childMeta}>
                  Ședințe rămase: {remainingSessions}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {latestAnnouncements.length > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Anunțuri noi</Text>
            <Text style={styles.sectionSubtitle}>Noutăți din ultimele zile</Text>
          </View>
          {latestAnnouncements.map((ann) => {
            const created = new Date(ann.createdAt);
            const sevenDaysAgo = addDays(new Date(), -7);
            const isNew = created >= sevenDaysAgo;
            return (
              <View key={ann.id} style={styles.announcementItem}>
                <View style={styles.announcementHeaderRow}>
                  <Text style={styles.announcementCourse}>
                    {ann.courseName ?? 'Anunț general'}
                  </Text>
                  {isNew ? <Text style={styles.badgeNew}>Nou</Text> : null}
                </View>
                <Text style={styles.announcementMeta}>
                  {created.toLocaleDateString('ro-RO')}
                  {` · ${ann.authorName}`}
                </Text>
                <Text
                  style={styles.announcementContent}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {ann.content}
                </Text>
              </View>
            );
          })}
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Announcements')}
          >
            <Text style={styles.linkButtonText}>Vezi toate anunțurile</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Săptămâna aceasta</Text>
          <Text style={styles.sectionSubtitle}>Rezumat rapid al ședințelor</Text>
        </View>
        <View style={styles.weekSummaryRow}>
          <View style={styles.weekSummaryPill}>
            <Text style={styles.weekSummaryLabel}>Astăzi</Text>
            <Text style={styles.weekSummaryValue}>{scheduleSummary.todayCount}</Text>
          </View>
          <View style={styles.weekSummaryPill}>
            <Text style={styles.weekSummaryLabel}>În 7 zile</Text>
            <Text style={styles.weekSummaryValue}>{scheduleSummary.weekCount}</Text>
          </View>
        </View>
        {scheduleSummary.sampleUpcoming.length > 0 && (
          <View style={styles.weekUpcomingList}>
            {scheduleSummary.sampleUpcoming.map((ev) => {
              const d = new Date(ev.date);
              const hour = formatHour(d, ev.time ?? null);
              return (
                <View key={ev.id} style={styles.weekUpcomingItem}>
                  <View style={styles.weekUpcomingMain}>
                    <Text style={styles.weekUpcomingTitle}>{ev.title}</Text>
                    <Text style={styles.weekUpcomingMeta}>
                      {ev.childName ? `${ev.childName} · ` : ''}
                      {formatDateShort(d)}
                      {hour ? ` · ${hour}` : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {latestPayments.length > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Ultimele plăți</Text>
            <Text style={styles.sectionSubtitle}>Rezumatul ultimelor tranzacții</Text>
          </View>
          {latestPayments.map((p) => {
            const created = new Date(p.createdAt);
            return (
              <View key={p.id} style={styles.paymentItem}>
                <View style={styles.paymentMain}>
                  <Text style={styles.paymentAmount}>{formatCurrencyRON(p.amount)}</Text>
                  <Text style={styles.paymentMeta}>
                    {p.method} · {p.status}
                  </Text>
                </View>
                <View style={styles.paymentSide}>
                  {p.entityName ? (
                    <Text style={styles.paymentCourse}>{p.entityName}</Text>
                  ) : null}
                  <Text style={styles.paymentDate}>
                    {created.toLocaleDateString('ro-RO')}
                  </Text>
                </View>
              </View>
            );
          })}
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Payments')}
          >
            <Text style={styles.linkButtonText}>Vezi toate plățile</Text>
          </TouchableOpacity>
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
  heroCard: {
    padding: 18,
    borderRadius: radii.card,
    backgroundColor: colors.primary,
    marginBottom: spacing.cardGap,
    ...shadows.card,
  },
  heroEyebrow: {
    fontSize: 12,
    color: 'rgba(239,246,255,0.9)',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#eff6ff',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(239,246,255,0.9)',
  },
  heroStatsRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  heroStatChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radii.small,
    backgroundColor: 'rgba(15,23,42,0.35)',
    marginRight: 8,
  },
  heroStatLabel: {
    fontSize: 12,
    color: 'rgba(226,232,240,0.9)',
    marginBottom: 2,
  },
  heroStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f9fafb',
  },
  nextSessionCard: {
    marginTop: 14,
    padding: 12,
    borderRadius: radii.small,
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  nextSessionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nextSessionLabel: {
    fontSize: 12,
    color: 'rgba(226,232,240,0.95)',
  },
  nextSessionWhen: {
    fontSize: 12,
    color: 'rgba(191,219,254,0.95)',
    fontWeight: '600',
  },
  nextSessionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 2,
  },
  nextSessionMeta: {
    fontSize: 12,
    color: 'rgba(226,232,240,0.9)',
  },
  nextSessionCta: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: '#f9fafb',
  },
  nextSessionCtaText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
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
  sectionHeaderRow: {
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
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  pillBase: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    marginRight: 8,
    marginTop: 4,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  pillNeutral: {
    backgroundColor: '#e5e7eb',
  },
  pillWarning: {
    backgroundColor: '#fef3c7',
  },
  pillAccent: {
    backgroundColor: '#dbeafe',
  },
  actionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  primaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  quickAction: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: '#eff6ff',
    marginRight: 8,
    marginTop: 6,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  childrenRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  childCard: {
    flex: 1,
    marginRight: 8,
    padding: 10,
    borderRadius: radii.small,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: '#f9fafb',
  },
  childAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  childAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  childName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  childMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  announcementItem: {
    marginTop: 8,
  },
  announcementHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  announcementCourse: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  badgeNew: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  announcementMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  announcementContent: {
    fontSize: 13,
    color: colors.text,
  },
  linkButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  linkButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  weekSummaryRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  weekSummaryPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radii.small,
    backgroundColor: '#eff6ff',
    marginRight: 8,
  },
  weekSummaryLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  weekSummaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  weekUpcomingList: {
    marginTop: 8,
  },
  weekUpcomingItem: {
    paddingVertical: 6,
  },
  weekUpcomingMain: {
    flexDirection: 'column',
  },
  weekUpcomingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  weekUpcomingMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  paymentMain: {
    flexDirection: 'column',
  },
  paymentSide: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  paymentMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  paymentCourse: {
    fontSize: 12,
    color: colors.text,
  },
  paymentDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
});

export default HomeParentScreen;
