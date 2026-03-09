import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CoachCoursesHomeScreen from '../features/coach/courses/screens/CoachCoursesHomeScreen';
import CoachCourseFormScreen from '../features/coach/courses/screens/CoachCourseFormScreen';

export type CoachCoursesStackParamList = {
  CoachCoursesHome: undefined;
  CoachCourseForm: {
    mode: 'create' | 'edit';
    courseId?: string;
  };
};

const Stack = createNativeStackNavigator<CoachCoursesStackParamList>();

const CoachCoursesStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="CoachCoursesHome"
        component={CoachCoursesHomeScreen}
        options={{ title: 'Cursurile mele' }}
      />
      <Stack.Screen
        name="CoachCourseForm"
        component={CoachCourseFormScreen}
        options={({ route }) => ({
          title: route.params.mode === 'create' ? 'Curs Nou' : 'Editează Curs',
        })}
      />
    </Stack.Navigator>
  );
};

export default CoachCoursesStackNavigator;
