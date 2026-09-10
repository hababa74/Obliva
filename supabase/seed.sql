-- Obliva — Testdaten (nur Entwicklung!)
-- Hinweis: profiles benoetigen echte auth.users. Fuer lokale Tests zuerst
-- 5 Nutzer ueber die App registrieren, dann deren UUIDs hier einsetzen.
-- Alternativ: Supabase Dashboard -> Auth -> Users manuell anlegen.

-- Beispiel-Entitaeten
INSERT INTO entities (name, entity_type) VALUES
  ('Familie Mustermann', 'topic'),
  ('Buergeramt Hannover', 'authority'),
  ('Hausarztpraxis Dr. Beispiel', 'doctor'),
  ('Stadtwerke Hannover', 'organization')
ON CONFLICT (name, entity_type) DO NOTHING;
