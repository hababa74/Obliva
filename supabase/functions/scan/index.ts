// Obliva — scan Edge Function
// Analysiert ein hochgeladenes Dokument mit Gemini (multimodal),
// erzeugt die Markdown-Indexdatei, Entitaeten, Kanten, Reminders und Embeddings.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  callGemini,
  embedText,
  bytesToBase64,
  chunkMarkdown,
} from '../_shared/gemini.ts';

const EXTRACTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    doc_type: {
      type: 'STRING',
      description:
        'Personalausweis | Reisepass | Versicherung | Rechnung | Rezept | Zeugnis | Vertrag | Behördenschreiben | Sonstiges',
    },
    person_name: { type: 'STRING', description: 'Name der Person im Dokument oder leer' },
    summary: { type: 'STRING' },
    key_data: {
      type: 'OBJECT',
      properties: {
        issue_date: { type: 'STRING', description: 'YYYY-MM-DD oder leer' },
        expiry_date: { type: 'STRING', description: 'YYYY-MM-DD oder leer' },
        issuing_authority: { type: 'STRING' },
        document_number: { type: 'STRING' },
      },
    },
    entities: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          type: {
            type: 'STRING',
            description: 'person | organization | authority | doctor | location | topic',
          },
        },
      },
    },
    reminders: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          due_date: { type: 'STRING', description: 'YYYY-MM-DD' },
          type: { type: 'STRING', description: 'expiry | appointment | checkup | deadline' },
        },
      },
    },
    markdown: { type: 'STRING', description: 'Vollstaendige Markdown-Indexdatei' },
  },
  required: ['title', 'summary', 'markdown'],
};

const SCAN_PROMPT = `Analysiere dieses Dokument fuer ein Familien-Wissensnetz (App: Obliva).
Extrahiere strukturiert:
- title: kurzer, sprechender Titel
- doc_type: Dokumenttyp aus der vorgegebenen Liste
- person_name: Person, zu der das Dokument gehoert (falls erkennbar)
- summary: 1-2 Saetze
- key_data: Ausstellungsdatum, Ablaufdatum (SEHR wichtig bei Ausweisen!), ausstellende Behoerde, Dokumentennummer
- entities: alle erkennbaren Personen, Behoerden, Aerzte, Organisationen, Orte
- reminders: fällige Termine/Ablaufdaten (z. B. Ausweis laeuft ab -> expiry mit due_date)
- markdown: vollstaendige Markdown-Indexdatei mit Ueberschrift, Metadaten-Abschnitt und Inhalt
Antworte auf Deutsch.`;

interface ExtractedEntity {
  name: string;
  type: string;
}

interface ExtractedReminder {
  title: string;
  due_date?: string;
  type?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Service Role: darf in alle Tabellen schreiben (umgeht RLS bewusst)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let documentId: string | null = null;

  try {
    const body = (await req.json()) as { documentId?: string };
    documentId = body.documentId ?? null;
    if (!documentId) return jsonResponse({ error: 'documentId fehlt' }, 400);

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();
    if (docError || !doc) return jsonResponse({ error: 'Dokument nicht gefunden' }, 404);

    await supabase
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

    // Datei aus Storage laden
    const { data: fileData, error: dlError } = await supabase.storage
      .from('documents')
      .download(doc.file_path);
    if (dlError || !fileData) throw new Error('Download fehlgeschlagen');

    const bytes = new Uint8Array(await fileData.arrayBuffer());
    const base64 = bytesToBase64(bytes);

    // Gemini multimodal (Bilder + PDFs nativ)
    const result = await callGemini({
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: doc.mime_type, data: base64 } },
            { text: SCAN_PROMPT },
          ],
        },
      ],
      responseSchema: EXTRACTION_SCHEMA,
      maxOutputTokens: 4096,
    });

    const extracted = JSON.parse(result.text);

    // Person zuordnen (falls Name zu einem Profil passt)
    let personId: string | null = null;
    if (extracted.person_name) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('display_name', extracted.person_name)
        .maybeSingle();
      personId = profile?.id ?? null;
    }

    // Markdown-Index speichern
    const { data: index, error: indexError } = await supabase
      .from('doc_index')
      .insert({
        document_id: documentId,
        person_id: personId,
        title: extracted.title,
        doc_type: extracted.doc_type ?? null,
        markdown_content: extracted.markdown,
        key_data: extracted.key_data ?? {},
      })
      .select('id')
      .single();
    if (indexError) throw indexError;

    // Entitaeten anlegen/verknuepfen
    for (const entity of (extracted.entities ?? []) as ExtractedEntity[]) {
      if (!entity.name || !entity.type) continue;
      const { data: existing } = await supabase
        .from('entities')
        .upsert(
          { name: entity.name, entity_type: entity.type },
          { onConflict: 'name,entity_type' }
        )
        .select('id')
        .single();
      if (existing) {
        await supabase.from('edges').insert({
          source_document_id: documentId,
          target_entity_id: existing.id,
          edge_type:
            entity.type === 'authority' || entity.type === 'organization'
              ? 'issued_by'
              : 'belongs_to',
          label:
            entity.type === 'authority' || entity.type === 'organization'
              ? 'ausgestellt von'
              : 'gehört zu',
        });
      }
    }

    // Reminders anlegen
    for (const reminder of (extracted.reminders ?? []) as ExtractedReminder[]) {
      if (!reminder.title || !reminder.due_date) continue;
      await supabase.from('reminders').insert({
        person_id: personId,
        document_id: documentId,
        doc_index_id: index.id,
        title: reminder.title,
        reminder_type: reminder.type ?? 'custom',
        due_date: reminder.due_date,
        source_data: { document_title: extracted.title },
      });
    }

    // Embeddings der Markdown-Chunks
    const chunks = chunkMarkdown(extracted.markdown);
    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedding = await embedText(chunks[i]);
        await supabase.from('embeddings').insert({
          doc_index_id: index.id,
          chunk_text: chunks[i],
          chunk_index: i,
          embedding: JSON.stringify(embedding),
        });
      } catch (e) {
        console.error(`Embedding Chunk ${i} fehlgeschlagen:`, e);
      }
    }

    await supabase
      .from('documents')
      .update({ status: 'done', person_id: personId })
      .eq('id', documentId);

    return jsonResponse({ success: true, doc_index_id: index.id });
  } catch (e) {
    console.error('scan error:', e);
    if (documentId) {
      await supabase
        .from('documents')
        .update({ status: 'error', error_message: String(e) })
        .eq('id', documentId);
    }
    return jsonResponse({ success: false, error: String(e) }, 500);
  }
});
