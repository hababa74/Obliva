import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { fetchGraphData } from '@/lib/graph';
import { colors, entityColors, spacing } from '@/lib/theme';
import type { GraphData, GraphNode } from '@/types';
import LoadingSpinner from '@/components/common/LoadingSpinner';

// react-force-graph ist eine Web-Bibliothek: auf nativen Plattformen
// zeigen wir einen Platzhalter (App-Support folgt mit Phase 4).
const ForceGraph2D =
  Platform.OS === 'web'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('react-force-graph-2d').default
    : null;

export default function GraphScreen() {
  const [data, setData] = useState<GraphData | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGraphData()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  if (Platform.OS !== 'web' || !ForceGraph2D) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholderEmoji}>🧠</Text>
        <Text style={styles.placeholderTitle}>Graph-Ansicht</Text>
        <Text style={styles.placeholderText}>
          Die interaktive Graph-Ansicht ist aktuell nur in der Web-Version verfügbar.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {data && data.nodes.length > 0 ? (
        <ForceGraph2D
          graphData={data}
          backgroundColor={colors.background}
          nodeLabel="name"
          nodeColor={(node: GraphNode) => entityColors[node.type] ?? colors.textMuted}
          linkColor={() => colors.border}
          linkLabel="label"
          nodeRelSize={7}
          onNodeClick={(node: GraphNode) => setSelected(node)}
        />
      ) : (
        <View style={styles.center}>
          <Text style={styles.placeholderText}>
            Noch keine Verknüpfungen vorhanden. Lade Dokumente hoch, damit Obliva
            das Wissensnetz aufbauen kann.
          </Text>
        </View>
      )}
      {selected ? (
        <View style={styles.detailPanel}>
          <Text style={styles.detailTitle}>{selected.name}</Text>
          <Text style={styles.detailType}>Typ: {selected.type}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  placeholderEmoji: { fontSize: 48, marginBottom: spacing.md },
  placeholderTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  placeholderText: { color: colors.textMuted, textAlign: 'center', fontSize: 14, maxWidth: 420 },
  detailPanel: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 200,
  },
  detailTitle: { color: colors.text, fontWeight: '700', fontSize: 16 },
  detailType: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
