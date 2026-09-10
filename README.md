# Obliva

**Nichts wird mehr vergessen.**

Obliva ist das digitale Familiengedächtnis: Ein KI-Chat-Workspace, in den die Familie Informationen schreibt und Dokumente (Ausweise, Behördenbriefe, Rezepte) hochlädt. Die KI analysiert alles, erstellt Markdown-Indexdateien, verknüpft das Wissen in einem Graphen und erinnert an fällige Termine.

## Tech-Stack

| Bereich | Technologie |
|---|---|
| Frontend | Expo / React Native (eine Codebase: Web, iOS, Android), Expo Router, TypeScript |
| Backend | Supabase: Auth, Postgres + pgvector, Storage, Edge Functions (Deno) |
| KI | Google Gemini Flash (multimodal) + Gemini Embedding |
| Graph | react-force-graph (Web) |

## Setup

### 1. Voraussetzungen

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Ein Supabase-Projekt (Free Tier reicht)
- Einen Gemini API Key ([Google AI Studio](https://aistudio.google.com))

### 2. Installation

```bash
npm install
cp .env.example .env
# .env mit deinen Supabase-Werten füllen:
# EXPO_PUBLIC_SUPABASE_URL und EXPO_PUBLIC_SUPABASE_ANON_KEY
```

### 3. Datenbank einrichten

```bash
supabase link --project-ref <dein-projekt-ref>
supabase db push          # Migration 001_initial_schema.sql ausführen
```

### 4. Edge Functions deployen

```bash
supabase secrets set GEMINI_API_KEY=<dein-gemini-key>
supabase functions deploy chat
supabase functions deploy scan
```

**Wichtig:** Der Gemini API Key wird nur serverseitig als Secret gesetzt und landet niemals im Client-Code.

### 5. Starten

```bash
npx expo start --web     # Web-Version
npx expo start           # Dev-Server (iOS/Android via Expo Go)
```

Beim ersten Start: Konto registrieren (Rolle „Elternteil" oder „Kind" wählen), dann Dokumente hochladen.

## Architektur-Überblick

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│  Expo App   │─────▶│  Supabase        │─────▶│  Gemini API │
│  Web/iOS/   │      │  ├─ Auth         │      │  Flash      │
│  Android    │      │  ├─ Postgres     │      └─────────────┘
└─────────────┘      │  │  └─ pgvector  │
                     │  ├─ Storage      │
                     │  └─ Edge Fns     │
                     │     ├─ chat (RAG)│
                     │     └─ scan (OCR)│
                     └──────────────────┘
```

Details: [docs/architecture.md](docs/architecture.md)

## Datenfluss: Dokument wird hochgeladen

1. Client hasht die Datei (SHA-256) → Duplikat-Check
2. Upload in Supabase Storage, Eintrag in `documents`
3. Edge Function `scan`: Gemini analysiert die Datei multimodal
4. Ergebnis: Markdown-Index (`doc_index`), Entitäten, Kanten, Reminders, Embeddings
5. Im Chat beantwortet die `chat`-Funktion Fragen mit RAG über die Embeddings — immer mit Quellenangabe

## Roadmap

- [x] Phase 0: Fundament (Setup, DB, Auth)
- [x] Phase 1: Chat-Workspace, Upload, Scan-Pipeline, Dashboard
- [ ] Phase 2: Orchestrierung (Router-Kaskade, Context Caching, Batch API, semantischer Cache)
- [ ] Phase 3: Termin-Radar erweitern + Push-Erinnerungen (Expo Notifications)
- [ ] Phase 4: Beta mit Familie, native Builds via EAS
