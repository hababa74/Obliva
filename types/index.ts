// Obliva — Zentrale TypeScript-Typen

export type Role = 'admin' | 'parent' | 'child';

export interface Profile {
  id: string;
  display_name: string;
  role: Role;
  birthdate: string | null;
  avatar_url: string | null;
  created_at: string;
}

export type DocumentStatus = 'pending' | 'processing' | 'done' | 'error';

export interface OblivaDocument {
  id: string;
  uploaded_by: string;
  person_id: string | null;
  file_name: string;
  file_path: string;
  file_hash: string;
  mime_type: string;
  file_size_bytes: number | null;
  status: DocumentStatus;
  error_message: string | null;
  created_at: string;
}

export interface DocIndex {
  id: string;
  document_id: string;
  person_id: string | null;
  title: string;
  doc_type: string | null;
  markdown_content: string;
  key_data: Record<string, unknown>;
  created_at: string;
}

export type EntityType = 'person' | 'organization' | 'authority' | 'doctor' | 'location' | 'topic';

export interface Entity {
  id: string;
  name: string;
  entity_type: EntityType;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source_entity_id: string | null;
  target_entity_id: string | null;
  source_document_id: string | null;
  target_document_id: string | null;
  edge_type: string;
  label: string | null;
}

export interface Reminder {
  id: string;
  person_id: string | null;
  document_id: string | null;
  title: string;
  description: string | null;
  reminder_type: 'expiry' | 'appointment' | 'checkup' | 'deadline' | 'custom' | null;
  due_date: string;
  is_completed: boolean;
  is_dismissed: boolean;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources: ChatSource[];
  tokens_used: number | null;
  model_used: string | null;
  created_at: string;
}

export interface ChatSource {
  doc_index_id: string;
  title: string;
  relevance?: string;
}

// Antwort der chat-Edge-Function
export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  extracted_facts: Array<{ person: string; fact: string; category: string }>;
}

// Antwort der scan-Edge-Function
export interface ScanResult {
  success: boolean;
  doc_index_id?: string;
  error?: string;
}

// Graph-Daten fuer react-force-graph
export interface GraphNode {
  id: string;
  name: string;
  type: EntityType | 'document';
}

export interface GraphLink {
  source: string;
  target: string;
  label: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
