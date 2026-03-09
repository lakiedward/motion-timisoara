import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { useAdminDashboard } from '../hooks/useAdminDashboard';
import { colors, radii, shadows, spacing } from '../../../../config/theme';

const AdminDashboardScreen: React.FC = () => {
  const { courses, stats, loading, error, reload } = useAdminDashboard();

  if (loading && courses.length === 0) {
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Panou administrare</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Cursuri</Text>
            <Text style={styles.statValue}>{stats.totalCourses}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Active</Text>
            <Text style={styles.statValue}>{stats.activeCourses}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Inactive</Text>
            <Text style={styles.statValue}>{stats.inactiveCourses}</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statCardWide}>
            <Text style={styles.statLabel}>Înscriși activi (plătiți)</Text>
            <Text style={styles.statValue}>{stats.totalPaid}</Text>
          </View>
          <View style={styles.statCardWide}>
            <Text style={styles.statLabel}>Rezervări neplătite</Text>
            <Text style={styles.statValue}>{stats.totalUnpaid}</Text>
          </View>
        </View>
      </View>

      {courses.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>Nu există încă cursuri configurate.</Text>
        </View>
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.courseName}>{item.name}</Text>
              <Text style={styles.meta}>Antrenor: {item.coachName}</Text>
              <Text style={styles.meta}>Sport: {item.sport}</Text>
              {item.level ? <Text style={styles.meta}>Nivel: {item.level}</Text> : null}
              {item.location ? <Text style={styles.meta}>Locație: {item.location}</Text> : null}
              <Text style={styles.meta}>Status: {item.active ? 'Activ' : 'Inactiv'}</Text>
              <Text style={styles.meta}>
                Înscriși activi: {item.enrolledCount} / Rezervați: {item.reservedCount}
              </Text>
              <Text style={styles.meta}>
                Plătiți: {item.enrolledPaidCount} / Neplătiți: {item.enrolledUnpaidCount}
              </Text>
            </View>
          )}
          refreshing={loading}
          onRefresh={reload}
        />
      )}
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
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    color: colors.text,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    marginRight: 8,
    padding: 10,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  statCardWide: {
    flex: 1,
    marginRight: 8,
    padding: 10,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  listContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 96,
  },
  card: {
    padding: 12,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    marginBottom: spacing.cardGap,
    ...shadows.card,
  },
  courseName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    color: colors.text,
  },
  meta: {
    fontSize: 13,
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

export default AdminDashboardScreen;
