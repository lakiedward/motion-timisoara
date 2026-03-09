import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing, typography } from '../../config/theme';

export interface Alert {
  type: 'low-sessions' | 'no-attendance' | 'info';
  message: string;
  icon: keyof typeof Ionicons.glyphMap;
  courseId?: string;
  courseName?: string;
}

interface AlertCardProps {
  alert: Alert;
  onTap?: () => void;
}

export const AlertCard: React.FC<AlertCardProps> = ({ alert, onTap }) => {
  const getAlertColor = () => {
    switch (alert.type) {
      case 'low-sessions':
        return colors.warning;
      case 'no-attendance':
        return colors.error;
      default:
        return colors.info;
    }
  };

  const alertColor = getAlertColor();

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onTap}
      activeOpacity={onTap ? 0.7 : 1}
      disabled={!onTap}
    >
      <View style={[styles.iconContainer, { backgroundColor: alertColor + '15' }]}>
        <Ionicons name={alert.icon} size={24} color={alertColor} />
      </View>
      <View style={styles.content}>
        <Text style={styles.message}>{alert.message}</Text>
        {alert.courseName && (
          <Text style={styles.courseName}>{alert.courseName}</Text>
        )}
      </View>
      {onTap && (
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  message: {
    ...typography.bodySmall,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  courseName: {
    ...typography.captionSmall,
    color: colors.textMuted,
  },
});
