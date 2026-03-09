import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCoachTodayAttendance } from '../hooks/useCoachTodayAttendance';
import type { CoachSessionsStackParamList } from '../../../../navigation/CoachSessionsStackNavigator';
import { colors, radii, shadows, spacing } from '../../../../config/theme';

type NavProp = NativeStackNavigationProp<CoachSessionsStackParamList, 'CoachSessionsHome'>;

const CoachTodayAttendanceScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { occurrences, loading, error, reload, mark, submittingKey } = useCoachTodayAttendance();

  if (loading && occurrences.length === 0) {
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

  if (occurrences.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ședințele de azi</Text>
          <Text style={styles.headerSubtitle}>Nu ai ședințe programate pentru azi.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ședințele de azi</Text>
        <Text style={styles.headerSubtitle}>
          Ai {occurrences.length} ședință{occurrences.length === 1 ? '' : 'e'} programată azi.
        </Text>
      </View>
      <FlatList
        data={occurrences}
        keyExtractor={(item) => item.occurrenceId}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const start = new Date(item.startsAt);
          const timeLabel = start.toLocaleTimeString('ro-RO', {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <View style={styles.card}>
              <Text style={styles.title}>{item.courseName}</Text>
              <Text style={styles.meta}>{timeLabel}</Text>
              <View style={styles.childrenHeader}>
                <Text style={styles.childrenHeaderText}>Copii înscriși</Text>
              </View>
              {item.children.map((child) => {
                const key = `${item.occurrenceId}-${child.childId}`;
                const isSubmitting = submittingKey === key;
                return (
                  <View key={child.childId} style={styles.childRow}>
                    <View style={styles.childInfo}>
                      <Text style={styles.childName}>{child.childName}</Text>
                      {child.status ? (
                        <Text style={styles.status}>{`Status: ${child.status}`}</Text>
                      ) : (
                        <Text style={styles.status}>Status: -</Text>
                      )}
                    </View>
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          styles.actionPresent,
                          isSubmitting && styles.actionDisabled,
                        ]}
                        onPress={() => mark(item.occurrenceId, child.childId, 'PRESENT')}
                        disabled={isSubmitting}
                      >
                        <Text style={styles.actionButtonText}>Prezent</Text>
                      </TouchableOpacity>
                      <View style={styles.actionSpacer} />
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          styles.actionAbsent,
                          isSubmitting && styles.actionDisabled,
                        ]}
                        onPress={() => mark(item.occurrenceId, child.childId, 'ABSENT')}
                        disabled={isSubmitting}
                      >
                        <Text style={styles.actionButtonText}>Absent</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
              <TouchableOpacity
                style={styles.detailButton}
                onPress={() =>
                  navigation.navigate('CoachSessionDetail', {
                    occurrenceId: item.occurrenceId,
                    courseName: item.courseName,
                  })
                }
              >
                <Text style={styles.detailButtonText}>Detalii sesiune & cash</Text>
              </TouchableOpacity>
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
  header: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textMuted,
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
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    color: colors.text,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 8,
  },
  childrenHeader: {
    marginBottom: 4,
  },
  childrenHeaderText: {
    fontSize: 14,
    fontWeight: '700',
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 14,
    fontWeight: '600',
  },
  status: {
    fontSize: 12,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionSpacer: {
    width: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  actionPresent: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },
  actionAbsent: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  actionDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  detailButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: '#eff6ff',
  },
  detailButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  empty: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
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

export default CoachTodayAttendanceScreen;
