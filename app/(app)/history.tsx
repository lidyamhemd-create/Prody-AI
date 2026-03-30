import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, IconButton } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { useFocusEffect } from 'expo-router';
import { taskService } from '../../services/supabase/task';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import { Task } from '../../types/task';

export default function HistoryScreen() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPreviousTasks = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const allTasks = await taskService.getTasks(user.id);
      const previous = allTasks.filter(task => task.status === 'completed' || task.status === 'failed');
      setTasks(previous);
    } catch (e) {
      setTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPreviousTasks();
  };

  useEffect(() => {
    fetchPreviousTasks();
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      fetchPreviousTasks();
    }, [user])
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} 
        contentContainerStyle={{ padding: 20, paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>History</Text>
          <IconButton icon="refresh" onPress={onRefresh} />
        </View>
        {loading ? (
          <Text style={styles.loading}>Loading...</Text>
        ) : tasks.length === 0 ? (
          <Text style={styles.empty}>No previous tasks yet.</Text>
        ) : (
          tasks.map(task => (
            <Card
              key={task.id}
              style={[styles.taskCard, task.status === 'completed' ? styles.completed : styles.failed]}
            >
              <Card.Content>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskDesc}>{task.description}</Text>
                <Text style={styles.taskStatus}>{task.status === 'completed' ? 'Completed' : 'Failed'}</Text>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>
      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#222',
  },
  loading: {
    textAlign: 'center',
    marginTop: 20,
    color: '#888',
  },
  empty: {
    textAlign: 'center',
    marginTop: 20,
    color: '#888',
  },
  taskCard: {
    borderRadius: 16,
    marginBottom: 16,
    padding: 8,
  },
  completed: {
    backgroundColor: '#E8F5E9', // light green
  },
  failed: {
    backgroundColor: '#FFEBEE', // light red
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
  },
  taskDesc: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  taskStatus: {
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 6,
    color: '#222',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
  },
}); 