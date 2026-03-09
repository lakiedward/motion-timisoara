import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCoachWeeklySchedule } from '../hooks/useCoachWeeklySchedule';
import { colors, spacing, typography } from '../../../../config/theme';
import { SessionCard, WeekNavigator, LoadingState, ErrorState, EmptyState } from '../../../../components/coach';
import type { CoachSessionsStackParamList } from '../../../../navigation/CoachSessionsStackNavigator';

type NavProp = NativeStackNavigationProp<CoachSessionsStackParamList, 'CoachSessionsHome'>;

const CoachWeeklyScheduleScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { 
    weekStartDate, 
    days, 
    loading, 
    error, 
    reload,
    goToPreviousWeek,
    goToNextWeek
  } = useCoachWeeklySchedule();

  if (loading && days.length === 0) {
    return <LoadingState message="Se încarcă orarul săptămânal..." />;
  }

  if (error && days.length === 0) {
    return <ErrorState message={error} onRetry={reload} />;
  }

  return (
    <View style={styles.container}>
      {/* Week Navigator */}
      <WeekNavigator
        weekStart={weekStartDate}
        onPrevious={goToPreviousWeek}
        onNext={goToNextWeek}
      />

      {days.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          message="Nu există ședințe programate în această săptămână"
        />
      ) : (
        <FlatList
          data={days}
          keyExtractor={(day) => day.date}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: day }) => {
            const date = new Date(day.date);
            const label = date.toLocaleDateString('ro-RO', {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
            });

            return (
              <View style={styles.dayBlock}>
                <Text style={styles.dayTitle}>{label}</Text>
                {day.sessions.length === 0 ? (
                  <Text style={styles.dayEmpty}>Nu ai ședințe în această zi.</Text>
                ) : (
                  day.sessions.map((session) => {
                    const start = new Date(session.startsAt);
                    const end = new Date(session.endsAt);
                    const timeLabel = `${start.toLocaleTimeString('ro-RO', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })} - ${end.toLocaleTimeString('ro-RO', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`;
                    const dateStr = date.toLocaleDateString('ro-RO', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    });

                    return (
                      <SessionCard
                        key={session.occurrenceId}
                        courseName={session.courseName}
                        date={dateStr}
                        time={timeLabel}
                        enrolledCount={session.enrolledCount || 0}
                        onMarkAttendance={() => {
                          navigation.navigate('CoachSessionDetail', {
                            occurrenceId: session.occurrenceId,
                            courseName: session.courseName,
                          });
                        }}
                      />
                    );
                  })
                )}
              </View>
            );
          }}
          refreshing={loading}
          onRefresh={reload}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 96,
  },
  dayBlock: {
    marginBottom: spacing.lg,
  },
  dayTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  dayEmpty: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
});

export default CoachWeeklyScheduleScreen;
