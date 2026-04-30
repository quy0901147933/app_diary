import { useQuery } from '@tanstack/react-query';
import { aiApi, type MoodChartResponse } from '@/services/ai-api';

export function useMoodChart(userId: string | undefined) {
  return useQuery<MoodChartResponse>({
    queryKey: ['mood-chart', userId],
    queryFn: () => aiApi.fetchMoodChart(),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}
