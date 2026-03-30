import React, { useEffect, useState, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, TextInput as RNTextInput,
} from 'react-native';
import { Text, Portal, Modal, FAB, TextInput, RadioButton } from 'react-native-paper';
import { ScrollView as RNScrollView } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { habitService } from '../../services/supabase/habitService';
import { Habit, HabitHistoryEntry } from '../../types/habit';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { colors } from '../../constants/theme';

// ─── Constants ────────────────────────────────────────────────────────────────
const DAYS_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const HABIT_EMOJIS = ['🏃','📚','🧘','💧','🍎','📝','💪','🛏️','🧹','🎨','🎸','🚴','🏊','🥗','🧑‍💻','📖','🦷','🧑‍🍳','🚶','🎮','🧑‍🔬','🧑‍🎓','🔥','⭐','🏆','🌱'];
const DEFAULT_FORM = { title: '', description: '', frequency: 'daily', icon: '🌱', days: [0,1,2,3,4,5,6], notifyTime: null as string | null };
const BANK_KEY = (id: string) => `@prodyai_habit_bank_${id}`;
const LOG_KEY = (id: string, date: string) => `@prodyai_habit_log_${id}_${date}`;

// ─── Date helpers ─────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().split('T')[0]; }

function getLast14Days(): string[] {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().split('T')[0];
  });
}

function dayLetter(ds: string) {
  return new Date(ds + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' }).slice(0, 1);
}

function fmtDate(ds: string) {
  return new Date(ds + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

// ─── Day Dot ──────────────────────────────────────────────────────────────────
function DayDot({ ratio, color, isToday }: { ratio: number; color: string; isToday: boolean }) {
  const filled = ratio >= 1;
  const partial = ratio > 0 && ratio < 1;
  return (
    <View style={[
      styles.dot,
      filled && { backgroundColor: color },
      partial && { backgroundColor: color + '66', borderColor: color },
      isToday && { borderColor: color, borderWidth: 1.5 },
    ]} />
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <View style={{ backgroundColor: colors.surfaceHighlight, borderRadius: 99, height: 4, overflow: 'hidden', flex: 1 }}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 99 }} />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HabitsScreen() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  // Per-habit local log amounts (for the input field)
  const [logInputs, setLogInputs] = useState<Record<string, string>>({});
  // Banks loaded from AsyncStorage: habitId → banked units
  const [banks, setBanks] = useState<Record<string, number>>({});
  // Today's log amounts from AsyncStorage: habitId → logged today
  const [todayLogs, setTodayLogs] = useState<Record<string, number>>({});

  const fetchHabits = useCallback(async () => {
    if (!user) return;
    const userHabits = await habitService.getHabits(user.id);
    setHabits(userHabits);
    // Load banks and today's logs from AsyncStorage
    const bankMap: Record<string, number> = {};
    const todayMap: Record<string, number> = {};
    for (const h of userHabits) {
      const bankRaw = await AsyncStorage.getItem(BANK_KEY(h.id));
      bankMap[h.id] = bankRaw ? Number(bankRaw) : 0;
      const logRaw = await AsyncStorage.getItem(LOG_KEY(h.id, today()));
      todayMap[h.id] = logRaw ? Number(logRaw) : 0;
    }
    setBanks(bankMap);
    setTodayLogs(todayMap);
  }, [user]);

  useFocusEffect(useCallback(() => { fetchHabits(); }, [fetchHabits]));
  useEffect(() => { fetchHabits(); }, [fetchHabits]);

  // ── Notifications ────────────────────────────────────────────────────────────
  async function scheduleHabitNotification(habit: typeof DEFAULT_FORM & { notification_id?: string }) {
    if (!habit.notifyTime) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') await Notifications.requestPermissionsAsync();
    if (habit.notification_id) await Notifications.cancelScheduledNotificationAsync(habit.notification_id);
    const notifyDate = new Date(habit.notifyTime);
    if (notifyDate < new Date()) notifyDate.setDate(notifyDate.getDate() + 1);
    return Notifications.scheduleNotificationAsync({
      content: { title: habit.title, body: habit.description || 'Time for your habit!', sound: true },
      trigger: { hour: notifyDate.getHours(), minute: notifyDate.getMinutes(), repeats: true } as any,
    });
  }

  // ── Create habit ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user || !form.title.trim()) return;
    try {
      let notificationId;
      if (form.notifyTime) notificationId = await scheduleHabitNotification(form as any);
      await habitService.addHabit({
        user_id: user.id, userId: user.id,
        title: form.title.trim(), description: form.description.trim(),
        progress: 0,
        frequency: form.frequency as 'daily' | 'weekly' | 'monthly',
        icon: form.icon, streak: 0, history: [],
        days: form.frequency === 'daily' ? [0,1,2,3,4,5,6] : form.days,
        notifyTime: form.notifyTime, notification_id: notificationId,
      });
      setModalVisible(false);
      setForm({ ...DEFAULT_FORM });
      fetchHabits();
    } catch (e: any) { console.error('Error creating habit:', e); }
  };

  // ── Log habit progress ────────────────────────────────────────────────────────
  const handleLog = async (habit: Habit) => {
    const raw = logInputs[habit.id];
    const amount = raw ? parseFloat(raw) : 1;
    if (isNaN(amount) || amount <= 0) return;

    const goal = habit.target ?? 1;
    const prevToday = todayLogs[habit.id] || 0;
    const newToday = prevToday + amount;

    // Update AsyncStorage
    await AsyncStorage.setItem(LOG_KEY(habit.id, today()), String(newToday));

    // Bank calculation: surplus over goal
    const prevBank = banks[habit.id] || 0;
    const surplus = Math.max(0, newToday - goal) - Math.max(0, prevToday - goal);
    const newBank = Math.max(0, prevBank + surplus);
    await AsyncStorage.setItem(BANK_KEY(habit.id), String(newBank));

    // Update Supabase
    await habitService.logHabitProgress(habit.id, today(), newToday);

    setTodayLogs(prev => ({ ...prev, [habit.id]: newToday }));
    setBanks(prev => ({ ...prev, [habit.id]: newBank }));
    setLogInputs(prev => ({ ...prev, [habit.id]: '' }));
    fetchHabits();
  };

  // ── Delete habit ──────────────────────────────────────────────────────────────
  const handleDelete = async (habit: Habit) => {
    await habitService.deleteHabit(habit.id);
    await AsyncStorage.removeItem(BANK_KEY(habit.id));
    fetchHabits();
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  const days14 = getLast14Days();

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 20, paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 80 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>ROUTINES</Text>
          <Text style={styles.headerTitle}>Habits</Text>
          <Text style={styles.headerSub}>Surplus goes to your bank. Keep your streaks.</Text>
        </View>

        {habits.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No habits yet</Text>
            <Text style={styles.emptyText}>Tap + to add your first routine</Text>
          </View>
        )}

        {habits.map(habit => {
          const goal = habit.target ?? 1;
          const bank = banks[habit.id] || 0;
          const todayVal = todayLogs[habit.id] || 0;
          const todayPct = Math.min(1, todayVal / goal);
          const habitColor = colors.purple;

          return (
            <View key={habit.id} style={styles.habitCard}>
              {/* Card header */}
              <View style={styles.cardHeader}>
                <Text style={{ fontSize: 26, marginRight: 10 }}>{habit.icon || '🌱'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.habitTitle}>{habit.title}</Text>
                  {habit.description ? (
                    <Text style={styles.habitDesc}>{habit.description}</Text>
                  ) : null}
                  <Text style={styles.habitMeta}>
                    Goal: {goal} {habit.frequency} · Streak: {habit.streak} days
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  {bank > 0 && (
                    <View style={[styles.bankBadge, { backgroundColor: habitColor + '22' }]}>
                      <Text style={[styles.bankBadgeText, { color: habitColor }]}>{bank} banked</Text>
                    </View>
                  )}
                  <TouchableOpacity onPress={() => handleDelete(habit)}>
                    <Text style={styles.deleteBtn}>×</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 14-day dot grid */}
              <View style={styles.dotGrid}>
                {days14.map(ds => {
                  const entry = habit.history?.find((h: HabitHistoryEntry) => h.date === ds);
                  const val = entry?.value ?? 0;
                  const ratio = goal > 0 ? val / goal : (entry?.completed ? 1 : 0);
                  const isTday = ds === today();
                  return (
                    <View key={ds} style={styles.dotCol}>
                      <DayDot ratio={ratio} color={habitColor} isToday={isTday} />
                      <Text style={[styles.dotLabel, { color: isTday ? habitColor : colors.textMuted }]}>
                        {dayLetter(ds)}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.dotCaption}>14 days · {fmtDate(days14[0])} – {fmtDate(days14[13])}</Text>

              {/* Today progress */}
              <View style={styles.todayRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.todayLabelRow}>
                    <Text style={styles.todayLabel}>Today: {todayVal} / {goal}</Text>
                    {todayPct >= 1 && (
                      <Text style={[styles.completeTag, { color: habitColor }]}>complete ✓</Text>
                    )}
                  </View>
                  <Bar value={todayVal} max={goal} color={habitColor} />
                </View>
              </View>

              {/* Log input */}
              <View style={styles.logRow}>
                <RNTextInput
                  style={styles.logInput}
                  value={logInputs[habit.id] || ''}
                  onChangeText={v => setLogInputs(prev => ({ ...prev, [habit.id]: v }))}
                  placeholder={`Log amount...`}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={[styles.logBtn, { backgroundColor: habitColor }]}
                  onPress={() => handleLog(habit)}
                >
                  <Text style={styles.logBtnText}>log</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        color={colors.background}
      />

      {/* Create habit modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <RNScrollView contentContainerStyle={{ paddingBottom: 16 }}>
            {/* Emoji picker trigger */}
            <TouchableOpacity style={styles.emojiCircle} onPress={() => setEmojiPickerVisible(true)}>
              <Text style={{ fontSize: 36 }}>{form.icon}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create Habit</Text>

            <TextInput
              label="Title" value={form.title} mode="outlined"
              onChangeText={t => setForm(f => ({ ...f, title: t }))}
              style={styles.modalInput}
              theme={{ colors: { background: colors.surfaceHighlight, onSurfaceVariant: colors.textMuted, primary: colors.purple } }}
            />
            <TextInput
              label="Description (optional)" value={form.description} mode="outlined"
              onChangeText={t => setForm(f => ({ ...f, description: t }))}
              style={styles.modalInput} multiline numberOfLines={2}
              theme={{ colors: { background: colors.surfaceHighlight, onSurfaceVariant: colors.textMuted, primary: colors.purple } }}
            />
            <TextInput
              label="Daily goal (e.g. 30 for 30 min)" keyboardType="numeric" mode="outlined"
              onChangeText={t => setForm(f => ({ ...f, target: t } as any))}
              style={styles.modalInput}
              theme={{ colors: { background: colors.surfaceHighlight, onSurfaceVariant: colors.textMuted, primary: colors.purple } }}
            />

            <Text style={styles.modalLabel}>Frequency</Text>
            <RadioButton.Group onValueChange={v => setForm(f => ({ ...f, frequency: v }))} value={form.frequency}>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {['daily', 'weekly', 'monthly'].map(freq => (
                  <TouchableOpacity
                    key={freq}
                    style={[styles.freqBtn, form.frequency === freq && { borderColor: colors.purple, backgroundColor: colors.purpleDim }]}
                    onPress={() => setForm(f => ({ ...f, frequency: freq }))}
                  >
                    <Text style={[styles.freqBtnText, { color: form.frequency === freq ? colors.purple : colors.textMuted }]}>
                      {freq}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </RadioButton.Group>

            {(form.frequency === 'weekly' || form.frequency === 'monthly') && (
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {DAYS_LABELS.map((d, idx) => {
                  const sel = form.days.includes(idx);
                  return (
                    <TouchableOpacity
                      key={d + idx}
                      style={[styles.dayBtn, sel && { backgroundColor: colors.purple, borderColor: colors.purple }]}
                      onPress={() => setForm(f => ({
                        ...f,
                        days: sel ? f.days.filter(i => i !== idx) : [...f.days, idx].sort(),
                      }))}
                    >
                      <Text style={[styles.dayBtnText, { color: sel ? colors.background : colors.textMuted }]}>{d}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity style={styles.timeBtn} onPress={() => setShowTimePicker(true)}>
              <Text style={styles.timeBtnText}>
                {form.notifyTime
                  ? `Notify at ${new Date(form.notifyTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Add reminder (optional)'}
              </Text>
            </TouchableOpacity>
            {showTimePicker && (
              <DateTimePicker
                value={form.notifyTime ? new Date(form.notifyTime) : new Date()}
                mode="time" display="default"
                onChange={(_, d) => { setShowTimePicker(false); if (d) setForm(f => ({ ...f, notifyTime: d.toISOString() })); }}
              />
            )}

            <TouchableOpacity style={styles.createBtn} onPress={handleSave}>
              <Text style={styles.createBtnText}>Create Habit</Text>
            </TouchableOpacity>
          </RNScrollView>

          {/* Emoji picker nested modal */}
          <Portal>
            <Modal visible={emojiPickerVisible} onDismiss={() => setEmojiPickerVisible(false)} contentContainerStyle={styles.emojiModal}>
              <Text style={styles.modalTitle}>Pick an Emoji</Text>
              <RNScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
                {HABIT_EMOJIS.map((emoji, idx) => (
                  <TouchableOpacity
                    key={emoji + idx}
                    style={styles.emojiOption}
                    onPress={() => { setForm(f => ({ ...f, icon: emoji })); setEmojiPickerVisible(false); }}
                  >
                    <Text style={{ fontSize: 28 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </RNScrollView>
            </Modal>
          </Portal>
        </Modal>
      </Portal>

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

  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  emptyText: { fontSize: 12, color: colors.textMuted },

  // Habit card
  habitCard: {
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 0.5, borderColor: colors.border,
    padding: 14, marginBottom: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  habitTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  habitDesc: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  habitMeta: { fontSize: 10, color: colors.textMuted, marginTop: 3 },
  bankBadge: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  bankBadgeText: { fontSize: 9, fontWeight: '600' },
  deleteBtn: { fontSize: 20, color: colors.textMuted, lineHeight: 22 },

  // Dot grid
  dotGrid: { flexDirection: 'row', gap: 3, marginBottom: 3, flexWrap: 'nowrap' },
  dotCol: { flex: 1, alignItems: 'center', gap: 3 },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.surfaceHighlight,
    borderWidth: 0.5, borderColor: colors.border,
  },
  dotLabel: { fontSize: 7 },
  dotCaption: { fontSize: 9, color: colors.textMuted, marginBottom: 12 },

  // Today
  todayRow: { marginBottom: 10 },
  todayLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  todayLabel: { fontSize: 10, color: colors.textMuted },
  completeTag: { fontSize: 10, fontWeight: '600' },

  // Log input
  logRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  logInput: {
    flex: 1, backgroundColor: colors.surfaceHighlight,
    borderRadius: 8, borderWidth: 0.5, borderColor: colors.border,
    paddingHorizontal: 10, paddingVertical: 7,
    color: colors.textPrimary, fontSize: 13,
  },
  logBtn: {
    borderRadius: 8, paddingHorizontal: 18, paddingVertical: 7,
    justifyContent: 'center', alignItems: 'center',
  },
  logBtnText: { fontSize: 13, fontWeight: '700', color: colors.background },

  // FAB
  fab: {
    position: 'absolute', right: 24, bottom: BOTTOM_NAV_TOTAL_HEIGHT + 24,
    zIndex: 10, backgroundColor: colors.purple,
  },

  // Modal
  modal: {
    backgroundColor: colors.surface, padding: 24, margin: 24,
    borderRadius: 16, borderWidth: 0.5, borderColor: colors.border,
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 16 },
  modalLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 6 },
  modalInput: { marginBottom: 10, backgroundColor: colors.surfaceHighlight },

  emojiCircle: {
    alignSelf: 'center', width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.surfaceHighlight, borderWidth: 0.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },

  freqBtn: {
    flex: 1, borderRadius: 8, borderWidth: 0.5, borderColor: colors.border,
    backgroundColor: colors.surfaceHighlight, paddingVertical: 7, alignItems: 'center',
  },
  freqBtnText: { fontSize: 11, fontWeight: '600' },

  dayBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surfaceHighlight, borderWidth: 0.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  dayBtnText: { fontSize: 13, fontWeight: '700' },

  timeBtn: {
    borderRadius: 8, borderWidth: 0.5, borderColor: colors.border,
    backgroundColor: colors.surfaceHighlight, paddingVertical: 9, paddingHorizontal: 12,
    marginBottom: 12, alignItems: 'center',
  },
  timeBtnText: { fontSize: 12, color: colors.textSecondary },

  createBtn: {
    backgroundColor: colors.purple, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginTop: 4,
  },
  createBtnText: { fontSize: 14, fontWeight: '700', color: colors.background },

  emojiModal: {
    backgroundColor: colors.surface, padding: 24, margin: 24,
    borderRadius: 16, borderWidth: 0.5, borderColor: colors.border,
  },
  emojiOption: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', margin: 6,
    backgroundColor: colors.surfaceHighlight, borderWidth: 0.5, borderColor: colors.border,
  },
});
