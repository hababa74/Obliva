import { supabase } from './supabase';
import type { GraphData, GraphLink, GraphNode } from '@/types';

// Laedt Entitaeten + Kanten und baut daraus Knoten/Links fuer den Graphen
export async function fetchGraphData(): Promise<GraphData> {
  const [{ data: entities }, { data: edges }, { data: docs }] = await Promise.all([
    supabase.from('entities').select('*'),
    supabase.from('edges').select('*'),
    supabase.from('documents').select('id, file_name'),
  ]);

  const nodes: GraphNode[] = [];
  const seen = new Set<string>();

  for (const e of entities ?? []) {
    nodes.push({ id: `entity:${e.id}`, name: e.name, type: e.entity_type });
    seen.add(`entity:${e.id}`);
  }
  for (const d of docs ?? []) {
    nodes.push({ id: `doc:${d.id}`, name: d.file_name, type: 'document' });
    seen.add(`doc:${d.id}`);
  }

  const links: GraphLink[] = [];
  for (const edge of edges ?? []) {
    const source = edge.source_entity_id
      ? `entity:${edge.source_entity_id}`
      : edge.source_document_id
        ? `doc:${edge.source_document_id}`
        : null;
    const target = edge.target_entity_id
      ? `entity:${edge.target_entity_id}`
      : edge.target_document_id
        ? `doc:${edge.target_document_id}`
        : null;
    if (source && target && seen.has(source) && seen.has(target)) {
      links.push({ source, target, label: edge.label ?? edge.edge_type });
    }
  }

  return { nodes, links };
}
