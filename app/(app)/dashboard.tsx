import React, { useEffect, useState, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Modal, Pressable,
} from 'react-native';
import { Text, FAB, Portal } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { offlineTaskService } from '../../services/offline/taskService';
import { Task } from '../../types/task';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import TaskCardWithSubtasks from '../../components/tasks/TaskCardWithSubtasks';
import * as Haptics from 'expo-haptics';
import { focusService } from '../../services/supabase/focus';
import OfflineIndicator from '../../components/OfflineIndicator';
import Sidebar from '../../components/Sidebar';
import UserAvatar from '../../components/UserAvatar';
import { colors } from '../../constants/theme';

// ─── XP helpers ────────────────────────────────────────────────────────────────
const XP_PER_TASK = 10;
const XP_PER_LEVEL = 100;

function getXPInfo(completedCount: number) {
  const totalXP = completedCount * XP_PER_TASK;
  const level = Math.floor(totalXP / XP_PER_LEVEL) + 1;
  const xpInLevel = totalXP % XP_PER_LEVEL;
  return { totalXP, level, xpInLevel };
}

// ─── Priority helpers ───────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<number, { color: string; label: string }> = {
  1: { color: colors.green,  label: 'low' },
  2: { color: colors.gold,   label: 'medium' },
  3: { color: colors.error,  label: 'high' },
  4: { color: colors.purple, label: 'urgent' },
};
const getPriority = (p?: number) => PRIORITY_CONFIG[p ?? 1] ?? PRIORITY_CONFIG[1];

// ─── Date helpers ───────────────────────────────────────────────────────────────
function parseDate(s: string): Date {
  if (s.includes('T')) return new Date(s);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isToday(s: string): boolean {
  try {
    const t = parseDate(s);
    const n = new Date();
    return t.getFullYear() === n.getFullYear() &&
           t.getMonth() === n.getMonth() &&
           t.getDate() === n.getDate();
  } catch { return false; }
}

function daysUntil(s: string): number {
  const diff = parseDate(s).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function fmtFocusTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Progress Bar ───────────────────────────────────────────────────────────────
function Bar({ value, max, color, height = 5 }: { value: number; max: number; color: string; height?: number }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <View style={{ backgroundColor: colors.surfaceHighlight, borderRadius: 99, height, overflow: 'hidden', width: '100%' }}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 99 }} />
    </View>
  );
}

// ─── Deadline Pill ──────────────────────────────────────────────────────────────
function DeadlinePill({ deadline }: { deadline?: string }) {
  if (!deadline) return null;
  const days = daysUntil(deadline);
  const color = days <= 3 ? colors.error : days <= 14 ? colors.gold : colors.textMuted;
  return (
    <View style={{ backgroundColor: color + '22', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ fontSize: 9, color, fontWeight: '600' }}>{days}d left</Text>
    </View>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { session, loading: authLoading, user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [allActiveTasks, setAllActiveTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFlag, setRefreshFlag] = useState(false);
  const [focusStats, setFocusStats] = useState({ total_duration: 0 });
  const [completedCount, setCompletedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskOrder, setTaskOrder] = useState<string[]>([]);
  const [selectedTaskToSwap, setSelectedTaskToSwap] = useState<number | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const all = await offlineTaskService.getTasks(user.id);
      const active = all.filter(t => t.status !== 'completed' && t.status !== 'failed');
      setAllActiveTasks(active);

      let completed = 0, failed = 0;
      for (const t of all) {
        if (t.status === 'completed') completed++;
        else if (t.status === 'failed') failed++;
      }
      setCompletedCount(completed);
      setFailedCount(failed);
      setStreak(Math.max(0, completed - failed));
    } catch {
      setAllActiveTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { fetchTasks(); }, [fetchTasks]));

  useEffect(() => { fetchTasks(); }, [fetchTasks, refreshFlag]);

  useEffect(() => {
    if (params.refresh) fetchTasks();
  }, [params.refresh]);

  useEffect(() => {
    if (!user) return;
    focusService.getStats(user.id).then(s => setFocusStats(s));
  }, [user, refreshFlag]);

  // ── Derived values ────────────────────────────────────────────────────────────
  const { totalXP, level, xpInLevel } = getXPInfo(completedCount);

  const sortedTasks = allActiveTasks.slice().sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    const ia = taskOrder.indexOf(a.id), ib = taskOrder.indexOf(b.id);
    if (ia !== -1 && ib !== -1) return ia - ib;
    return 0;
  });

  const todayTaskCount = sortedTasks.filter(t => t.deadline && isToday(t.deadline)).length;
  const focusMinutes = Math.round(focusStats.total_duration / 60);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleTaskStatus = async (task: Task, status: 'completed' | 'failed') => {
    try {
      await offlineTaskService.updateTaskStatus(task.id, status);
      setSelectedTask(null);
      setRefreshFlag(f => !f);
    } catch {}
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await offlineTaskService.deleteTask(taskId);
      setRefreshFlag(f => !f);
    } catch {}
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      await offlineTaskService.deleteTask(subtaskId);
      setRefreshFlag(f => !f);
    } catch {}
  };

  const toggleSubtasks = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  };

  const handleTaskPress = (task: Task) => {
    if (selectedTaskToSwap !== null) return;
    setSelectedTask(task);
  };

  const handleLongPress = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedTaskToSwap(index);
  };

  const handleSwapPress = (index: number) => {
    if (selectedTaskToSwap === null) return;
    if (selectedTaskToSwap !== index) {
      const next = [...sortedTasks];
      [next[selectedTaskToSwap], next[index]] = [next[index], next[selectedTaskToSwap]];
      setAllActiveTasks(next);
      setTaskOrder(next.map(t => t.id));
    }
    setSelectedTaskToSwap(null);
  };

  // ── Guards ────────────────────────────────────────────────────────────────────
  if (authLoading) return null;
  if (!session?.user) { router.replace('/(auth)/login'); return null; }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTasks(); }} tintColor={colors.gold} />}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>LIFE HQ</Text>
            <Text style={styles.headerTitle}>Quest Log</Text>
            <Text style={styles.headerSub}>
              {new Date().toLocaleDateString('en', { month: 'short', year: 'numeric' })}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onLongPress={() => setSidebarVisible(true)}>
              <View style={styles.levelBadge}>
                <Text style={styles.levelText}>LVL {level}</Text>
              </View>
              <Text style={styles.xpTotal}>{totalXP} XP total</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── XP Bar ── */}
        <View style={styles.xpBarContainer}>
          <View style={styles.xpBarRow}>
            <Text style={styles.xpBarLabel}>Level progress</Text>
            <Text style={styles.xpBarValue}>{xpInLevel} / {XP_PER_LEVEL} XP</Text>
          </View>
          <Bar value={xpInLevel} max={XP_PER_LEVEL} color={colors.gold} height={5} />
        </View>

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          {[
            { val: totalXP > 0 ? `+${Math.min(completedCount, 9) * XP_PER_TASK}` : '0', label: 'today XP', color: colors.gold },
            { val: `${completedCount}/${completedCount + sortedTasks.length}`, label: 'tasks done', color: colors.green },
            { val: fmtFocusTime(focusMinutes), label: 'focus time', color: colors.blue },
            { val: String(streak), label: streak === 1 ? 'day streak' : 'streak', color: colors.pink },
          ].map(({ val, label, color }) => (
            <View key={label} style={styles.statCard}>
              <Text style={[styles.statVal, { color }]}>{val}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* ── Today Banner ── */}
        {todayTaskCount > 0 && (
          <View style={styles.todayBanner}>
            <Text style={styles.todayText}>
              {todayTaskCount} {todayTaskCount === 1 ? 'quest' : 'quests'} due today
            </Text>
          </View>
        )}

        {/* ── Section label ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>ACTIVE QUESTS</Text>
          <Text style={styles.sectionCount}>{sortedTasks.filter(t => !t.parent_task_id).length}</Text>
        </View>

        {/* ── Task List ── */}
        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading quests...</Text>
          </View>
        ) : sortedTasks.filter(t => !t.parent_task_id).length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Your quest log is empty</Text>
            <Text style={styles.emptyText}>Add a task to get started</Text>
          </View>
        ) : (
          <View style={styles.taskList}>
            {sortedTasks.map((task, index) => {
              if (task.parent_task_id) return null;
              const { color: pColor, label: pLabel } = getPriority(task.priority);
              const isSelected = selectedTaskToSwap === index;
              const subtasks = sortedTasks.filter(t => t.parent_task_id === task.id);
              const completedSubs = subtasks.filter(t => t.status === 'completed').length;

              return (
                <TouchableOpacity
                  key={task.id}
                  activeOpacity={0.85}
                  onLongPress={() => handleLongPress(index)}
                  onPress={() => selectedTaskToSwap !== null ? handleSwapPress(index) : handleTaskPress(task)}
                  style={[
                    styles.taskCard,
                    isSelected && { borderColor: colors.gold, borderWidth: 1.5 },
                  ]}
                >
                  {/* Priority stripe */}
                  <View style={[styles.priorityStripe, { backgroundColor: pColor }]} />

                  <View style={styles.taskBody}>
                    {/* Title row */}
                    <View style={styles.taskTitleRow}>
                      <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                      <View style={[styles.priorityPill, { backgroundColor: pColor + '22' }]}>
                        <Text style={[styles.priorityPillText, { color: pColor }]}>{pLabel}</Text>
                      </View>
                    </View>

                    {/* Description */}
                    {task.description ? (
                      <Text style={styles.taskDesc} numberOfLines={2}>{task.description}</Text>
                    ) : null}

                    {/* Meta row */}
                    <View style={styles.taskMeta}>
                      {task.deadline && <DeadlinePill deadline={task.deadline} />}
                      {subtasks.length > 0 && (
                        <Text style={styles.subTaskCount}>{completedSubs}/{subtasks.length} steps</Text>
                      )}
                    </View>

                    {/* Subtask progress bar */}
                    {subtasks.length > 0 && (
                      <View style={{ marginTop: 8 }}>
                        <Bar value={completedSubs} max={subtasks.length} color={pColor} height={3} />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── Task Detail Modal ── */}
      <Portal>
        <Modal
          visible={!!selectedTask}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedTask(null)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setSelectedTask(null)}>
            <Pressable style={styles.modalBox} onPress={e => e.stopPropagation()}>
              {selectedTask && (
                <>
                  <View style={styles.modalHeader}>
                    <View style={[styles.modalStripe, { backgroundColor: getPriority(selectedTask.priority).color }]} />
                    <Text style={styles.modalTitle}>{selectedTask.title}</Text>
                  </View>
                  {selectedTask.description ? (
                    <Text style={styles.modalDesc}>{selectedTask.description}</Text>
                  ) : null}
                  {selectedTask.deadline && (
                    <Text style={styles.modalMeta}>
                      Due: {parseDate(selectedTask.deadline).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  )}
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalBtn, { backgroundColor: colors.green }]}
                      onPress={() => handleTaskStatus(selectedTask, 'completed')}
                    >
                      <Text style={styles.modalBtnText}>Complete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalBtn, { backgroundColor: colors.error }]}
                      onPress={() => handleTaskStatus(selectedTask, 'failed')}
                    >
                      <Text style={styles.modalBtnText}>Failed</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalBtn, { backgroundColor: colors.surfaceHighlight }]}
                      onPress={() => setSelectedTask(null)}
                    >
                      <Text style={[styles.modalBtnText, { color: colors.textMuted }]}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      </Portal>

      <BottomNavBar />

      {/* Chat FAB */}
      <FAB
        icon="chat"
        style={styles.chatFab}
        onPress={() => router.push('/(app)/chat')}
        color={colors.background}
      />

      <OfflineIndicator />

      <Sidebar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.surfaceHighlight,
  },
  headerLabel: {
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  levelBadge: {
    backgroundColor: colors.goldDim,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  levelText: {
    fontSize: 11,
    color: colors.gold,
    fontWeight: '600',
  },
  xpTotal: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },

  // XP Bar
  xpBarContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  xpBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  xpBarLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  xpBarValue: {
    fontSize: 10,
    color: colors.gold,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderWidth: 0.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 8,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },

  // Today banner
  todayBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: colors.goldDim,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: colors.gold + '44',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  todayText: {
    fontSize: 12,
    color: colors.gold,
    fontWeight: '500',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 10,
    color: colors.textMuted,
  },

  // Task list
  taskList: {
    paddingHorizontal: 20,
    gap: 10,
    paddingBottom: 10,
  },
  taskCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: colors.border,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  priorityStripe: {
    width: 4,
    borderRadius: 0,
  },
  taskBody: {
    flex: 1,
    padding: 12,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  priorityPill: {
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  priorityPillText: {
    fontSize: 9,
    fontWeight: '600',
  },
  taskDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 6,
    lineHeight: 16,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  subTaskCount: {
    fontSize: 9,
    color: colors.textMuted,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: colors.border,
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalStripe: {
    width: 4,
    alignSelf: 'stretch',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    padding: 16,
  },
  modalDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingHorizontal: 20,
    paddingBottom: 10,
    lineHeight: 20,
  },
  modalMeta: {
    fontSize: 11,
    color: colors.textMuted,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  modalBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.background,
  },

  // FAB
  chatFab: {
    position: 'absolute',
    right: 24,
    bottom: BOTTOM_NAV_TOTAL_HEIGHT + 20,
    backgroundColor: colors.purple,
    zIndex: 200,
    elevation: 6,
  },
});
