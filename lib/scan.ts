import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';

const ACCEPTED_TYPES = [
  'image/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export async function pickDocument(): Promise<DocumentPicker.DocumentPickerAsset | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ACCEPTED_TYPES,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
}

function toBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += chars[b1 >> 2];
    out += chars[((b1 & 3) << 4) | (b2 >> 4)];
    out += i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    out += i + 2 < bytes.length ? chars[b3 & 63] : '=';
  }
  return out;
}

async function readAsBytes(uri: string): Promise<Uint8Array> {
  const response = await fetch(uri);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

// SHA-256 ueber den Dateiinhalt (als Deduplizierungs-Key)
export async function hashFile(uri: string): Promise<{ hash: string; bytes: Uint8Array }> {
  const bytes = await readAsBytes(uri);
  const base64 = toBase64(bytes);
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64
  );
  return { hash, bytes };
}

export interface UploadResult {
  documentId?: string;
  duplicate?: boolean;
  error?: string;
}

// Kompletter Upload-Flow: Hash -> Duplikat-Check -> Storage -> DB -> Scan triggern
export async function uploadAndScan(
  asset: DocumentPicker.DocumentPickerAsset,
  userId: string
): Promise<UploadResult> {
  try {
    const { hash, bytes } = await hashFile(asset.uri);

    const { data: existing } = await supabase
      .from('documents')
      .select('id')
      .eq('file_hash', hash)
      .maybeSingle();
    if (existing) return { duplicate: true };

    const filePath = `${userId}/${hash}_${asset.name}`;
    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(filePath, bytes.buffer as ArrayBuffer, {
        contentType: asset.mimeType ?? 'application/octet-stream',
      });
    if (storageError) return { error: storageError.message };

    const { data: doc, error: dbError } = await supabase
      .from('documents')
      .insert({
        uploaded_by: userId,
        file_name: asset.name,
        file_path: filePath,
        file_hash: hash,
        mime_type: asset.mimeType ?? 'application/octet-stream',
        file_size_bytes: asset.size ?? bytes.length,
        status: 'pending',
      })
      .select('id')
      .single();
    if (dbError) return { error: dbError.message };

    const { error: fnError } = await supabase.functions.invoke('scan', {
      body: { documentId: doc.id },
    });
    if (fnError) {
      return { documentId: doc.id, error: `Upload ok, Scan fehlgeschlagen: ${fnError.message}` };
    }

    return { documentId: doc.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unbekannter Fehler' };
  }
}
