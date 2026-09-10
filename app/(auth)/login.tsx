import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link, Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { colors, spacing } from '@/lib/theme';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';

export default function LoginScreen() {
  const { session, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (session) return <Redirect href="/(main)" />;

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Bitte E-Mail und Passwort eingeben.');
      return;
    }
    setLoading(true);
    setError(null);
    const err = await signIn(email.trim(), password);
    if (err) setError('Anmeldung fehlgeschlagen: ' + err);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Obliva</Text>
      <Text style={styles.tagline}>Nichts wird mehr vergessen.</Text>
      <View style={styles.form}>
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
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Anmelden" onPress={handleLogin} loading={loading} />
        <Link href="/(auth)/register" style={styles.link}>
          Noch kein Konto? Registrieren
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
  logo: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    gap: spacing.md,
  },
  error: { color: colors.error, fontSize: 13 },
  link: {
    color: colors.accent,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
