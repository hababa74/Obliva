import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { colors, spacing } from '@/lib/theme';
import type { OblivaDocument, Reminder } from '@/types';
import Button from '@/components/common/Button';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface Stats {
  documents: number;
  members: number;
  openReminders: number;
}

export default function DashboardScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [recentDocs, setRecentDocs] = useState<OblivaDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [docs, members, rems, upcoming, recent] = await Promise.all([
        supabase.from('documents').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase
          .from('reminders')
          .select('id', { count: 'exact', head: true })
          .eq('is_completed', false)
          .eq('is_dismissed', false),
        supabase
          .from('reminders')
          .select('*')
          .eq('is_completed', false)
          .eq('is_dismissed', false)
          .order('due_date', { ascending: true })
          .limit(5),
        supabase
          .from('documents')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3),
      ]);
      setStats({
        documents: docs.count ?? 0,
        members: members.count ?? 0,
        openReminders: rems.count ?? 0,
      });
      setReminders((upcoming.data ?? []) as Reminder[]);
      setRecentDocs((recent.data ?? []) as OblivaDocument[]);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>
        Hallo{profile ? `, ${profile.display_name}` : ''} 👋
      </Text>

      <View style={styles.statsRow}>
        <StatCard label="Dokumente" value={stats?.documents ?? 0} />
        <StatCard label="Mitglieder" value={stats?.members ?? 0} />
        <StatCard label="Offene Termine" value={stats?.openReminders ?? 0} />
      </View>

      <Text style={styles.sectionTitle}>Anstehende Termine</Text>
      {reminders.length === 0 ? (
        <Text style={styles.empty}>Keine anstehenden Termine. 🎉</Text>
      ) : (
        reminders.map((r) => (
          <View key={r.id} style={styles.card}>
            <Text style={styles.cardTitle}>{r.title}</Text>
            <Text style={styles.cardMeta}>Fällig: {r.due_date}</Text>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Zuletzt hinzugefügt</Text>
      {recentDocs.length === 0 ? (
        <Text style={styles.empty}>Noch keine Dokumente hochgeladen.</Text>
      ) : (
        recentDocs.map((d) => (
          <View key={d.id} style={styles.card}>
            <Text style={styles.cardTitle}>{d.file_name}</Text>
            <Text style={styles.cardMeta}>Status: {d.status}</Text>
          </View>
        ))
      )}

      <View style={styles.actions}>
        <Button title="💬 Zum Chat" onPress={() => router.push('/(main)/chat')} />
        <Button
          title="📄 Dokumente"
          variant="secondary"
          onPress={() => router.push('/(main)/documents')}
        />
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm, maxWidth: 800, width: '100%', alignSelf: 'center' },
  greeting: { fontSize: 26, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  empty: { color: colors.textMuted, fontSize: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { color: colors.text, fontWeight: '600', fontSize: 15 },
  cardMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
});
