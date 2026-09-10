import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Pressable,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { pickDocument, uploadAndScan } from '@/lib/scan';
import { colors, spacing } from '@/lib/theme';
import type { OblivaDocument } from '@/types';
import Button from '@/components/common/Button';
import LoadingSpinner from '@/components/common/LoadingSpinner';

const STATUS_LABELS: Record<string, string> = {
  pending: '⏳ Wartet',
  processing: '⚙️ Wird analysiert',
  done: '✅ Fertig',
  error: '❌ Fehler',
};

export default function DocumentsScreen() {
  const { session } = useAuth();
  const [documents, setDocuments] = useState<OblivaDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });
    setDocuments((data ?? []) as OblivaDocument[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = async () => {
    if (!session || uploading) return;
    const asset = await pickDocument();
    if (!asset) return;
    setUploading(true);
    setNotice(null);
    const result = await uploadAndScan(asset, session.user.id);
    if (result.duplicate) setNotice(`„${asset.name}“ existiert bereits.`);
    else if (result.error) setNotice(result.error);
    else setNotice(`„${asset.name}“ hochgeladen – Analyse läuft.`);
    setUploading(false);
    load();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button
          title={uploading ? 'Lädt hoch…' : '📤 Dokument hochladen'}
          onPress={handleUpload}
          loading={uploading}
        />
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </View>
      <FlatList
        data={documents}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={load} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Noch keine Dokumente. Lade das erste hoch – Obliva analysiert es automatisch.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.fileIcon}>
                {item.mime_type.startsWith('image/') ? '🖼️' : '📄'}
              </Text>
              <View style={styles.cardBody}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {item.file_name}
                </Text>
                <Text style={styles.meta}>
                  {STATUS_LABELS[item.status] ?? item.status} ·{' '}
                  {new Date(item.created_at).toLocaleDateString('de-DE')}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.md, gap: spacing.sm },
  notice: { color: colors.accent, fontSize: 13 },
  list: { padding: spacing.md, gap: spacing.sm, maxWidth: 800, width: '100%', alignSelf: 'center' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl, fontSize: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  fileIcon: { fontSize: 28 },
  cardBody: { flex: 1 },
  fileName: { color: colors.text, fontWeight: '600', fontSize: 15 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
