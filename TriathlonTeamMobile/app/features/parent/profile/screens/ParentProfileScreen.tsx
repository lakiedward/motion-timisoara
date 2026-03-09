import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, shadows, spacing } from '../../../../config/theme';

const ParentProfileScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Profil părinte</Text>
        <Text style={styles.subtitle}>Datele de profil ale părintelui vor fi aici.</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    backgroundColor: colors.background,
  },
  card: {
    width: '100%',
    padding: 16,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
  },
});

export default ParentProfileScreen;
