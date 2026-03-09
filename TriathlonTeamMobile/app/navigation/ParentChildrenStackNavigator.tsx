import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChildrenListScreen from '../features/parent/children/screens/ChildrenListScreen';
import ChildDetailsScreen from '../features/parent/children/screens/ChildDetailsScreen';
import ChildCourseAnnouncementsScreen from '../features/parent/announcements/screens/ChildCourseAnnouncementsScreen';

export type ParentChildrenStackParamList = {
  ChildrenList: undefined;
  ChildDetails: {
    childId: string;
    childName?: string;
  };
  ChildCourseAnnouncements: {
    courseId: string;
    courseName?: string;
    childName?: string;
  };
};

const Stack = createNativeStackNavigator<ParentChildrenStackParamList>();

const ParentChildrenStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ChildrenList"
        component={ChildrenListScreen}
        options={{ title: 'Copiii mei' }}
      />
      <Stack.Screen
        name="ChildDetails"
        component={ChildDetailsScreen}
        options={({ route }) => ({ title: route.params.childName || 'Detalii copil' })}
      />
      <Stack.Screen
        name="ChildCourseAnnouncements"
        component={ChildCourseAnnouncementsScreen}
        options={{ title: 'Anunțuri curs' }}
      />
    </Stack.Navigator>
  );
};

export default ParentChildrenStackNavigator;
