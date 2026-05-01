-- Internal Monologue: lưu phân tích nhu cầu ẩn của user
-- (dùng cho RAG/personalization sau này, đồng thời debug được tại sao Lumina chọn tone đó).

alter table mood_events
  add column if not exists hidden_need text;
