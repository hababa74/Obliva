// Obliva — chat Edge Function
// Nimmt eine User-Nachricht entgegen, sucht relevante Dokument-Chunks (RAG)
// und antwortet ueber Gemini mit Quellenangaben.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { callGemini, embedText, CHAT_MODEL } from '../_shared/gemini.ts';

const SYSTEM_PROMPT = `Du bist Obliva, der Assistent des Familien-Wissensnetzes. Du hast Zugriff auf die Dokumente und Informationen der Familie.
Deine Aufgaben:
1. Beantworte Fragen basierend auf den bereitgestellten Dokument-Ausschnitten (Kontext).
2. Wenn der User neue Informationen teilt (z. B. "Lena hat am 15.03. Geburtstag"), extrahiere sie als extracted_facts.
3. Gib IMMER die Quelle an, wenn du Informationen aus Dokumenten verwendest (sources).
4. Antworte auf Deutsch, kurz und praezise.
5. Wenn du etwas nicht weisst oder nicht im Kontext findest, sage das ehrlich.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    answer: { type: 'STRING', description: 'Antwort in Markdown' },
    sources: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          doc_index_id: { type: 'STRING' },
          title: { type: 'STRING' },
        },
      },
    },
    extracted_facts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          person: { type: 'STRING' },
          fact: { type: 'STRING' },
          category: { type: 'STRING' },
        },
      },
    },
  },
  required: ['answer'],
};

interface MatchRow {
  doc_index_id: string;
  chunk_text: string;
  title: string;
  similarity: number;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Nicht authentifiziert' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return jsonResponse({ error: 'Nicht authentifiziert' }, 401);

    const { message } = (await req.json()) as { message: string };
    if (!message?.trim()) return jsonResponse({ error: 'Leere Nachricht' }, 400);

    // 1. User-Nachricht speichern
    await supabase
      .from('chat_messages')
      .insert({ user_id: user.id, role: 'user', content: message });

    // 2. Semantische Suche (RAG) — optional, Fehler nicht fatal
    let context = '';
    let sources: Array<{ doc_index_id: string; title: string }> = [];
    try {
      const queryEmbedding = await embedText(message);
      const { data: matches } = await supabase.rpc('match_embeddings', {
        query_embedding: queryEmbedding,
        match_count: 5,
      });
      const rows = (matches ?? []) as MatchRow[];
      if (rows.length > 0) {
        context = rows
          .map((m) => `[Quelle: ${m.title}]\n${m.chunk_text}`)
          .join('\n\n---\n\n');
        const seen = new Set<string>();
        sources = rows
          .filter((m) => !seen.has(m.doc_index_id) && seen.add(m.doc_index_id))
          .map((m) => ({ doc_index_id: m.doc_index_id, title: m.title }));
      }
    } catch (e) {
      console.error('RAG-Suche fehlgeschlagen (weiter ohne Kontext):', e);
    }

    // 3. Chat-Verlauf (letzte 10 Nachrichten)
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, content')
      .order('created_at', { ascending: false })
      .limit(10);

    const contents = (history ?? [])
      .reverse()
      .map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
    contents.push({
      role: 'user',
      parts: [
        {
          text: context
            ? `Kontext aus Familien-Dokumenten:\n${context}\n\nFrage des Nutzers: ${message}`
            : message,
        },
      ],
    });

    // 4. Gemini aufrufen (Structured Output)
    const result = await callGemini({
      systemPrompt: SYSTEM_PROMPT,
      contents,
      responseSchema: RESPONSE_SCHEMA,
    });

    let parsed: { answer?: string; sources?: unknown; extracted_facts?: unknown } = {};
    try {
      parsed = JSON.parse(result.text);
    } catch {
      parsed = { answer: result.text };
    }

    const responseBody = {
      answer: parsed.answer ?? 'Ich konnte leider keine Antwort erzeugen.',
      sources: Array.isArray(parsed.sources) && (parsed.sources as unknown[]).length > 0
        ? parsed.sources
        : sources,
      extracted_facts: parsed.extracted_facts ?? [],
    };

    // 5. Assistant-Nachricht speichern
    await supabase.from('chat_messages').insert({
      user_id: user.id,
      role: 'assistant',
      content: responseBody.answer,
      sources: responseBody.sources,
      tokens_used: result.totalTokens,
      model_used: CHAT_MODEL,
    });

    return jsonResponse(responseBody);
  } catch (e) {
    console.error('chat error:', e);
    return jsonResponse({ error: String(e) }, 500);
  }
});
