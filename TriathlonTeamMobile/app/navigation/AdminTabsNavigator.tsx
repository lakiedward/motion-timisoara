import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AdminDashboardScreen from '../features/admin/dashboard/screens/AdminDashboardScreen';
import { colors, radii, spacing, shadows } from '../config/theme';

export type AdminTabsParamList = {
  Dashboard: undefined;
};

const Tab = createBottomTabNavigator<AdminTabsParamList>();

const AdminTabsNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
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
        tabBarIcon: ({ color, size }) => (
          <Ionicons name="speedometer-outline" size={size} color={color} />
        ),
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={AdminDashboardScreen}
        options={{ title: 'Panou administrare', tabBarLabel: 'Admin' }}
      />
    </Tab.Navigator>
  );
};

export default AdminTabsNavigator;
