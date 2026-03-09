import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing, typography } from '../../config/theme';

interface CourseCardProps {
  id: string;
  name: string;
  sport: string;
  level?: string | null;
  location?: string;
  schedule?: string;
  active: boolean;
  heroImageUrl?: string;
  enrolledCount?: number;
  onPress?: () => void;
  onEdit?: () => void;
  onAnnouncements?: () => void;
  onToggleStatus?: () => void;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  name,
  sport,
  level,
  location,
  schedule,
  active,
  heroImageUrl,
  enrolledCount,
  onPress,
  onEdit,
  onAnnouncements,
  onToggleStatus,
}) => {
  const getSportColor = (sportName: string) => {
    const sportLower = sportName.toLowerCase();
    if (sportLower.includes('înot') || sportLower.includes('inot')) return colors.swimming;
    if (sportLower.includes('alerg')) return colors.running;
    if (sportLower.includes('cicl')) return colors.cycling;
    if (sportLower.includes('triatlon')) return colors.triathlon;
    return colors.primary;
  };

  const sportColor = getSportColor(sport);

  const CardWrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.7 } : {};

  return (
    <CardWrapper style={styles.card} {...wrapperProps}>
      {/* Hero Image */}
      {heroImageUrl ? (
        <Image source={{ uri: heroImageUrl }} style={styles.heroImage} />
      ) : (
        <View style={[styles.heroImagePlaceholder, { backgroundColor: sportColor + '20' }]}>
          <Ionicons name="image-outline" size={48} color={sportColor} />
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={2}>{name}</Text>

        {/* Sport & Level */}
        <View style={styles.metaRow}>
          <View style={[styles.sportBadge, { backgroundColor: sportColor + '20' }]}>
            <Text style={[styles.sportText, { color: sportColor }]}>{sport}</Text>
          </View>
          {level && (
            <>
              <Text style={styles.metaSeparator}>•</Text>
              <Text style={styles.metaText}>{level}</Text>
            </>
          )}
        </View>

        {/* Location */}
        {location && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color={colors.textMuted} />
            <Text style={styles.infoText} numberOfLines={1}>{location}</Text>
          </View>
        )}

        {/* Enrolled Count */}
        {enrolledCount !== undefined && (
          <View style={styles.infoRow}>
            <Ionicons name="people-outline" size={16} color={colors.textMuted} />
            <Text style={styles.infoText}>
              {enrolledCount} {enrolledCount === 1 ? 'copil înscris' : 'copii înscriși'}
            </Text>
          </View>
        )}

        {/* Schedule */}
        {schedule && (
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
            <Text style={styles.infoText} numberOfLines={1}>{schedule}</Text>
          </View>
        )}

        {/* Status Badge */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, active ? styles.activeBadge : styles.inactiveBadge]}>
            <View style={[styles.statusDot, active ? styles.activeDot : styles.inactiveDot]} />
            <Text style={[styles.statusText, active ? styles.activeText : styles.inactiveText]}>
              {active ? 'ACTIV' : 'INACTIV'}
            </Text>
          </View>
        </View>

        {/* Actions */}
        {(onEdit || onAnnouncements || onToggleStatus) && (
          <View style={styles.actions}>
            {onEdit && (
              <TouchableOpacity style={styles.actionButton} onPress={onEdit}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
                <Text style={styles.actionButtonText}>Editează</Text>
              </TouchableOpacity>
            )}
            {onAnnouncements && (
              <TouchableOpacity style={styles.actionButton} onPress={onAnnouncements}>
                <Ionicons name="megaphone-outline" size={18} color={colors.primary} />
                <Text style={styles.actionButtonText}>Anunțuri</Text>
              </TouchableOpacity>
            )}
            {onToggleStatus && (
              <TouchableOpacity style={styles.actionButton} onPress={onToggleStatus}>
                <Ionicons 
                  name={active ? 'close-circle-outline' : 'checkmark-circle-outline'} 
                  size={18} 
                  color={colors.primary} 
                />
                <Text style={styles.actionButtonText}>
                  {active ? 'Dezactivează' : 'Activează'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </CardWrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.card,
  },
  heroImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  heroImagePlaceholder: {
    width: '100%',
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.md,
  },
  name: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  sportBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radii.sm,
  },
  sportText: {
    ...typography.captionSmall,
    fontWeight: '700',
  },
  metaText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  metaSeparator: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginHorizontal: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  statusRow: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    gap: spacing.xs,
  },
  activeBadge: {
    backgroundColor: colors.successLight,
  },
  inactiveBadge: {
    backgroundColor: colors.backgroundDark,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    backgroundColor: colors.success,
  },
  inactiveDot: {
    backgroundColor: colors.textMuted,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '700',
  },
  activeText: {
    color: colors.success,
  },
  inactiveText: {
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  actionButtonText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
});
