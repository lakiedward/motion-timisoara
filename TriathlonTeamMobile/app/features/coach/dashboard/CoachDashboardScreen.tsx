import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../store/AuthContext';
import { useCoachTodayAttendance } from '../attendance/hooks/useCoachTodayAttendance';
import { useCoachWeeklySchedule } from '../attendance/hooks/useCoachWeeklySchedule';
import { useCoachCourses } from '../announcements/hooks/useCoachCourses';
import type { CoachTabsParamList } from '../../../navigation/CoachTabsNavigator';
import { colors, radii, shadows, spacing, typography } from '../../../config/theme';
import { StatCard, SessionCard, AlertCard, LoadingState, ErrorState, type Alert } from '../../../components/coach';

import type { AttendanceOccurrenceDto } from '../../../api/coachAttendanceApi';
import type { DaySessionsDto } from '../../../api/coachWeeklyAttendanceApi';

type NavProp = BottomTabNavigationProp<CoachTabsParamList, 'CoachDashboard'>;

const CoachDashboardScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();

  const { occurrences, loading: loadingToday, error: errorToday, reload: reloadToday } =
    useCoachTodayAttendance();
  const { days, loading: loadingWeek, error: errorWeek, reload: reloadWeek } =
    useCoachWeeklySchedule();
  const { items: courses, loading: loadingCourses, error: errorCourses, reload: reloadCourses } =
    useCoachCourses();

  const isLoading = loadingToday && loadingWeek && loadingCourses;
  const hasError = errorToday || errorWeek || errorCourses;

  const stats = useMemo(() => {
    const totalCourses = courses.length;
    const activeCourses = courses.filter((c) => c.active).length;

    const todaySessionsCount = occurrences.length;

    let weekSessionsCount = 0;
    
    days.forEach((day: DaySessionsDto) => {
      weekSessionsCount += day.sessions.length;
    });
    
    // TODO: Get enrolled counts from API when available
    const totalEnrolled = 0;

    // TODO: Calculate real attendance rate from API data
    const attendanceRate = 85;

    return { 
      totalCourses, 
      activeCourses, 
      todaySessionsCount, 
      weekSessionsCount,
      totalEnrolled,
      attendanceRate
    };
  }, [courses, occurrences, days]);

  const upcomingSessions = useMemo(() => {
    const sessions: {
      key: string;
      courseName: string;
      date: Date;
      dateStr: string;
      time: string;
      enrolledCount: number;
    }[] = [];

    days.forEach((day: DaySessionsDto) => {
      const date = new Date(day.date);
      day.sessions.forEach((s) => {
        const start = new Date(s.startsAt);
        const end = new Date(s.endsAt);
        const startTime = start.toLocaleTimeString('ro-RO', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const endTime = end.toLocaleTimeString('ro-RO', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const dateStr = date.toLocaleDateString('ro-RO', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });
        sessions.push({
          key: s.occurrenceId,
          courseName: s.courseName,
          date,
          dateStr,
          time: `${startTime} - ${endTime}`,
          enrolledCount: s.enrolledCount || 0,
        });
      });
    });

    sessions.sort((a, b) => a.date.getTime() - b.date.getTime());
    return sessions.slice(0, 5);
  }, [days]);

  const todayLabel = useMemo(() => {
    const today = new Date();
    return today.toLocaleDateString('ro-RO', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });
  }, []);

  // Generate alerts based on data
  const alerts = useMemo(() => {
    const alertsList: Alert[] = [];
    
    // TODO: Generate real alerts when API provides enrollment data
    // For now, return empty list
    
    return alertsList;
  }, [courses]);

  if (isLoading && !courses.length && !occurrences.length && !days.length) {
    return <LoadingState message="Se încarcă dashboard-ul..." />;
  }

  if (hasError && !courses.length && !occurrences.length && !days.length) {
    return (
      <ErrorState
        message="Nu am putut încărca datele dashboard-ului"
        onRetry={() => {
          reloadToday();
          reloadWeek();
          reloadCourses();
        }}
      />
    );
  }

  const coachName = user?.name ?? 'Antrenor';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Hero Section */}
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Bun venit</Text>
        <Text style={styles.heroTitle}>{coachName}</Text>
        <Text style={styles.heroSubtitle}>
          Vezi dintr-o privire cursurile tale și ședințele programate.
        </Text>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatChip}>
            <Text style={styles.heroStatLabel}>Cursuri active</Text>
            <Text style={styles.heroStatValue}>{stats.activeCourses}</Text>
          </View>
          <View style={styles.heroStatChip}>
            <Text style={styles.heroStatLabel}>Ședințe săptămâna asta</Text>
            <Text style={styles.heroStatValue}>{stats.weekSessionsCount}</Text>
          </View>
        </View>

        <View style={styles.heroFooterRow}>
          <Text style={styles.heroTodayLabel}>{todayLabel}</Text>
          <Text style={styles.heroTodayCount}>
            Azi ai {stats.todaySessionsCount} ședință
            {stats.todaySessionsCount === 1 ? '' : 'e'}.
          </Text>
        </View>
      </View>

      {/* Statistics Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          icon="school-outline"
          value={stats.totalCourses}
          label="Total Cursuri"
          sublabel={`${stats.activeCourses} active`}
          color={colors.primary}
        />
        <StatCard
          icon="people-outline"
          value={stats.totalEnrolled || '–'}
          label="Copii Înscriși"
          sublabel="În toate cursurile"
          color={colors.success}
        />
      </View>
      <View style={styles.statsGrid}>
        <StatCard
          icon="calendar-outline"
          value={stats.weekSessionsCount}
          label="Sesiuni Săptămână"
          sublabel="Programate"
          color={colors.info}
        />
        <StatCard
          icon="trending-up-outline"
          value={`${stats.attendanceRate}%`}
          label="Rată Prezență"
          sublabel="Ultimele 4 săptămâni"
          color={colors.warning}
        />
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Acțiuni rapide</Text>
          <Text style={styles.sectionSubtitle}>Intră direct în zonele importante</Text>
        </View>
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('CoachSessions')}
          >
            <Text style={styles.quickActionLabel}>Sesiunile de azi</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('CoachSessions')}
          >
            <Text style={styles.quickActionLabel}>Orar săptămânal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('CoachCourses')}
          >
            <Text style={styles.quickActionLabel}>Cursurile mele</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('CoachAnnouncements')}
          >
            <Text style={styles.quickActionLabel}>Anunțuri curs</Text>
          </TouchableOpacity>
        </View>
      </View>

      {courses.length > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Cursurile tale</Text>
            <Text style={styles.sectionSubtitle}>
              {stats.totalCourses} cursuri în total · {stats.activeCourses} active
            </Text>
          </View>
          <View style={styles.coursesRow}>
            {courses.slice(0, 3).map((course) => (
              <View key={course.id} style={styles.courseCard}>
                <Text style={styles.courseName}>{course.name}</Text>
                <Text style={styles.courseMeta}>{course.sport}</Text>
                {course.level ? (
                  <Text style={styles.courseMeta}>Nivel: {course.level}</Text>
                ) : null}
                <View
                  style={[
                    styles.statusBadge,
                    course.active ? styles.statusActive : styles.statusInactive,
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {course.active ? 'Activ' : 'Inactiv'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {occurrences.length > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Ședințele de azi</Text>
            <Text style={styles.sectionSubtitle}>
              Un rezumat al sesiunilor programate pentru azi.
            </Text>
          </View>
          {occurrences.slice(0, 3).map((occ: AttendanceOccurrenceDto) => {
            const start = new Date(occ.startsAt);
            const timeLabel = start.toLocaleTimeString('ro-RO', {
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <View key={occ.occurrenceId} style={styles.todaySessionItem}>
                <Text style={styles.todaySessionTitle}>{occ.courseName}</Text>
                <Text style={styles.todaySessionMeta}>
                  {timeLabel} · {occ.children.length} copii înscriși
                </Text>
              </View>
            );
          })}
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('CoachSessions')}
          >
            <Text style={styles.linkButtonText}>Deschide sesiuni & prezențe</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Upcoming Sessions */}
      {upcomingSessions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sesiuni Următoare</Text>
            <Text style={styles.sectionSubtitle}>Top 5 sesiuni programate</Text>
          </View>
          {upcomingSessions.map((s) => (
            <SessionCard
              key={s.key}
              courseName={s.courseName}
              date={s.dateStr}
              time={s.time}
              enrolledCount={s.enrolledCount}
              onMarkAttendance={() => navigation.navigate('CoachSessions')}
            />
          ))}
        </View>
      )}

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderWithBadge}>
              <Text style={styles.sectionTitle}>Alerte</Text>
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>{alerts.length}</Text>
              </View>
            </View>
            <Text style={styles.sectionSubtitle}>Probleme care necesită atenție</Text>
          </View>
          {alerts.map((alert, index) => (
            <AlertCard
              key={index}
              alert={alert}
              onTap={() => {
                if (alert.courseId) {
                  navigation.navigate('CoachCourses');
                }
              }}
            />
          ))}
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
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
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
    borderRadius: radii.sm,
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
  heroFooterRow: {
    marginTop: 10,
  },
  heroTodayLabel: {
    fontSize: 12,
    color: 'rgba(226,232,240,0.9)',
  },
  heroTodayCount: {
    fontSize: 13,
    color: '#e5e7eb',
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
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionHeaderWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionHeaderRow: {
    marginBottom: 8,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  alertBadge: {
    backgroundColor: colors.errorLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radii.full,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBadgeText: {
    ...typography.captionSmall,
    color: colors.error,
    fontWeight: '700',
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
  coursesRow: {
    marginTop: 8,
  },
  courseCard: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  courseName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  courseMeta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  statusActive: {
    backgroundColor: '#dcfce7',
  },
  statusInactive: {
    backgroundColor: '#fee2e2',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  todaySessionItem: {
    marginTop: 8,
  },
  todaySessionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  todaySessionMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  weekUpcomingItem: {
    marginTop: 8,
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
  linkButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  linkButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  error: {
    color: colors.error,
    textAlign: 'center',
    marginBottom: 8,
  },
  link: {
    color: colors.primary,
    marginTop: 4,
  },
});

export default CoachDashboardScreen;
