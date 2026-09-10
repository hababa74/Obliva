# Obliva — Architektur

## Grundprinzip

Eine Expo-Codebase für Web, iOS und Android. Der Client spricht ausschließlich mit Supabase; alle KI-Aufrufe laufen serverseitig in Edge Functions, damit der Gemini API Key nie im Client landet.

## Module

### 1. Auth (`lib/auth.ts`)

Supabase Auth mit E-Mail/Passwort. Beim Registrieren wird ein Eintrag in `profiles` erstellt (Name + Rolle: `admin` / `parent` / `child`). Row Level Security steuert die Sichtbarkeit: Eltern sehen alles, Kinder nur eigene Daten.

### 2. Chat-Workspace (`app/(main)/chat.tsx` + `functions/chat`)

RAG-Flow pro Nachricht:

1. User-Nachricht → `chat_messages`
2. Embedding der Frage (Gemini Embedding, 768 Dimensionen)
3. `match_embeddings` (Postgres-Funktion, pgvector Cosine-Suche) → Top-5 Chunks
4. Prompt = System-Prompt + Chunks + letzte 10 Nachrichten + Frage
5. Gemini antwortet mit Structured Output (`responseSchema`): `answer`, `sources`, `extracted_facts`
6. Antwort wird mit Quellen und Token-Verbrauch gespeichert

### 3. Scan-Pipeline (`lib/scan.ts` + `functions/scan`)

1. `pickDocument` (Bilder, PDF, Word) → SHA-256-Hash → Duplikat-Check
2. Upload in Storage-Bucket `documents` (privat, 20 MB Limit)
3. `scan`-Funktion lädt die Datei und schickt sie als `inlineData` an Gemini Flash (multimodal)
4. Structured Output liefert in **einem** Call: Titel, Dokumenttyp, Person, Schlüsseldaten, Entitäten, Reminders und die Markdown-Indexdatei (Ein-Pass-Extraktion)
5. Entitäten werden upserted (`UNIQUE(name, entity_type)`) und per Kante mit dem Dokument verknüpft
6. Reminders landen im Termin-Radar (`reminders`), Embeddings in `embeddings`

### 4. Graph (`lib/graph.ts` + `app/(main)/graph.tsx`)

Entitäten und Dokumente werden als Knoten, `edges` als Kanten gerendert (react-force-graph, 2D). Farbcodierung nach Entitätstyp. Auf nativen Plattformen aktuell Platzhalter.

### 5. Termin-Radar (`reminders`)

Die Scan-Pipeline legt Reminders mit `due_date` an (z. B. Ablaufdatum eines Ausweises). Das Dashboard zeigt die nächsten 5. Erweiterung in Phase 3: Regel-Engine (z. B. „6 Monate vor Ablauf warnen") + Push via Expo Notifications.

## Orchestrierung / Kosten (Phase 2, vorbereitet)

Bereits umgesetzt:
- Deduplizierung via SHA-256 (keine doppelten Scans)
- Ein-Pass-Extraktion (1 API-Call statt 4)
- Token-Logging (`tokens_used`, `model_used` in `chat_messages`)
- RAG mit Top-5-Chunks statt vollem Kontext

Geplant:
- Modell-Kaskade: Flash-Lite Router → Flash → Pro (Eskalation bei niedriger Confidence)
- Context Caching für System-Prompt und Stammdaten (bis 90 % Rabatt)
- Batch API für Scans und Termin-Radar (50 % Rabatt)
- Semantischer Cache für wiederholte Fragen

## Datenmodell

Siehe `supabase/migrations/001_initial_schema.sql`. Kerntabellen: `profiles`, `documents`, `doc_index`, `entities`, `edges`, `embeddings`, `chat_messages`, `reminders`.

## Sicherheit

- RLS auf allen Tabellen
- Gemini Key nur als Supabase Secret (serverseitig)
- Storage-Bucket privat, Zugriff nur für authentifizierte Familienmitglieder
- Session-Storage: SecureStore (nativ) / localStorage (Web)
