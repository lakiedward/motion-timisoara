import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { useParentSchedule } from '../hooks/useParentSchedule';
import { colors, radii, shadows, spacing } from '../../../../config/theme';

const ParentScheduleScreen: React.FC = () => {
  const { events, loading, error, reload } = useParentSchedule();

  if (loading && events.length === 0) {
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

  if (events.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>Nu există ședințe viitoare în acest moment.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const date = new Date(item.date);
          const dateLabel = date.toLocaleDateString('ro-RO', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
          const timeLabel = item.time ? item.time.substring(0, 5) : null;

          return (
            <View style={styles.card}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>
                {dateLabel}
                {timeLabel ? ` · ${timeLabel}` : ''}
              </Text>
              {item.childName ? (
                <Text style={styles.meta}>Copil: {item.childName}</Text>
              ) : null}
              {item.location ? (
                <Text style={styles.meta}>Locație: {item.location}</Text>
              ) : null}
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
  title: {
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

export default ParentScheduleScreen;
