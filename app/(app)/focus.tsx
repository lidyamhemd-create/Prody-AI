import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { focusService } from '../../services/supabase/focus';
import { FocusSession, FocusSessionStats } from '../../types/focus';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import { colors } from '../../constants/theme';

// ─── Constants ───────────────────────────────────────────────────────────────
const FOCUS_GOAL_MIN = 180; // default 3h daily goal
const PRESETS = [25, 45, 60, 90];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtMins(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

function today() { return new Date().toISOString().split('T')[0]; }

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
}

function dayLetter(ds: string) {
  return new Date(ds + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' }).slice(0, 1);
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

// ─── Circular display (ring track only — progress shown as text + bar) ────────
function RingDisplay({ label, main, sub, accent, size = 200 }:
  { label: string; main: string; sub: string; accent: string; size?: number }) {
  return (
    <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: colors.surfaceHighlight }]}>
      <Text style={styles.ringLabel}>{label}</Text>
      <Text style={[styles.ringMain, { color: accent }]}>{main}</Text>
      <Text style={styles.ringSub}>{sub}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FocusScreen() {
  const { user } = useAuth();

  // Data state
  const [stats, setStats] = useState<FocusSessionStats>({
    total_sessions: 0, total_duration: 0, average_duration: 0,
    total_interruptions: 0, average_interruptions: 0,
    completion_rate: 0, longest_streak: 0,
  });
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Focus log (minutes per day)
  const [focusLog, setFocusLog] = useState<Record<string, number>>({});
  const [focusGoalMin, setFocusGoalMin] = useState(FOCUS_GOAL_MIN);
  const [showWeekView, setShowWeekView] = useState(false);

  // Session timer state
  const [sessionMin, setSessionMin] = useState(25);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [currentSession, setCurrentSession] = useState<FocusSession | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [sessionsData, statsData] = await Promise.all([
        focusService.getSessions(user.id),
        focusService.getStats(user.id),
      ]);
      setSessions(sessionsData);
      setStats(statsData);

      // Build focusLog: sum minutes per day from sessions
      const log: Record<string, number> = {};
      sessionsData.forEach(s => {
        if (s.status !== 'completed') return;
        const day = s.start_time.split('T')[0];
        const start = new Date(s.start_time).getTime();
        const end = s.end_time ? new Date(s.end_time).getTime() : Date.now();
        const mins = Math.floor((end - start) / 60000);
        log[day] = (log[day] || 0) + mins;
      });
      setFocusLog(log);
    } catch (e) {
      console.error('Focus: loadData error', e);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
  useEffect(() => { loadData(); }, [loadData]);

  // ── Countdown tick ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || isPaused || countdown <= 0) return;
    const id = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          // Auto-complete when time runs out
          handleComplete();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isActive, isPaused, countdown]);

  // ── Session controls ────────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!user) return;
    try {
      const session = await focusService.createSession({
        user_id: user.id,
        start_time: new Date().toISOString(),
        status: 'active',
        interruptions: 0,
        notes: '',
      });
      setCurrentSession(session);
      setCountdown(sessionMin * 60);
      setIsActive(true);
      setIsPaused(false);
    } catch (e) { console.error('Focus: start error', e); }
  };

  const handlePause = () => setIsPaused(p => !p);

  const handleComplete = async () => {
    if (!currentSession || !user) return;
    try {
      await focusService.completeSession(currentSession.id, {
        end_time: new Date().toISOString(),
        status: 'completed',
      });
    } catch (e) { console.error('Focus: complete error', e); }
    setIsActive(false);
    setIsPaused(false);
    setCountdown(0);
    setCurrentSession(null);
    loadData();
  };

  const handleEnd = async () => {
    if (!currentSession || !user) return;
    try {
      await focusService.completeSession(currentSession.id, {
        end_time: new Date().toISOString(),
        status: 'completed',
      });
    } catch {}
    setIsActive(false);
    setIsPaused(false);
    setCountdown(0);
    setCurrentSession(null);
    loadData();
  };

  // ── Derived values ──────────────────────────────────────────────────────────
  const todayMin = focusLog[today()] || 0;
  const yesterdayDate = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; })();
  const yesterdayMin = focusLog[yesterdayDate] || 0;
  const focusPct = Math.min(100, Math.round((todayMin / focusGoalMin) * 100));

  const focusStreak = (() => {
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 60; i++) {
      const ds = d.toISOString().split('T')[0];
      if ((focusLog[ds] || 0) >= focusGoalMin) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return streak;
  })();

  const countdownMin = Math.floor(countdown / 60);
  const countdownSec = countdown % 60;
  const sessionTotal = sessionMin * 60;
  const sessionPct = sessionTotal > 0 ? Math.round(((sessionTotal - countdown) / sessionTotal) * 100) : 0;

  const days7 = getLast7Days();

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={colors.green}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>DEEP WORK</Text>
          <Text style={styles.headerTitle}>Focus</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {/* Yesterday */}
          <View style={[styles.statCard, { borderColor: yesterdayMin >= focusGoalMin ? colors.green + '44' : colors.border }]}>
            <Text style={styles.statCardLabel}>Yesterday</Text>
            <Text style={[styles.statCardVal, { color: yesterdayMin >= focusGoalMin ? colors.green : colors.textMuted }]}>
              {fmtMins(yesterdayMin)}
            </Text>
          </View>

          {/* Daily Goal — tappable */}
          <TouchableOpacity
            style={[styles.statCard, showWeekView && { borderColor: colors.gold }]}
            onPress={() => setShowWeekView(v => !v)}
          >
            <Text style={styles.statCardLabel}>Daily goal</Text>
            <Text style={[styles.statCardVal, { color: colors.gold }]}>
              {Math.floor(focusGoalMin / 60)}h
            </Text>
            <Text style={styles.statCardHint}>tap to expand</Text>
          </TouchableOpacity>

          {/* Streak */}
          <View style={[styles.statCard, focusStreak > 0 && { borderColor: colors.pink + '44' }]}>
            <Text style={styles.statCardLabel}>Streak</Text>
            <Text style={[styles.statCardVal, { color: focusStreak > 0 ? colors.pink : colors.textMuted }]}>
              {focusStreak} {focusStreak === 1 ? 'day' : 'days'}
            </Text>
          </View>
        </View>

        {/* Weekly bar chart */}
        {showWeekView && (
          <View style={styles.weekCard}>
            <Text style={styles.weekTitle}>WEEKLY BUCKETS</Text>
            <View style={styles.weekBars}>
              {days7.map(ds => {
                const mins = focusLog[ds] || 0;
                const pct = Math.min(100, Math.round((mins / focusGoalMin) * 100));
                const isTday = ds === today();
                const barColor = pct >= 100 ? colors.green : pct >= 50 ? colors.gold : colors.surfaceHighlight;
                return (
                  <View key={ds} style={styles.weekBarCol}>
                    <Text style={[styles.weekBarPct, { color: isTday ? colors.gold : colors.textMuted }]}>
                      {pct}%
                    </Text>
                    <View style={styles.weekBarTrack}>
                      <View style={[styles.weekBarFill, { height: `${pct}%` as any, backgroundColor: barColor }]} />
                    </View>
                    <Text style={[styles.weekBarDay, { color: isTday ? colors.gold : colors.textMuted }]}>
                      {dayLetter(ds)}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Goal selector */}
            <View style={styles.goalRow}>
              <Text style={styles.goalLabel}>Daily goal</Text>
              <View style={styles.goalBtns}>
                {[60, 120, 180, 240].map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.goalBtn, focusGoalMin === m && { backgroundColor: colors.goldDim, borderColor: colors.gold }]}
                    onPress={() => setFocusGoalMin(m)}
                  >
                    <Text style={[styles.goalBtnText, { color: focusGoalMin === m ? colors.gold : colors.textMuted }]}>
                      {m / 60}h
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Main ring display */}
        <View style={styles.ringContainer}>
          <RingDisplay
            label="Deep work today"
            main={fmtMins(todayMin)}
            sub={`of ${fmtMins(focusGoalMin)} goal`}
            accent={colors.green}
            size={196}
          />
          {/* Progress bar below ring */}
          <View style={{ width: 196, marginTop: 12 }}>
            <Bar value={todayMin} max={focusGoalMin} color={colors.green} height={6} />
          </View>
          <Text style={styles.ringNote}>{focusPct}% of daily goal</Text>
        </View>

        {/* Active session card */}
        {isActive && (
          <View style={styles.sessionCard}>
            <Text style={styles.sessionCardLabel}>Focus session</Text>

            {/* Countdown display */}
            <View style={styles.countdownBox}>
              <Text style={styles.countdown}>
                {String(countdownMin).padStart(2, '0')}:{String(countdownSec).padStart(2, '0')}
              </Text>
              <Text style={styles.countdownSub}>{isPaused ? 'paused' : 'remaining'}</Text>
            </View>

            {/* Session progress bar */}
            <View style={{ marginVertical: 16 }}>
              <Bar value={sessionPct} max={100} color={colors.green} height={6} />
            </View>

            {/* Controls */}
            <View style={styles.sessionBtns}>
              <TouchableOpacity
                style={[styles.sessionBtn, { backgroundColor: isPaused ? colors.green : colors.surfaceHighlight }]}
                onPress={handlePause}
              >
                <Text style={[styles.sessionBtnText, { color: isPaused ? colors.background : colors.textPrimary }]}>
                  {isPaused ? 'resume' : 'pause'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sessionBtn, { backgroundColor: colors.surfaceHighlight }]}
                onPress={handleEnd}
              >
                <Text style={[styles.sessionBtnText, { color: colors.textMuted }]}>end session</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Setup card (shown when no active session) */}
        {!isActive && (
          <View style={styles.setupCard}>
            <Text style={styles.setupLabel}>Get ready to focus</Text>

            {/* Stepper */}
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setSessionMin(m => Math.max(5, m - 5))}
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </TouchableOpacity>
              <View style={styles.stepperCenter}>
                <Text style={styles.stepperVal}>{sessionMin}</Text>
                <Text style={styles.stepperUnit}>mins</Text>
              </View>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setSessionMin(m => Math.min(120, m + 5))}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Preset buttons */}
            <View style={styles.presets}>
              {PRESETS.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.presetBtn,
                    sessionMin === m && { backgroundColor: colors.greenDim, borderColor: colors.green },
                  ]}
                  onPress={() => setSessionMin(m)}
                >
                  <Text style={[styles.presetBtnText, { color: sessionMin === m ? colors.green : colors.textMuted }]}>
                    {m}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
              <Text style={styles.startBtnText}>Start focus session</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recent sessions */}
        {sessions.length > 0 && (
          <View style={styles.sessionsSection}>
            <Text style={styles.sectionLabel}>RECENT SESSIONS</Text>
            {sessions.slice(0, 5).map(s => {
              const start = new Date(s.start_time);
              const end = s.end_time ? new Date(s.end_time) : null;
              const mins = end ? Math.floor((end.getTime() - start.getTime()) / 60000) : 0;
              return (
                <View key={s.id} style={styles.sessionItem}>
                  <View style={styles.sessionItemLeft}>
                    <Text style={styles.sessionItemDate}>
                      {start.toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={styles.sessionItemTime}>
                      {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {end ? ` → ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' (active)'}
                    </Text>
                    {s.notes ? <Text style={styles.sessionItemNotes}>{s.notes}</Text> : null}
                  </View>
                  <Text style={[styles.sessionItemDur, { color: s.status === 'completed' ? colors.green : colors.textMuted }]}>
                    {mins > 0 ? fmtMins(mins) : '—'}
                  </Text>
                </View>
              );
            })}
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

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.surfaceHighlight,
  },
  headerLabel: { fontSize: 10, color: colors.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },

  // Stats row
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 8 },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 8, borderWidth: 0.5, borderColor: colors.border,
    alignItems: 'center',
  },
  statCardLabel: { fontSize: 10, color: colors.textMuted, marginBottom: 4 },
  statCardVal: { fontSize: 15, fontWeight: '700' },
  statCardHint: { fontSize: 8, color: colors.textMuted, marginTop: 3 },

  // Week view
  weekCard: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 0.5, borderColor: colors.border, padding: 14,
  },
  weekTitle: { fontSize: 10, color: colors.textMuted, letterSpacing: 2, marginBottom: 12 },
  weekBars: { flexDirection: 'row', gap: 6, alignItems: 'flex-end', height: 80, marginBottom: 16 },
  weekBarCol: { flex: 1, alignItems: 'center', gap: 4 },
  weekBarPct: { fontSize: 8 },
  weekBarTrack: { width: '100%', backgroundColor: colors.surfaceHighlight, borderRadius: 4, height: 60, overflow: 'hidden', justifyContent: 'flex-end' },
  weekBarFill: { width: '100%', borderRadius: 4, minHeight: 2 },
  weekBarDay: { fontSize: 9 },
  goalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 10 },
  goalLabel: { fontSize: 11, color: colors.textSecondary },
  goalBtns: { flexDirection: 'row', gap: 6 },
  goalBtn: { borderRadius: 6, borderWidth: 0.5, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.surfaceHighlight },
  goalBtnText: { fontSize: 11, fontWeight: '600' },

  // Ring display
  ringContainer: { alignItems: 'center', paddingVertical: 24 },
  ring: {
    borderWidth: 14, alignItems: 'center', justifyContent: 'center',
  },
  ringLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  ringMain: { fontSize: 26, fontWeight: '700' },
  ringSub: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  ringNote: { fontSize: 10, color: colors.textMuted, marginTop: 8 },

  // Active session card
  sessionCard: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 0.5, borderColor: colors.green + '55', padding: 20,
  },
  sessionCardLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 16, textAlign: 'center' },
  countdownBox: { alignItems: 'center' },
  countdown: { fontSize: 48, fontWeight: '700', color: colors.textPrimary, letterSpacing: 2, fontVariant: ['tabular-nums'] },
  countdownSub: { fontSize: 10, color: colors.textMuted, marginTop: 4 },
  sessionBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  sessionBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  sessionBtnText: { fontSize: 13, fontWeight: '600' },

  // Setup card
  setupCard: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 0.5, borderColor: colors.border, padding: 16,
  },
  setupLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 },
  stepperBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.surfaceHighlight, borderWidth: 0.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperBtnText: { fontSize: 22, color: colors.textPrimary, lineHeight: 28 },
  stepperCenter: { alignItems: 'center', minWidth: 60 },
  stepperVal: { fontSize: 36, fontWeight: '700', color: colors.textPrimary },
  stepperUnit: { fontSize: 10, color: colors.textMuted },
  presets: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  presetBtn: {
    flex: 1, borderRadius: 8, borderWidth: 0.5, borderColor: colors.border,
    backgroundColor: colors.surfaceHighlight, paddingVertical: 6, alignItems: 'center',
  },
  presetBtnText: { fontSize: 12, fontWeight: '600' },
  startBtn: {
    backgroundColor: colors.green, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  startBtnText: { fontSize: 14, fontWeight: '700', color: colors.background },

  // Sessions
  sessionsSection: { paddingHorizontal: 20, marginBottom: 10 },
  sectionLabel: { fontSize: 10, color: colors.textMuted, letterSpacing: 2, marginBottom: 10 },
  sessionItem: {
    backgroundColor: colors.surface, borderRadius: 10, borderWidth: 0.5, borderColor: colors.border,
    padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center',
  },
  sessionItemLeft: { flex: 1 },
  sessionItemDate: { fontSize: 12, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  sessionItemTime: { fontSize: 10, color: colors.textMuted },
  sessionItemNotes: { fontSize: 10, color: colors.textMuted, fontStyle: 'italic', marginTop: 2 },
  sessionItemDur: { fontSize: 13, fontWeight: '700', marginLeft: 12 },
});
