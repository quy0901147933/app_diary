import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import type { JournalEntry } from '@/types';

const KEY = (uid: string | undefined) => ['journal', uid] as const;

export function useJournalEntries(userId: string | undefined) {
  return useQuery<JournalEntry[]>({
    queryKey: KEY(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', userId!)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as JournalEntry[];
    },
  });
}

export type JournalDraft = {
  id?: string;
  entry_date: string;
  title: string | null;
  body_md: string | null;
  mood_emoji: string | null;
  hashtags: string[] | null;
  is_draft?: boolean;
};

export function useSaveJournalEntry(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: JournalDraft) => {
      if (!userId) throw new Error('Cần đăng nhập để lưu.');
      const payload = { user_id: userId, ...draft };
      if (draft.id) {
        const { data, error } = await supabase
          .from('journal_entries')
          .update(payload)
          .eq('id', draft.id)
          .select()
          .single();
        if (error) throw error;
        return data as JournalEntry;
      }
      const { data, error } = await supabase
        .from('journal_entries')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as JournalEntry;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY(userId) });
    },
  });
}

export function useDeleteJournalEntry(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('journal_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY(userId) });
    },
  });
}
