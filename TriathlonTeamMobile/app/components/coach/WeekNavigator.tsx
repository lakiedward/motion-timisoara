import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../config/theme';

interface WeekNavigatorProps {
  weekStart: Date;
  onPrevious: () => void;
  onNext: () => void;
}

export const WeekNavigator: React.FC<WeekNavigatorProps> = ({
  weekStart,
  onPrevious,
  onNext,
}) => {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'short',
    });
  };

  const weekLabel = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={onPrevious}>
        <Ionicons name="chevron-back" size={24} color={colors.primary} />
      </TouchableOpacity>
      
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{weekLabel}</Text>
      </View>
      
      <TouchableOpacity style={styles.button} onPress={onNext}>
        <Ionicons name="chevron-forward" size={24} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    marginHorizontal: spacing.screenPadding,
    marginBottom: spacing.md,
  },
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight,
  },
  labelContainer: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    ...typography.h4,
    color: colors.text,
  },
});
