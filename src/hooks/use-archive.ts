import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import type { DailyBlog } from '@/types';

export function useArchive(userId: string | undefined) {
  return useQuery<DailyBlog[]>({
    queryKey: ['archive', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_blogs')
        .select('*')
        .eq('user_id', userId!)
        .order('date', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as DailyBlog[];
    },
  });
}
