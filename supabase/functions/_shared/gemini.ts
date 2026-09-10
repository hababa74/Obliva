// Gemeinsame Gemini-Helfer fuer die Edge Functions (serverseitig!).

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const CHAT_MODEL = 'gemini-3.8-flash'; // aktuelles Flash-Modell
export const EMBED_MODEL = 'gemini-embedding-001';
export const EMBED_DIM = 768; // muss zur DB-Spalte vector(768) passen

export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(`${BASE}/${EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: EMBED_DIM,
    }),
  });
  if (!res.ok) throw new Error(`Embedding fehlgeschlagen: ${res.status}`);
  const json = await res.json();
  return json.embedding.values as number[];
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface CallGeminiOptions {
  systemPrompt?: string;
  contents: Array<{ role: string; parts: GeminiPart[] }>;
  responseSchema?: Record<string, unknown>;
  maxOutputTokens?: number;
}

export interface GeminiResult {
  text: string;
  totalTokens: number | null;
}

export async function callGemini(opts: CallGeminiOptions): Promise<GeminiResult> {
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: opts.maxOutputTokens ?? 2048,
  };
  if (opts.responseSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = opts.responseSchema;
  }

  const body: Record<string, unknown> = {
    contents: opts.contents,
    generationConfig,
  };
  if (opts.systemPrompt) {
    body.system_instruction = { parts: [{ text: opts.systemPrompt }] };
  }

  const res = await fetch(`${BASE}/${CHAT_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini fehlgeschlagen: ${res.status}`);
  const json = await res.json();
  return {
    text: json.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
    totalTokens: json.usageMetadata?.totalTokenCount ?? null,
  };
}

// Bytes -> Base64 (chunked, damit grosse Dateien nicht crashen)
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Markdown in ca. 1000-Zeichen-Chunks an Absatzgrenzen teilen
export function chunkMarkdown(markdown: string, maxLen = 1000): string[] {
  const paragraphs = markdown.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';
  for (const p of paragraphs) {
    if ((current + '\n\n' + p).length > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = p;
    } else {
      current = current ? current + '\n\n' + p : p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [markdown.slice(0, maxLen)];
}
