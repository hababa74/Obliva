import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing } from '@/lib/theme';
import Button from '@/components/common/Button';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  parent: 'Elternteil',
  child: 'Kind',
};

export default function SettingsScreen() {
  const { profile, session, signOut } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Profil</Text>
      <View style={styles.card}>
        <Text style={styles.name}>{profile?.display_name ?? 'Unbekannt'}</Text>
        <Text style={styles.meta}>{session?.user.email}</Text>
        <Text style={styles.meta}>
          Rolle: {profile ? (ROLE_LABELS[profile.role] ?? profile.role) : '–'}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Über Obliva</Text>
      <View style={styles.card}>
        <Text style={styles.meta}>Version 1.0.0 (Pilot)</Text>
        <Text style={styles.meta}>Nichts wird mehr vergessen.</Text>
      </View>

      <View style={styles.logout}>
        <Button title="Abmelden" variant="danger" onPress={signOut} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm, maxWidth: 600, width: '100%', alignSelf: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  name: { color: colors.text, fontWeight: '700', fontSize: 18 },
  meta: { color: colors.textMuted, fontSize: 13 },
  logout: { marginTop: spacing.xl },
});
