import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { pickDocument, uploadAndScan } from '@/lib/scan';
import { colors } from '@/lib/theme';
import type { ChatMessage, ChatResponse } from '@/types';
import ChatList from '@/components/Chat/ChatList';
import ChatInput from '@/components/Chat/ChatInput';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function ChatScreen() {
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const userId = session?.user.id;

  const loadMessages = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages((data ?? []) as ChatMessage[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleSend = async (text: string) => {
    if (!userId || sending) return;
    setSending(true);

    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      user_id: userId,
      role: 'user',
      content: text,
      sources: [],
      tokens_used: null,
      model_used: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const { data, error } = await supabase.functions.invoke<ChatResponse>('chat', {
        body: { message: text },
      });
      if (error) throw error;
      await loadMessages();
    } catch (e) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        user_id: userId,
        role: 'assistant',
        content: 'Entschuldigung, es gab einen Fehler. Bitte versuche es erneut.',
        sources: [],
        tokens_used: null,
        model_used: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleUpload = async () => {
    if (!userId || sending) return;
    const asset = await pickDocument();
    if (!asset) return;
    setSending(true);
    const result = await uploadAndScan(asset, userId);
    if (result.duplicate) {
      await handleSend(`Ich habe versucht, \"${asset.name}\" hochzuladen – das Dokument existiert bereits.`);
    } else if (result.error) {
      await handleSend(`Upload von \"${asset.name}\": ${result.error}`);
    } else {
      await handleSend(`Ich habe das Dokument \"${asset.name}\" hochgeladen. Bitte analysiere es.`);
    }
    setSending(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ChatList messages={messages} sending={sending} />
      <ChatInput onSend={handleSend} onUpload={handleUpload} disabled={sending} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
