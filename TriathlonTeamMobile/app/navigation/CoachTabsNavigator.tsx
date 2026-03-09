import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import CoachDashboardScreen from '../features/coach/dashboard/CoachDashboardScreen';
import CoachCoursesStackNavigator from './CoachCoursesStackNavigator';
import CoachAnnouncementsStackNavigator from './CoachAnnouncementsStackNavigator';
import CoachSessionsStackNavigator from './CoachSessionsStackNavigator';
import { colors, radii, spacing, shadows } from '../config/theme';

export type CoachTabsParamList = {
  CoachDashboard: undefined;
  CoachSessions: undefined;
  CoachCourses: undefined;
  CoachAnnouncements: undefined;
};

const Tab = createBottomTabNavigator<CoachTabsParamList>();

const CoachTabsNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitleAlign: 'center',
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: '700', color: colors.text },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarStyle:
          Platform.OS === 'web'
            ? {
                backgroundColor: colors.surface,
                borderTopColor: colors.borderSubtle,
                height: 56,
              }
            : {
                position: 'absolute',
                backgroundColor: colors.surface,
                borderTopColor: 'transparent',
                borderRadius: radii.card,
                marginHorizontal: spacing.screenPadding,
                marginBottom: 6,
                height: 56,
                paddingBottom: 4,
                paddingTop: 4,
                ...shadows.card,
              },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'ellipse-outline';

          switch (route.name) {
            case 'CoachDashboard':
              iconName = 'speedometer-outline';
              break;
            case 'CoachSessions':
              iconName = 'calendar-outline';
              break;
            case 'CoachCourses':
              iconName = 'school-outline';
              break;
            case 'CoachAnnouncements':
              iconName = 'megaphone-outline';
              break;
            default:
              iconName = 'ellipse-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="CoachDashboard"
        component={CoachDashboardScreen}
        options={{ title: 'Dashboard', tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen
        name="CoachSessions"
        component={CoachSessionsStackNavigator}
        options={{ headerShown: false, title: 'Sesiuni', tabBarLabel: 'Sesiuni' }}
      />
      <Tab.Screen
        name="CoachCourses"
        component={CoachCoursesStackNavigator}
        options={{ headerShown: false, title: 'Cursuri', tabBarLabel: 'Cursuri' }}
      />
      <Tab.Screen
        name="CoachAnnouncements"
        component={CoachAnnouncementsStackNavigator}
        options={{ headerShown: false, title: 'Anunțuri', tabBarLabel: 'Anunțuri' }}
      />
    </Tab.Navigator>
  );
};

export default CoachTabsNavigator;
