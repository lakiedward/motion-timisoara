import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CoachSessionsScreen from '../features/coach/attendance/screens/CoachSessionsScreen';
import CoachSessionDetailScreen from '../features/coach/attendance/screens/CoachSessionDetailScreen';
import CoachPaymentManagementScreen from '../features/coach/payments/screens/CoachPaymentManagementScreen';

export type CoachSessionsStackParamList = {
  CoachSessionsHome: undefined;
  CoachSessionDetail: {
    occurrenceId: string;
    courseName: string;
  };
  CoachPaymentManagement: {
    courseId: string;
    courseName: string;
  };
};

const Stack = createNativeStackNavigator<CoachSessionsStackParamList>();

const CoachSessionsStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="CoachSessionsHome"
        component={CoachSessionsScreen}
        options={{ title: 'Sesiunile mele' }}
      />
      <Stack.Screen
        name="CoachSessionDetail"
        component={CoachSessionDetailScreen}
        options={({ route }) => ({ title: route.params.courseName })}
      />
      <Stack.Screen
        name="CoachPaymentManagement"
        component={CoachPaymentManagementScreen}
        options={{ title: 'Gestionare Plăți' }}
      />
    </Stack.Navigator>
  );
};

export default CoachSessionsStackNavigator;
