import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useCoachCourses } from '../../announcements/hooks/useCoachCourses';
import { colors, radii, spacing, typography } from '../../../../config/theme';
import { CourseCard, LoadingState, ErrorState, EmptyState } from '../../../../components/coach';
import { setCoachCourseStatus } from '../../../../api/coachCoursesApi';
import type { CoachCoursesStackParamList } from '../../../../navigation/CoachCoursesStackNavigator';

type NavProp = NativeStackNavigationProp<CoachCoursesStackParamList, 'CoachCoursesHome'>;

const CoachCoursesHomeScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { items: courses, loading, error, reload } = useCoachCourses();

  const handleCreateCourse = () => {
    navigation.navigate('CoachCourseForm', { mode: 'create' });
  };

  const handleEditCourse = (courseId: string) => {
    navigation.navigate('CoachCourseForm', { mode: 'edit', courseId });
  };

  const handleToggleStatus = async (courseId: string, currentStatus: boolean) => {
    try {
      await setCoachCourseStatus(courseId, !currentStatus);
      await reload();
    } catch (e) {
      Alert.alert('Eroare', 'Nu s-a putut actualiza statusul cursului. Încearcă din nou.');
    }
  };

  if (loading && courses.length === 0) {
    return <LoadingState message="Se încarcă cursurile..." />;
  }

  if (error && courses.length === 0) {
    return <ErrorState message={error} onRetry={reload} />;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Cursurile mele</Text>
          <Text style={styles.subtitle}>
            {courses.length} {courses.length === 1 ? 'curs' : 'cursuri'} în total
          </Text>
        </View>
        <TouchableOpacity style={styles.createButton} onPress={handleCreateCourse}>
          <Ionicons name="add" size={24} color={colors.surface} />
        </TouchableOpacity>
      </View>

      {/* Courses List */}
      {courses.length === 0 ? (
        <EmptyState
          icon="school-outline"
          message="Nu ai cursuri încă"
          actionLabel="Adaugă Curs"
          onAction={handleCreateCourse}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              id={course.id}
              name={course.name}
              sport={course.sport}
              level={course.level}
              active={course.active}
              onEdit={() => handleEditCourse(course.id)}
              onToggleStatus={() => handleToggleStatus(course.id, course.active)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  createButton: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.screenPadding,
    paddingBottom: 96,
  },
});

export default CoachCoursesHomeScreen;
