import { supabase } from './supabase';

const baseUrl = process.env.EXPO_PUBLIC_AI_API_BASE_URL ?? 'http://localhost:8000';

// Render free tier sleeps after 15 min idle and takes ~30s to wake.
// We tolerate up to 60s per attempt and retry once on timeout/network errors,
// because the 2nd attempt almost always lands on a warm server.
const REQUEST_TIMEOUT_MS = 60_000;
const TOTAL_ATTEMPTS = 2;

async function authHeader(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function request<T>(path: string, init?: RequestInit, attempt = 1): Promise<T> {
  const auth = await authHeader();
  const url = `${baseUrl}${path}`;
  const finalInit: RequestInit = {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...auth,
      ...(init?.headers ?? {}),
    },
  };

  let res: Response;
  try {
    res = await fetchWithTimeout(url, finalInit);
  } catch (err) {
    const isTransient =
      err instanceof Error &&
      (err.name === 'AbortError' ||
        err.message.includes('Network request failed') ||
        err.message.includes('Network Error'));
    if (isTransient && attempt < TOTAL_ATTEMPTS) {
      // First call likely woke the dyno; retry on a now-warm server.
      return request<T>(path, init, attempt + 1);
    }
    throw err;
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`AI API ${res.status}: ${detail}`);
  }

  return (await res.json()) as T;
}

/** Best-effort wake-up: hit /health to spin up the Render dyno before
 *  the user touches a feature that needs the AI backend. */
export async function pingBackend(): Promise<void> {
  try {
    await fetchWithTimeout(`${baseUrl}/health`, { method: 'GET' });
  } catch {
    // silent — this is just to warm the server
  }
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

  pinMemory: (source: 'chat' | 'photo', id: string, pinned: boolean) =>
    request<{ source: string; id: string; is_pinned: boolean }>('/memories/pin', {
      method: 'POST',
      body: JSON.stringify({ source, id, pinned }),
    }),
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
