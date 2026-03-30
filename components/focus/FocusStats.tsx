import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { FocusSessionStats } from '../../types/focus';

interface FocusStatsProps {
  stats: FocusSessionStats;
}

const FocusStats: React.FC<FocusStatsProps> = ({ stats }) => {
  const theme = useTheme();

  const formatDuration = (minutes: number) => {
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatPercentage = (value: number) => {
    if (typeof value !== 'number') return '0%';
    return `${(value * 100).toFixed(0)}%`;
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.title}>Focus Statistics</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.total_sessions || 0}</Text>
              <Text style={styles.statLabel}>Total Sessions</Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatDuration(stats.total_duration)}</Text>
              <Text style={styles.statLabel}>Total Focus Time</Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatDuration(stats.average_duration)}</Text>
              <Text style={styles.statLabel}>Avg. Session</Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatPercentage(stats.completion_rate)}</Text>
              <Text style={styles.statLabel}>Completion Rate</Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.total_interruptions || 0}</Text>
              <Text style={styles.statLabel}>Total Interruptions</Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {stats.average_interruptions?.toFixed(1) || 'N/A'}
              </Text>
              <Text style={styles.statLabel}>Avg. Interruptions</Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  card: {
    elevation: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  statItem: {
    width: '45%',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

export default FocusStats; 