import { useEffect, useState } from 'react';
import { aiApi } from '@/services/ai-api';
import { supabase } from '@/services/supabase';
import type { ChatMessage } from '@/types';

type _ChatMessage = ChatMessage; // keep alias for external import compatibility

const HISTORY_LIMIT = 40;

export function useChat(userId: string | undefined) {
  const [turns, setTurns] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!userId) {
      setTurns([]);
      return;
    }
    setLoading(true);
    void supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT)
      .then(({ data, error }) => {
        if (error) console.warn('chat history load failed', error);
        setTurns(((data ?? []) as ChatMessage[]).reverse());
        setLoading(false);
      });
  }, [userId]);

  async function send(content: string) {
    const trimmed = content.trim();
    if (!trimmed || pending) return;
    const localUserMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      user_id: userId ?? '',
      role: 'user',
      content: trimmed,
      context_date: null,
      reaction: null,
      created_at: new Date().toISOString(),
    };
    setTurns((t) => [...t, localUserMsg]);
    setPending(true);
    try {
      const { reply, user_reaction } = await aiApi.sendChatMessage(trimmed);
      const ai: ChatMessage = {
        id: `local-${Date.now()}-r`,
        user_id: userId ?? '',
        role: 'assistant',
        content: reply,
        context_date: null,
        reaction: null,
        created_at: new Date().toISOString(),
      };
      const userReaction: ChatMessage['reaction'] =
        user_reaction === 'love' || user_reaction === 'like' ||
        user_reaction === 'haha' || user_reaction === 'dislike'
          ? user_reaction
          : null;
      setTurns((t) => {
        const next = t.map((m) =>
          m.id === localUserMsg.id ? { ...m, reaction: userReaction } : m,
        );
        next.push(ai);
        return next;
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Có lỗi mạng. Thử lại nhé.';
      const errMsgObj: ChatMessage = {
        id: `local-${Date.now()}-err`,
        user_id: userId ?? '',
        role: 'assistant',
        content: `Xin lỗi, ${errMsg}`,
        context_date: null,
        reaction: null,
        created_at: new Date().toISOString(),
      };
      setTurns((t) => [...t, errMsgObj]);
    } finally {
      setPending(false);
    }
  }

  async function setReaction(messageId: string, reaction: ChatMessage['reaction']) {
    setTurns((t) => t.map((m) => (m.id === messageId ? { ...m, reaction } : m)));
    if (!messageId.startsWith('local-')) {
      await supabase.from('chat_messages').update({ reaction }).eq('id', messageId);
    }
  }

  return { turns, send, setReaction, loading, pending };
}
