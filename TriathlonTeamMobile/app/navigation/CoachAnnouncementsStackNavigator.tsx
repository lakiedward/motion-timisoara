import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CoachCoursesScreen from '../features/coach/announcements/screens/CoachCoursesScreen';
import CoachCourseAnnouncementsScreen from '../features/coach/announcements/screens/CoachCourseAnnouncementsScreen';

export type CoachAnnouncementsStackParamList = {
  CoachCourses: undefined;
  CoachCourseAnnouncements: {
    courseId: string;
    courseName?: string;
  };
};

const Stack = createNativeStackNavigator<CoachAnnouncementsStackParamList>();

const CoachAnnouncementsStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="CoachCourses"
        component={CoachCoursesScreen}
        options={{ title: 'Cursurile mele' }}
      />
      <Stack.Screen
        name="CoachCourseAnnouncements"
        component={CoachCourseAnnouncementsScreen}
        options={({ route }) => ({ title: route.params.courseName || 'Anunțuri curs' })}
      />
    </Stack.Navigator>
  );
};

export default CoachAnnouncementsStackNavigator;
