-- Emotional RAG v2:
--   • Photo memories: embed ai_commentary + object_tags
--   • Decay weight: exponential, λ tuned so 6 months ≈ 65% of week-old
--   • Self-curate: is_pinned multiplies similarity by 1.5 (capped at 1.0)
--   • Unified retrieval over chat + photos in one RPC

-- ---- Photo memory columns ----------------------------------------------------
alter table photos
  add column if not exists embedding vector(768),
  add column if not exists object_tags text[],
  add column if not exists is_pinned boolean not null default false;

create index if not exists photos_embedding_idx
  on photos
  using hnsw (embedding vector_cosine_ops);

create index if not exists photos_pinned_idx
  on photos (user_id, is_pinned)
  where is_pinned = true;

-- ---- Pin column on chat_messages --------------------------------------------
alter table chat_messages
  add column if not exists is_pinned boolean not null default false;

create index if not exists chat_messages_pinned_idx
  on chat_messages (user_id, is_pinned)
  where is_pinned = true;

-- ---- Decay constant ---------------------------------------------------------
-- e^(-λ·180) = 0.65   →   λ = -ln(0.65)/180  ≈  0.002393
-- Result: ~98% of weight after 1 week, ~65% after 6 months.
-- Pinned rows skip decay entirely AND get +1.5x multiplier.

-- ---- Unified retrieval over chat + photos ----------------------------------
drop function if exists match_emotional_memories(uuid, vector, int, float);
drop function if exists match_unified_memories(uuid, vector, int, float);

create or replace function match_unified_memories(
  p_user_id uuid,
  p_query_embedding vector(768),
  p_match_count int default 5,
  p_min_similarity float default 0.5
)
returns table (
  source text,
  id uuid,
  content text,
  emotion_tag text,
  sentiment_score smallint,
  hidden_need text,
  object_tags text[],
  is_pinned boolean,
  base_similarity float,
  final_score float,
  created_at timestamptz
)
language sql stable
as $$
  with decay_const as (select 0.002393::float as lambda),
       chat_hits as (
         select
           'chat'::text as source,
           cm.id,
           cm.content,
           cm.emotion_tag,
           cm.sentiment_score,
           me.hidden_need,
           null::text[] as object_tags,
           cm.is_pinned,
           1 - (cm.embedding <=> p_query_embedding) as base_sim,
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
       ),
       photo_hits as (
         select
           'photo'::text as source,
           p.id,
           coalesce(p.ai_commentary, '') as content,
           p.ai_mood as emotion_tag,
           null::smallint as sentiment_score,
           me.hidden_need,
           p.object_tags,
           p.is_pinned,
           1 - (p.embedding <=> p_query_embedding) as base_sim,
           p.created_at
         from photos p
         left join lateral (
           select hidden_need
           from mood_events
           where source = 'photo' and source_id = p.id
           limit 1
         ) me on true
         where p.user_id = p_user_id
           and p.embedding is not null
           and p.status = 'ready'
       ),
       all_hits as (
         select * from chat_hits
         union all
         select * from photo_hits
       )
  select
    h.source,
    h.id,
    h.content,
    h.emotion_tag,
    h.sentiment_score,
    h.hidden_need,
    h.object_tags,
    h.is_pinned,
    h.base_sim as base_similarity,
    least(
      1.0,
      h.base_sim
        * case when h.is_pinned then 1.0
               else exp(-(select lambda from decay_const)
                        * extract(epoch from (now() - h.created_at)) / 86400.0)
          end
        * case when h.is_pinned then 1.5 else 1.0 end
    ) as final_score,
    h.created_at
  from all_hits h
  where h.base_sim >= p_min_similarity
  order by final_score desc
  limit p_match_count;
$$;

-- ---- Backward-compat wrapper (chat-only) for any old caller -----------------
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
    m.id,
    m.content,
    m.emotion_tag,
    m.sentiment_score,
    m.hidden_need,
    m.final_score as similarity,
    m.created_at
  from match_unified_memories(
    p_user_id,
    p_query_embedding,
    p_match_count,
    p_min_similarity
  ) m
  where m.source = 'chat';
$$;
