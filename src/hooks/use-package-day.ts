import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '@/services/ai-api';

export function usePackageDay(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => aiApi.packageDay(date),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['archive', userId] });
    },
  });
}

export function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}
