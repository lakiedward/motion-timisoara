import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ParentChildrenStackParamList } from '../../../../navigation/ParentChildrenStackNavigator';
import { useChildDetails } from '../hooks/useChildDetails';
import { useChildAttendance } from '../hooks/useChildAttendance';
import { buildParentChildPhotoUrl } from '../../../../api/parentChildrenApi';

type NavProp = NativeStackNavigationProp<ParentChildrenStackParamList, 'ChildDetails'>;

const ChildDetailsScreen: React.FC = () => {
  const route = useRoute<RouteProp<ParentChildrenStackParamList, 'ChildDetails'>>();
  const navigation = useNavigation<NavProp>();
  const { childId } = route.params;
  const { child, enrollments, loading, error } = useChildDetails(childId);
  const {
    attendance,
    loading: attendanceLoading,
    error: attendanceError,
    reload: reloadAttendance,
  } = useChildAttendance(childId);

  if (loading && !child) {
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
      </View>
    );
  }

  if (!child) {
    return (
      <View style={styles.centered}>
        <Text>Nu am găsit acest copil.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {child.hasPhoto ? (
          <Image
            source={{ uri: buildParentChildPhotoUrl(child.id) }}
            style={styles.avatar}
          />
        ) : null}
        <Text style={styles.name}>{child.name}</Text>
        {child.level ? <Text style={styles.level}>Nivel: {child.level}</Text> : null}
        {child.tshirtSize ? <Text style={styles.detail}>Mărime tricou: {child.tshirtSize}</Text> : null}
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Înscrieri</Text>
        {enrollments.length === 0 ? (
          <Text style={styles.empty}>Nu există înscrieri pentru acest copil încă.</Text>
        ) : (
          <FlatList
            data={enrollments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const canViewAnnouncements =
                item.kind === 'COURSE' && item.entity && !!item.entity.id;

              return (
                <TouchableOpacity
                  style={styles.enrollmentCard}
                  disabled={!canViewAnnouncements}
                  onPress={() => {
                    if (canViewAnnouncements && item.entity) {
                      navigation.navigate('ChildCourseAnnouncements', {
                        courseId: item.entity.id,
                        courseName: item.entity.name,
                        childName: child.name || undefined,
                      });
                    }
                  }}
                >
                  <Text style={styles.enrollmentTitle}>
                    {item.entity?.name ?? 'Curs necunoscut'}
                  </Text>
                  <Text style={styles.enrollmentMeta}>Status: {item.status}</Text>
                  {canViewAnnouncements ? (
                    <Text style={styles.link}>Vezi anunțurile cursului</Text>
                  ) : null}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Prezență</Text>
        {attendanceLoading && !attendance ? (
          <View style={styles.centeredSection}>
            <ActivityIndicator />
          </View>
        ) : attendanceError ? (
          <View style={styles.centeredSection}>
            <Text style={styles.error}>{attendanceError}</Text>
            <Text style={styles.link} onPress={reloadAttendance}>
              Reîncearcă
            </Text>
          </View>
        ) : !attendance || attendance.courses.length === 0 ? (
          <Text style={styles.empty}>Nu există încă istoricul de prezență pentru acest copil.</Text>
        ) : (
          <FlatList
            data={attendance.courses}
            keyExtractor={(course) => course.id}
            renderItem={({ item: course }) => (
              <View style={styles.attendanceCourse}>
                <Text style={styles.attendanceCourseTitle}>{course.name}</Text>
                {course.sessions.map((session) => {
                  const date = new Date(session.date);
                  const dateLabel = date.toLocaleDateString('ro-RO', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });
                  const timeLabel = date.toLocaleTimeString('ro-RO', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <View key={session.id} style={styles.attendanceRow}>
                      <Text style={styles.attendanceText}>
                        {dateLabel} {timeLabel} — {session.statusLabel}
                      </Text>
                      {session.note ? (
                        <Text style={styles.attendanceNote}>{session.note}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredSection: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 12,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  level: {
    fontSize: 16,
    marginBottom: 4,
  },
  detail: {
    fontSize: 14,
    color: '#555',
  },
  section: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  empty: {
    fontSize: 14,
    color: '#777',
  },
  enrollmentCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 8,
  },
  enrollmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  enrollmentMeta: {
    fontSize: 14,
    color: '#555',
  },
  attendanceCourse: {
    marginBottom: 12,
  },
  attendanceCourseTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  attendanceRow: {
    marginBottom: 4,
  },
  attendanceText: {
    fontSize: 13,
    color: '#555',
  },
  attendanceNote: {
    fontSize: 12,
    color: '#777',
  },
  error: {
    color: 'red',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  link: {
    color: '#007AFF',
    marginTop: 4,
  },
});

export default ChildDetailsScreen;
