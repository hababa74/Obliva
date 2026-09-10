-- Obliva — Initiales Datenbank-Schema
-- Postgres + pgvector auf Supabase

CREATE EXTENSION IF NOT EXISTS vector;

-- Familienmitglieder (erweitert Supabase Auth)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'parent' CHECK (role IN ('admin', 'parent', 'child')),
  birthdate DATE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Dokumente (Original-Dateien)
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_by UUID REFERENCES profiles(id) NOT NULL,
  person_id UUID REFERENCES profiles(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_hash TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Markdown-Indexdateien (pro Dokument genau eine)
CREATE TABLE doc_index (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE UNIQUE,
  person_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  doc_type TEXT,
  markdown_content TEXT NOT NULL,
  key_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Extrahierte Entitaeten
CREATE TABLE entities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'organization', 'authority', 'doctor', 'location', 'topic')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name, entity_type)
);

-- Graph-Kanten
CREATE TABLE edges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  target_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  source_document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  target_document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL,
  label TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (
    (source_entity_id IS NOT NULL OR source_document_id IS NOT NULL) AND
    (target_entity_id IS NOT NULL OR target_document_id IS NOT NULL)
  )
);

-- Embeddings fuer semantische Suche
CREATE TABLE embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_index_id UUID REFERENCES doc_index(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Chat-Nachrichten
CREATE TABLE chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  sources JSONB DEFAULT '[]',
  tokens_used INTEGER,
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Termin-Radar / Erinnerungen
CREATE TABLE reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id UUID REFERENCES profiles(id),
  document_id UUID REFERENCES documents(id),
  doc_index_id UUID REFERENCES doc_index(id),
  title TEXT NOT NULL,
  description TEXT,
  reminder_type TEXT CHECK (reminder_type IN ('expiry', 'appointment', 'checkup', 'deadline', 'custom')),
  due_date DATE NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  source_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Vektor-Suche als SQL-Funktion (fuer Edge Function chat)
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(768),
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  doc_index_id UUID,
  chunk_text TEXT,
  title TEXT,
  doc_type TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    e.doc_index_id,
    e.chunk_text,
    d.title,
    d.doc_type,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM embeddings e
  JOIN doc_index d ON d.id = e.doc_index_id
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============ Row Level Security ============

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Hilfsfunktion: eigene Rolle
CREATE OR REPLACE FUNCTION my_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- profiles: alle Familienmitglieder sehen sich gegenseitig (Pilotphase)
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_insert ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- documents / doc_index / reminders / embeddings:
-- admin + parent sehen alles, child nur eigene Eintraege
CREATE POLICY documents_select ON documents FOR SELECT TO authenticated
  USING (my_role() IN ('admin', 'parent') OR uploaded_by = auth.uid() OR person_id = auth.uid());
CREATE POLICY documents_insert ON documents FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY documents_update ON documents FOR UPDATE TO authenticated
  USING (my_role() IN ('admin', 'parent') OR uploaded_by = auth.uid());

CREATE POLICY doc_index_select ON doc_index FOR SELECT TO authenticated
  USING (my_role() IN ('admin', 'parent') OR person_id = auth.uid());

CREATE POLICY reminders_select ON reminders FOR SELECT TO authenticated
  USING (my_role() IN ('admin', 'parent') OR person_id = auth.uid());
CREATE POLICY reminders_update ON reminders FOR UPDATE TO authenticated
  USING (my_role() IN ('admin', 'parent') OR person_id = auth.uid());

CREATE POLICY embeddings_select ON embeddings FOR SELECT TO authenticated USING (true);

-- chat_messages: nur eigene Nachrichten
CREATE POLICY chat_select ON chat_messages FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY chat_insert ON chat_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- entities / edges: alle authentifizierten Nutzer lesend
CREATE POLICY entities_select ON entities FOR SELECT TO authenticated USING (true);
CREATE POLICY edges_select ON edges FOR SELECT TO authenticated USING (true);

-- Schreibzugriffe auf doc_index / entities / edges / embeddings / reminders
-- laufen ueber Edge Functions mit Service Role (umgehen RLS bewusst).

-- Storage-Bucket fuer Dokumente
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documents', 'documents', false, 20971520)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY storage_documents_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents');
CREATE POLICY storage_documents_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');
CREATE POLICY storage_documents_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents');
