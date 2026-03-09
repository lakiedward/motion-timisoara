import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing, typography } from '../../config/theme';

interface SessionCardProps {
  courseName: string;
  date: string;
  time: string;
  location?: string;
  enrolledCount: number;
  onMarkAttendance?: () => void;
  onManage?: () => void;
}

export const SessionCard: React.FC<SessionCardProps> = ({
  courseName,
  date,
  time,
  location,
  enrolledCount,
  onMarkAttendance,
  onManage,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.courseName}>{courseName}</Text>
      </View>
      
      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
          <Text style={styles.infoText}>{date}</Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="time-outline" size={16} color={colors.textMuted} />
          <Text style={styles.infoText}>{time}</Text>
        </View>
      </View>
      
      {location && (
        <View style={styles.infoItem}>
          <Ionicons name="location-outline" size={16} color={colors.textMuted} />
          <Text style={styles.infoText}>{location}</Text>
        </View>
      )}
      
      <View style={styles.enrolledRow}>
        <Ionicons name="people-outline" size={16} color={colors.textMuted} />
        <Text style={styles.enrolledText}>{enrolledCount} copii înscriși</Text>
      </View>
      
      <View style={styles.actions}>
        {onMarkAttendance && (
          <TouchableOpacity style={styles.primaryButton} onPress={onMarkAttendance}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.surface} />
            <Text style={styles.primaryButtonText}>Marchează Prezența</Text>
          </TouchableOpacity>
        )}
        {onManage && (
          <TouchableOpacity style={styles.secondaryButton} onPress={onManage}>
            <Text style={styles.secondaryButtonText}>Gestionează</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  header: {
    marginBottom: spacing.sm,
  },
  courseName: {
    ...typography.h4,
    color: colors.text,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  enrolledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  enrolledText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.button,
    gap: spacing.xs,
  },
  primaryButtonText: {
    ...typography.buttonSmall,
    color: colors.surface,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    ...typography.buttonSmall,
    color: colors.primary,
  },
});
