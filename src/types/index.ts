export type PhotoStatus = 'pending_ai' | 'ready' | 'failed';

export type Photo = {
  id: string;
  user_id: string;
  storage_path: string;
  taken_at: string | null;
  location_text: string | null;
  exif: Record<string, unknown> | null;
  note: string | null;
  tags: string[] | null;
  ai_commentary: string | null;
  ai_mood: string | null;
  ai_hashtags: string[] | null;
  status: PhotoStatus;
  created_at: string;
};

export type DailyBlog = {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  title: string | null;
  body_md: string | null;
  hashtags: string[] | null;
  mood_emoji: string | null;
  location_text: string | null;
  cover_photo_ids: string[] | null;
  cover_photo_urls: string[] | null;
  created_at: string;
};

export type JournalEntry = {
  id: string;
  user_id: string;
  entry_date: string; // YYYY-MM-DD
  title: string | null;
  body_md: string | null;
  mood_emoji: string | null;
  hashtags: string[] | null;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
};

export type UserPersona = {
  user_id: string;
  user_nickname: string | null;
  user_age_group: string | null;
  user_interests: string[] | null;
  user_goal: string | null;
  ai_gender: 'female' | 'male' | 'neutral' | null;
  ai_relationship: 'best_friend' | 'lover' | 'mentor' | null;
  ai_energy: number;
  ai_response_style: number;
  ai_soul_age: 'peer' | 'older' | 'younger';
  ai_name: string | null;
  ai_avatar_key: string | null;
  ai_avatar_url: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  display_name: string | null;
  locale: string | null;
  avatar_url: string | null;
  avatar_key: string | null;
  expo_push_token: string | null;
  last_seen_at: string | null;
  proactive_enabled: boolean;
  morning_hour: number;
  night_hour: number;
  quiet_start_hour: number;
  quiet_end_hour: number;
  created_at: string;
};

export type ChatReaction = 'love' | 'like' | 'haha' | 'dislike' | null;

export type ChatMessage = {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  context_date: string | null;
  reaction: ChatReaction;
  created_at: string;
};

export type ExifData = {
  takenAt?: string;
  latitude?: number;
  longitude?: number;
  locationText?: string;
  city?: string;
  country?: string;
  raw?: Record<string, unknown>;
};
