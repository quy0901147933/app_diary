import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import type { UserPersona } from '@/types';

const KEY = (uid: string | undefined) => ['persona', uid] as const;

export function useUserPersona(userId: string | undefined) {
  return useQuery<UserPersona | null>({
    queryKey: KEY(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_personas')
        .select('*')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as UserPersona | null) ?? null;
    },
  });
}

export type PersonaDraft = Partial<Omit<UserPersona, 'user_id' | 'created_at' | 'updated_at'>>;

export function useSavePersona(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: PersonaDraft) => {
      if (!userId) throw new Error('Cần đăng nhập.');
      const { data, error } = await supabase
        .from('user_personas')
        .upsert({ user_id: userId, ...draft }, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      return data as UserPersona;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY(userId) });
    },
  });
}
