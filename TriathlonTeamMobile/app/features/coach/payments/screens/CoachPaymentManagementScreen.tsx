import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { colors, radii, shadows, spacing, typography } from '../../../../config/theme';
import { LoadingState, ErrorState, EmptyState } from '../../../../components/coach';
import { useCoachEnrollments } from '../hooks/useCoachEnrollments';
import type { CoachSessionsStackParamList } from '../../../../navigation/CoachSessionsStackNavigator';

type RouteParams = RouteProp<CoachSessionsStackParamList, 'CoachPaymentManagement'>;

const CoachPaymentManagementScreen: React.FC = () => {
  const route = useRoute<RouteParams>();
  const { courseId, courseName } = route.params;
  
  const { enrollments, loading, error, reload, addSessions } = useCoachEnrollments(courseId);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAddSessions = (enrollmentId: string, childName: string) => {
    Alert.prompt(
      'Adaugă Sesiuni',
      `Câte sesiuni vrei să adaugi pentru ${childName}?`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Adaugă',
          onPress: async (value?: string) => {
            const count = parseInt(value || '0', 10);
            if (count <= 0 || isNaN(count)) {
              Alert.alert('Eroare', 'Te rog introdu un număr valid de sesiuni');
              return;
            }

            setProcessingId(enrollmentId);
            const result = await addSessions(enrollmentId, count);
            setProcessingId(null);

            if (result.success) {
              Alert.alert('Succes', `Au fost adăugate ${count} sesiuni pentru ${childName}`);
            } else {
              Alert.alert('Eroare', result.error || 'Nu s-au putut adăuga sesiunile');
            }
          },
        },
      ],
      'plain-text',
      '',
      'number-pad'
    );
  };

  if (loading && enrollments.length === 0) {
    return <LoadingState message="Se încarcă înscriierile..." />;
  }

  if (error && enrollments.length === 0) {
    return <ErrorState message={error} onRetry={reload} />;
  }

  if (enrollments.length === 0) {
    return (
      <EmptyState
        icon="people-outline"
        message="Nu există copii înscriși la acest curs"
      />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Gestionare Plăți</Text>
        <Text style={styles.subtitle}>{courseName}</Text>
        <Text style={styles.info}>
          {enrollments.length} {enrollments.length === 1 ? 'copil înscris' : 'copii înscriși'}
        </Text>
      </View>

      {/* Enrollments List */}
      {enrollments.map((enrollment) => {
        const isProcessing = processingId === enrollment.id;
        
        return (
          <View key={enrollment.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.childInfo}>
                <Ionicons name="person-circle-outline" size={40} color={colors.primary} />
                <View style={styles.childDetails}>
                  <Text style={styles.childName}>{enrollment.childName}</Text>
                  <Text style={styles.childMeta}>
                    {enrollment.sessionsAttended} sesiuni parcurse
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.sessionInfo}>
              <View style={styles.sessionStat}>
                <Ionicons name="wallet-outline" size={20} color={colors.success} />
                <Text style={styles.sessionStatLabel}>Plătite</Text>
                <Text style={styles.sessionStatValue}>{enrollment.sessionsPaid}</Text>
              </View>
              <View style={styles.sessionStat}>
                <Ionicons name="hourglass-outline" size={20} color={colors.warning} />
                <Text style={styles.sessionStatLabel}>Rămase</Text>
                <Text style={styles.sessionStatValue}>{enrollment.sessionsRemaining}</Text>
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.addButton]}
                onPress={() => handleAddSessions(enrollment.id, enrollment.childName)}
                disabled={isProcessing}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.surface} />
                <Text style={styles.actionButtonText}>Adaugă Sesiuni</Text>
              </TouchableOpacity>
            </View>

            {isProcessing && (
              <View style={styles.processingOverlay}>
                <Text style={styles.processingText}>Se procesează...</Text>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.screenPadding,
    paddingBottom: 96,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  info: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cardHeader: {
    marginBottom: spacing.md,
  },
  childInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  childDetails: {
    flex: 1,
  },
  childName: {
    ...typography.h4,
    color: colors.text,
  },
  childMeta: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  sessionInfo: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderSubtle,
  },
  sessionStat: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  sessionStatLabel: {
    ...typography.captionSmall,
    color: colors.textMuted,
  },
  sessionStatValue: {
    ...typography.h3,
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.button,
    gap: spacing.xs,
  },
  addButton: {
    backgroundColor: colors.success,
  },
  removeButton: {
    backgroundColor: colors.error,
  },
  actionButtonText: {
    ...typography.buttonSmall,
    color: colors.surface,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.card,
  },
  processingText: {
    ...typography.body,
    color: colors.primary,
  },
});

export default CoachPaymentManagementScreen;
