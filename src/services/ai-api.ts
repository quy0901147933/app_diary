import { supabase } from './supabase';

const baseUrl = process.env.EXPO_PUBLIC_AI_API_BASE_URL ?? 'http://localhost:8000';

async function authHeader(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = await authHeader();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...auth,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`AI API ${res.status}: ${detail}`);
  }

  return (await res.json()) as T;
}

export type AiCommentResponse = {
  photo_id: string;
  commentary: string;
  mood: string;
};

export type DailyBlogResponse = {
  date: string;
  title: string;
  body_md: string;
  hashtags: string[];
  mood_emoji: string;
};

export const aiApi = {
  requestPhotoComment: (photoId: string) =>
    request<AiCommentResponse>('/ai/comment', {
      method: 'POST',
      body: JSON.stringify({ photo_id: photoId }),
    }),

  packageDay: (date: string) =>
    request<DailyBlogResponse>('/day/package', {
      method: 'POST',
      body: JSON.stringify({ date }),
    }),

  sendChatMessage: (content: string) =>
    request<{ reply: string; user_reaction: string | null }>('/chat/message', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  fetchMoodChart: () => request<MoodChartResponse>('/ai/mood-chart'),
};

export type MoodDayPoint = {
  day: string;
  label: string;
  average_score: number | null;
  sample_count: number;
  dominant_emotion: string | null;
};

export type MoodChartResponse = {
  days: MoodDayPoint[];
  message: string;
};
