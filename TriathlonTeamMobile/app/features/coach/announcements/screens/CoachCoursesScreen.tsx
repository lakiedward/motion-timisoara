import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCoachCourses } from '../hooks/useCoachCourses';
import type { CoachAnnouncementsStackParamList } from '../../../../navigation/CoachAnnouncementsStackNavigator';
import { colors, radii, shadows, spacing } from '../../../../config/theme';

type NavProp = NativeStackNavigationProp<CoachAnnouncementsStackParamList, 'CoachCourses'>;

const CoachCoursesScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { items, loading, error, reload } = useCoachCourses();

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
        <Text style={styles.empty}>Nu există cursuri asociate acestui antrenor.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate('CoachCourseAnnouncements', {
                courseId: item.id,
                courseName: item.name,
              })
            }
          >
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardTitleBlock}>
                <Text style={styles.title}>{item.name}</Text>
                <Text style={styles.meta}>{item.sport}</Text>
                {item.level ? <Text style={styles.meta}>Nivel: {item.level}</Text> : null}
              </View>
              <View
                style={[
                  styles.statusBadge,
                  item.active ? styles.statusActive : styles.statusInactive,
                ]}
              >
                <Text style={styles.statusText}>{item.active ? 'Activ' : 'Inactiv'}</Text>
              </View>
            </View>
            {item.description ? (
              <Text style={styles.description} numberOfLines={2} ellipsizeMode="tail">
                {item.description}
              </Text>
            ) : null}
            <View style={styles.actionsRow}>
              <Text style={styles.secondaryLabel}>Anunțuri curs</Text>
              <Text style={styles.chevron}>{'>'}</Text>
            </View>
          </TouchableOpacity>
        )}
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
    padding: spacing.screenPadding,
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
  },
  cardTitleBlock: {
    flex: 1,
    marginRight: 8,
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
  description: {
    marginTop: 6,
    fontSize: 13,
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  statusActive: {
    backgroundColor: '#dcfce7',
  },
  statusInactive: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  actionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  secondaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  chevron: {
    fontSize: 16,
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

export default CoachCoursesScreen;
