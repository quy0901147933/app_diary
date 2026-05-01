-- Emotional RAG: hybrid retrieval combining vector similarity with emotion
-- metadata. Lets Lumina recall not just "what was said" but "what was felt".

create extension if not exists vector;

-- Embed every user/assistant turn so we can do semantic search later.
-- 768 dim matches Gemini text-embedding-004.
alter table chat_messages
  add column if not exists embedding vector(768);

-- Denormalize emotion metadata onto chat_messages so the SQL match function
-- can filter without joining mood_events on every call. (The source of truth
-- still lives in mood_events for analytics.)
alter table chat_messages
  add column if not exists emotion_tag text,
  add column if not exists sentiment_score smallint;

-- HNSW index for fast cosine similarity (Postgres 15+ / pgvector ≥ 0.5).
create index if not exists chat_messages_embedding_idx
  on chat_messages
  using hnsw (embedding vector_cosine_ops);

-- Hybrid search: vector similarity, scoped to a single user, only returning
-- the user's own messages (more useful as "emotional precedents") and
-- joined with mood_events for hidden_need context.
create or replace function match_emotional_memories(
  p_user_id uuid,
  p_query_embedding vector(768),
  p_match_count int default 3,
  p_min_similarity float default 0.55
)
returns table (
  id uuid,
  content text,
  emotion_tag text,
  sentiment_score smallint,
  hidden_need text,
  similarity float,
  created_at timestamptz
)
language sql stable
as $$
  select
    cm.id,
    cm.content,
    cm.emotion_tag,
    cm.sentiment_score,
    me.hidden_need,
    1 - (cm.embedding <=> p_query_embedding) as similarity,
    cm.created_at
  from chat_messages cm
  left join lateral (
    select hidden_need
    from mood_events
    where source = 'chat' and source_id = cm.id
    limit 1
  ) me on true
  where cm.user_id = p_user_id
    and cm.embedding is not null
    and cm.role = 'user'
    and (1 - (cm.embedding <=> p_query_embedding)) >= p_min_similarity
  order by cm.embedding <=> p_query_embedding
  limit p_match_count;
$$;
