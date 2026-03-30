import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import { useAuth } from '../../hooks/useAuth';
import { focusService } from '../../services/supabase/focus';
import { offlineTaskService } from '../../services/offline/taskService';
import { useFocusEffect } from 'expo-router';
import { colors } from '../../constants/theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TROPHY_ICONS = ['🏆','🥇','🎓','🚀','💎','⭐','🎯','🔥','🏅','👑'];

function getTrophy(index: number): string {
  return TROPHY_ICONS[index % TROPHY_ICONS.length];
}

function fmtDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return s; }
}

function fmtMins(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function Bar({ value, max, color, height = 5 }: { value: number; max: number; color: string; height?: number }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <View style={{ backgroundColor: colors.surfaceHighlight, borderRadius: 99, height, overflow: 'hidden', width: '100%' }}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 99 }} />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ShelfScreen() {
  const { user } = useAuth();
  const [completedTasks, setCompletedTasks] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [focusStats, setFocusStats] = useState({ total_sessions: 0, total_duration: 0, completion_rate: 0 });

  const loadData = useCallback(async () => {
    if (!user) return;
    const [all, stats] = await Promise.all([
      offlineTaskService.getTasks(user.id),
      focusService.getStats(user.id),
    ]);
    setAllTasks(all);
    setCompletedTasks(all.filter((t: any) => t.status === 'completed'));
    setFocusStats(stats as any);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const failedCount = allTasks.filter((t: any) => t.status === 'failed').length;
  const activeCount = allTasks.filter((t: any) => t.status !== 'completed' && t.status !== 'failed').length;
  const completionRate = allTasks.length > 0
    ? Math.round((completedTasks.length / allTasks.length) * 100)
    : 0;
  const focusMinutes = Math.round(focusStats.total_duration / 60);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 20, paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 40 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>ACHIEVEMENTS</Text>
          <Text style={styles.headerTitle}>Trophy Shelf</Text>
          <Text style={styles.headerSub}>Every completed quest lives here forever.</Text>
        </View>

        {/* Stats summary row */}
        <View style={styles.statsRow}>
          {[
            { val: String(completedTasks.length), label: 'completed', color: colors.green },
            { val: `${completionRate}%`, label: 'rate', color: colors.gold },
            { val: fmtMins(focusMinutes), label: 'focus time', color: colors.blue },
            { val: String(failedCount), label: 'failed', color: colors.error },
          ].map(({ val, label, color }) => (
            <View key={label} style={styles.statCard}>
              <Text style={[styles.statVal, { color }]}>{val}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Completion bar */}
        <View style={styles.rateCard}>
          <View style={styles.rateRow}>
            <Text style={styles.rateLabel}>Overall completion rate</Text>
            <Text style={[styles.rateVal, { color: colors.green }]}>{completionRate}%</Text>
          </View>
          <Bar value={completedTasks.length} max={allTasks.length} color={colors.green} height={6} />
          <Text style={styles.rateSub}>{completedTasks.length} of {allTasks.length} total tasks</Text>
        </View>

        {/* Trophy grid */}
        {completedTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏆</Text>
            <Text style={styles.emptyTitle}>Your shelf is empty — for now.</Text>
            <Text style={styles.emptyText}>Complete a task to earn your first trophy.</Text>
          </View>
        ) : (
          <>
            {/* Trophy icons grid */}
            <View style={styles.trophyGrid}>
              {completedTasks.map((t, i) => (
                <View key={t.id} style={styles.trophyIcon} title={t.title}>
                  <Text style={{ fontSize: 28 }}>{getTrophy(i)}</Text>
                  <Text style={styles.trophyIconLabel} numberOfLines={1}>
                    {t.title?.split(' ').slice(0, 2).join(' ')}
                  </Text>
                </View>
              ))}
            </View>

            {/* Completed task list */}
            <Text style={styles.sectionLabel}>COMPLETED QUESTS</Text>
            {completedTasks.slice().reverse().map((task, i) => (
              <View key={task.id} style={styles.trophyCard}>
                <Text style={styles.trophyCardIcon}>{getTrophy(completedTasks.length - 1 - i)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trophyCardTitle}>{task.title}</Text>
                  {task.description ? (
                    <Text style={styles.trophyCardDesc} numberOfLines={2}>{task.description}</Text>
                  ) : null}
                  {task.updated_at && (
                    <Text style={[styles.trophyCardDate, { color: colors.green }]}>
                      Completed {fmtDate(task.updated_at)}
                    </Text>
                  )}
                </View>
                <Text style={styles.trophyCardCheck}>✓</Text>
              </View>
            ))}
          </>
        )}

        {/* Focus sessions section */}
        {focusStats.total_sessions > 0 && (
          <View style={styles.focusSummary}>
            <Text style={styles.sectionLabel}>FOCUS SUMMARY</Text>
            <View style={styles.focusRow}>
              <View style={styles.focusCard}>
                <Text style={[styles.focusVal, { color: colors.green }]}>{focusStats.total_sessions}</Text>
                <Text style={styles.focusLabel}>sessions</Text>
              </View>
              <View style={styles.focusCard}>
                <Text style={[styles.focusVal, { color: colors.blue }]}>{fmtMins(focusMinutes)}</Text>
                <Text style={styles.focusLabel}>total focus</Text>
              </View>
              <View style={styles.focusCard}>
                <Text style={[styles.focusVal, { color: colors.gold }]}>
                  {Math.round(focusStats.completion_rate ?? 0)}%
                </Text>
                <Text style={styles.focusLabel}>session rate</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <BottomNavBar />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },

  header: { marginBottom: 20, paddingTop: 32 },
  headerLabel: { fontSize: 10, color: colors.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  headerSub: { fontSize: 10, color: colors.textMuted, marginTop: 3 },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 10,
    paddingVertical: 10, borderWidth: 0.5, borderColor: colors.border, alignItems: 'center',
  },
  statVal: { fontSize: 14, fontWeight: '700' },
  statLabel: { fontSize: 8, color: colors.textMuted, marginTop: 2 },

  // Completion rate card
  rateCard: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 0.5,
    borderColor: colors.border, padding: 14, marginBottom: 20,
  },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  rateLabel: { fontSize: 12, color: colors.textSecondary },
  rateVal: { fontSize: 14, fontWeight: '700' },
  rateSub: { fontSize: 10, color: colors.textMuted, marginTop: 6 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  emptyText: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },

  // Trophy grid
  trophyGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 0.5, borderColor: colors.border,
    padding: 16, marginBottom: 20,
  },
  trophyIcon: { alignItems: 'center', width: 52, gap: 4 },
  trophyIconLabel: { fontSize: 8, color: colors.textMuted, textAlign: 'center' },

  // Section label
  sectionLabel: { fontSize: 10, color: colors.textMuted, letterSpacing: 2, marginBottom: 10 },

  // Trophy card (completed task list)
  trophyCard: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 0.5,
    borderColor: colors.border, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  trophyCardIcon: { fontSize: 28 },
  trophyCardTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  trophyCardDesc: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  trophyCardDate: { fontSize: 10, fontWeight: '500' },
  trophyCardCheck: { fontSize: 16, color: colors.green, fontWeight: '700' },

  // Focus summary
  focusSummary: { marginTop: 8 },
  focusRow: { flexDirection: 'row', gap: 8 },
  focusCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 0.5,
    borderColor: colors.border, paddingVertical: 12, alignItems: 'center',
  },
  focusVal: { fontSize: 16, fontWeight: '700' },
  focusLabel: { fontSize: 9, color: colors.textMuted, marginTop: 2 },
});
