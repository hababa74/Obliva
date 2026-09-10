import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Link, Redirect, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { colors, spacing } from '@/lib/theme';
import type { Role } from '@/types';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';

export default function RegisterScreen() {
  const { session, signUp } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('parent');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (session) return <Redirect href="/(main)" />;

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || password.length < 6) {
      setError('Bitte alle Felder ausfüllen (Passwort min. 6 Zeichen).');
      return;
    }
    setLoading(true);
    setError(null);
    const err = await signUp(email.trim(), password, name.trim(), role);
    setLoading(false);
    if (err) {
      setError('Registrierung fehlgeschlagen: ' + err);
    } else {
      router.replace('/(auth)/login');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Konto erstellen</Text>
      <View style={styles.form}>
        <Input placeholder="Name" value={name} onChangeText={setName} />
        <Input
          placeholder="E-Mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Input
          placeholder="Passwort"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Text style={styles.roleLabel}>Rolle in der Familie:</Text>
        <View style={styles.roleRow}>
          {(['parent', 'child'] as Role[]).map((r) => (
            <Pressable
              key={r}
              onPress={() => setRole(r)}
              style={[styles.roleChip, role === r && styles.roleChipActive]}
            >
              <Text style={role === r ? styles.roleTextActive : styles.roleText}>
                {r === 'parent' ? 'Elternteil' : 'Kind'}
              </Text>
            </Pressable>
          ))}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Registrieren" onPress={handleRegister} loading={loading} />
        <Link href="/(auth)/login" style={styles.link}>
          Schon ein Konto? Anmelden
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  form: { width: '100%', maxWidth: 400, gap: spacing.md },
  roleLabel: { color: colors.textMuted, fontSize: 13 },
  roleRow: { flexDirection: 'row', gap: spacing.sm },
  roleChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleText: { color: colors.textMuted },
  roleTextActive: { color: colors.text, fontWeight: '600' },
  error: { color: colors.error, fontSize: 13 },
  link: { color: colors.accent, textAlign: 'center', marginTop: spacing.sm },
});
