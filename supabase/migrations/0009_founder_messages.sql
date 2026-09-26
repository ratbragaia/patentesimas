-- Two-way Telegram (ADR 0013): every message the founder sends to the bot is stored here, with what
-- the system did about it. Idempotent on Telegram's update_id. Re-runnable.
set search_path to ps, public;

create table if not exists ps.founder_messages (
  id uuid primary key default gen_random_uuid(),
  update_id bigint not null unique,          -- Telegram update_id (dedupe: Telegram retries on non-200)
  message_id bigint,
  chat_id text not null,
  text text,
  command text,                              -- 'status' | 'tarefas' | 'ok' | 'nao' | 'ajuda' | 'tarefa' (free text) | 'ignorado'
  task_id uuid references ps.tasks(id) on delete set null,
  reply text,                                -- what the bot answered
  received_at timestamptz not null default now()
);
alter table ps.founder_messages enable row level security;
