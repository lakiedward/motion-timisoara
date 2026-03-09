import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import CoachTodayAttendanceScreen from './CoachTodayAttendanceScreen';
import CoachWeeklyScheduleScreen from './CoachWeeklyScheduleScreen';
import { colors, spacing, radii } from '../../../../config/theme';

const CoachSessionsScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'today' | 'week'>('today');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sesiunile mele</Text>
        <Text style={styles.subtitle}>Gestionează ședințele de azi și orarul săptămânal.</Text>
      </View>
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'today' && styles.tabButtonActive]}
          onPress={() => setActiveTab('today')}
        >
          <Text
            style={[styles.tabLabel, activeTab === 'today' && styles.tabLabelActive]}
          >
            Azi
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'week' && styles.tabButtonActive]}
          onPress={() => setActiveTab('week')}
        >
          <Text style={[styles.tabLabel, activeTab === 'week' && styles.tabLabelActive]}>
            Săptămână
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {activeTab === 'today' ? <CoachTodayAttendanceScreen /> : <CoachWeeklyScheduleScreen />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textMuted,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenPadding,
    marginBottom: 4,
    marginTop: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: radii.pill,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  tabLabelActive: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
  },
});

export default CoachSessionsScreen;
