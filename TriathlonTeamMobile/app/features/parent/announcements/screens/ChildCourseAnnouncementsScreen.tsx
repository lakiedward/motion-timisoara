import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { ParentChildrenStackParamList } from '../../../../navigation/ParentChildrenStackNavigator';
import { useParentCourseAnnouncements } from '../hooks/useParentCourseAnnouncements';

const ChildCourseAnnouncementsScreen: React.FC = () => {
  const route = useRoute<RouteProp<ParentChildrenStackParamList, 'ChildCourseAnnouncements'>>();
  const { courseId, courseName, childName } = route.params;
  const { items, loading, error, reload } = useParentCourseAnnouncements(courseId);

  if (loading && items.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
        <Text style={styles.link} onPress={reload}>
          Reîncearcă
        </Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>Nu există anunțuri pentru acest curs încă.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {(courseName || childName) && (
        <View style={styles.header}>
          {courseName ? <Text style={styles.title}>{courseName}</Text> : null}
          {childName ? <Text style={styles.subtitle}>Copil: {childName}</Text> : null}
        </View>
      )}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.pinned ? <Text style={styles.pinned}>PINNED</Text> : null}
            <Text style={styles.content}>{item.content}</Text>
            <Text style={styles.meta}>{item.authorName}</Text>
          </View>
        )}
        refreshing={loading}
        onRefresh={reload}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    marginTop: 2,
  },
  listContent: {
    padding: 16,
  },
  card: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 10,
  },
  pinned: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d2691e',
    marginBottom: 4,
  },
  content: {
    fontSize: 15,
    marginBottom: 6,
  },
  meta: {
    fontSize: 12,
    color: '#777',
  },
  empty: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
  },
  error: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 8,
  },
  link: {
    color: '#007AFF',
    marginTop: 4,
  },
});

export default ChildCourseAnnouncementsScreen;
