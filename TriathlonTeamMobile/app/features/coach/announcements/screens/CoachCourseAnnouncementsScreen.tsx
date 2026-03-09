import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TextInput,
  Button,
  Switch,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import type { CoachAnnouncementsStackParamList } from '../../../../navigation/CoachAnnouncementsStackNavigator';
import { useCoachCourseAnnouncements } from '../hooks/useCoachCourseAnnouncements';

const CoachCourseAnnouncementsScreen: React.FC = () => {
  const route = useRoute<RouteProp<CoachAnnouncementsStackParamList, 'CoachCourseAnnouncements'>>();
  const { courseId, courseName } = route.params;
  const { items, loading, error, submitting, reload, create, togglePinned, remove } =
    useCoachCourseAnnouncements(courseId);

  const [content, setContent] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [pinAfterPost, setPinAfterPost] = useState(false);

  const handleSubmit = async () => {
    await create(content, { pinAfterPost, videoUrl });
    setContent('');
    setVideoUrl('');
    setPinAfterPost(false);
  };

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {courseName ? <Text style={styles.title}>{courseName}</Text> : null}
      </View>

      <View style={styles.composeBox}>
        <Text style={styles.composeLabel}>Anunț nou</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Scrie mesajul pentru părinți..."
          value={content}
          onChangeText={setContent}
          multiline
        />
        <TextInput
          style={styles.textInput}
          placeholder="Link video (opțional)"
          value={videoUrl}
          onChangeText={setVideoUrl}
        />
        <View style={styles.pinRow}>
          <Text style={styles.pinLabel}>Păstrează sus (pin)</Text>
          <Switch value={pinAfterPost} onValueChange={setPinAfterPost} />
        </View>
        <Button title="Trimite anunț" onPress={handleSubmit} disabled={submitting} />
      </View>

      {items.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>Nu există anunțuri pentru acest curs încă.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const createdAt = new Date(item.createdAt);
            const createdLabel = createdAt.toLocaleString('ro-RO');
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  {item.pinned ? <Text style={styles.pinned}>PINNED</Text> : null}
                  <Text style={styles.meta}>{createdLabel}</Text>
                </View>
                <Text style={styles.content}>{item.content}</Text>
                <Text style={styles.meta}>{item.authorName}</Text>
                <View style={styles.actionsRow}>
                  <Button
                    title={item.pinned ? 'Deblochează' : 'Pin' }
                    onPress={() => togglePinned(item.id, item.pinned)}
                    disabled={submitting}
                  />
                  <Button
                    title="Șterge"
                    onPress={() => remove(item.id)}
                    color="#d11"
                    disabled={submitting}
                  />
                </View>
              </View>
            );
          }}
          refreshing={loading}
          onRefresh={reload}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
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
  composeBox: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  composeLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
    minHeight: 40,
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pinLabel: {
    fontSize: 14,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pinned: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d2691e',
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
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});

export default CoachCourseAnnouncementsScreen;
