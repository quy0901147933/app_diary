import { useEffect, useId } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { usePhotoStore } from '@/stores/photo-store';
import type { Photo } from '@/types';

const TODAY_KEY = ['photos', 'today'] as const;

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function useTodayPhotos(userId: string | undefined, options?: { realtime?: boolean }) {
  const setPhotos = usePhotoStore((s) => s.setPhotos);
  const upsertPhoto = usePhotoStore((s) => s.upsertPhoto);
  const queryClient = useQueryClient();
  const instanceId = useId();
  const realtime = options?.realtime ?? true;

  const query = useQuery<Photo[]>({
    queryKey: [...TODAY_KEY, userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('user_id', userId!)
        .gte('created_at', startOfTodayIso())
        .order('created_at', { ascending: false });

      if (error) throw error;
      const photos = (data ?? []) as Photo[];
      setPhotos(photos);
      return photos;
    },
  });

  useEffect(() => {
    if (!userId || !realtime) return;
    // Unique channel name per hook instance — multiple components can each
    // subscribe without colliding on a shared channel that is already subscribed.
    const channel = supabase
      .channel(`photos-realtime-${userId}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'photos', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          const next = payload.new as Photo;
          upsertPhoto(next);
          queryClient.setQueryData<Photo[]>([...TODAY_KEY, userId], (prev) => {
            if (!prev) return [next];
            const idx = prev.findIndex((p) => p.id === next.id);
            if (idx === -1) return [next, ...prev];
            const copy = [...prev];
            copy[idx] = next;
            return copy;
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [instanceId, queryClient, realtime, upsertPhoto, userId]);

  return query;
}
