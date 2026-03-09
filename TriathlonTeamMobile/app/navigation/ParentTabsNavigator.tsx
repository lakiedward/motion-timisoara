import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeParentScreen from '../features/parent/home/HomeParentScreen';
import ParentProfileScreen from '../features/parent/profile/screens/ParentProfileScreen';
import ParentChildrenStackNavigator from './ParentChildrenStackNavigator';
import ParentAnnouncementsFeedScreen from '../features/parent/announcements/screens/ParentAnnouncementsFeedScreen';
import ParentScheduleScreen from '../features/parent/schedule/screens/ParentScheduleScreen';
import ParentPaymentsOverviewScreen from '../features/parent/payments/screens/ParentPaymentsOverviewScreen';
import ParentEnrollmentsScreen from '../features/parent/enrollments/screens/ParentEnrollmentsScreen';
import { colors, radii, spacing, shadows } from '../config/theme';

export type ParentTabsParamList = {
  Home: undefined;
  Children: undefined;
  Announcements: undefined;
  Schedule: undefined;
  Enrollments: undefined;
  Payments: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<ParentTabsParamList>();

const ParentTabsNavigator: React.FC = () => {
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
          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';

          switch (route.name) {
            case 'Home':
              iconName = 'home-outline';
              break;
            case 'Children':
              iconName = 'people-outline';
              break;
            case 'Announcements':
              iconName = 'notifications-outline';
              break;
            case 'Schedule':
              iconName = 'calendar-outline';
              break;
            case 'Enrollments':
              iconName = 'list-outline';
              break;
            case 'Payments':
              iconName = 'card-outline';
              break;
            case 'Profile':
              iconName = 'person-circle-outline';
              break;
            default:
              iconName = 'ellipse-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeParentScreen}
        options={{ title: 'Acasă', headerShown: false }}
      />
      <Tab.Screen
        name="Children"
        component={ParentChildrenStackNavigator}
        options={{ headerShown: false, title: 'Copii' }}
      />
      <Tab.Screen
        name="Announcements"
        component={ParentAnnouncementsFeedScreen}
        options={{ title: 'Anunțuri' }}
      />
      <Tab.Screen
        name="Schedule"
        component={ParentScheduleScreen}
        options={{ title: 'Orar' }}
      />
      <Tab.Screen
        name="Enrollments"
        component={ParentEnrollmentsScreen}
        options={{ title: 'Înscrieri' }}
      />
      <Tab.Screen
        name="Payments"
        component={ParentPaymentsOverviewScreen}
        options={{ title: 'Plăți' }}
      />
      <Tab.Screen name="Profile" component={ParentProfileScreen} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
};

export default ParentTabsNavigator;
