import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useChildren } from '../hooks/useChildren';
import type { ParentChildrenStackParamList } from '../../../../navigation/ParentChildrenStackNavigator';

type NavProp = NativeStackNavigationProp<ParentChildrenStackParamList, 'ChildrenList'>;

const ChildrenListScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { children, loading, error, reload } = useChildren();

  if (loading && children.length === 0) {
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

  if (children.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>Încă nu există copii conectați la acest cont.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={children}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate('ChildDetails', { childId: item.id, childName: item.name })
            }
          >
            <Text style={styles.name}>{item.name}</Text>
            {item.level ? <Text style={styles.level}>Nivel: {item.level}</Text> : null}
          </TouchableOpacity>
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
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listContent: {
    padding: 16,
  },
  card: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  level: {
    fontSize: 14,
    color: '#555',
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

export default ChildrenListScreen;
