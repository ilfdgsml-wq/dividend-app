-- 開拓ボードゲーム：オンライン対戦用のテーブル
-- Supabase の SQL Editor にこのファイルの中身をすべて貼り付けて Run してください（何度実行しても大丈夫です）。
--
-- ・書き込みはすべてサーバー（Vercel の /api/game）が Secret key で行う。ブラウザからは読むだけ。
-- ・game_states（完全な状態・山札・全員の手札）はブラウザからは読めない。
-- ・player_views（その人から見た状態）は本人だけが読める。

-- 部屋
create table if not exists public.rooms (
  id text primary key,
  host uuid not null references auth.users (id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  board text not null default 'random' check (board in ('random', 'beginner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 部屋の参加者（席順 = 手番順）
create table if not exists public.room_players (
  room_id text not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  seat int not null check (seat between 0 and 3),
  name text not null check (char_length(name) between 1 and 12),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat)
);

-- ゲームの完全な状態（サーバー専用）
create table if not exists public.game_states (
  room_id text primary key references public.rooms (id) on delete cascade,
  state jsonb not null,
  version int not null,
  player_ids uuid[] not null,
  updated_at timestamptz not null default now()
);

-- 各プレイヤーから見た状態（本人だけ読める）
create table if not exists public.player_views (
  room_id text not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  view jsonb not null,
  version int not null,
  primary key (room_id, user_id)
);

create index if not exists player_views_user_idx on public.player_views (user_id);
create index if not exists room_players_user_idx on public.room_players (user_id);

-- 自分がその部屋の参加者か（RLS から使う。room_players 自身の RLS を通らないよう security definer）
create or replace function public.is_room_member(p_room text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_players rp
    where rp.room_id = p_room and rp.user_id = (select auth.uid())
  );
$$;

-- ---------- 行レベルセキュリティ ----------
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.game_states enable row level security;
alter table public.player_views enable row level security;

drop policy if exists "参加者は部屋を読める" on public.rooms;
create policy "参加者は部屋を読める" on public.rooms
  for select to authenticated
  using (public.is_room_member(id));

drop policy if exists "参加者は参加者一覧を読める" on public.room_players;
create policy "参加者は参加者一覧を読める" on public.room_players
  for select to authenticated
  using (public.is_room_member(room_id));

drop policy if exists "本人の見え方だけ読める" on public.player_views;
create policy "本人の見え方だけ読める" on public.player_views
  for select to authenticated
  using (user_id = (select auth.uid()));

-- game_states にはポリシーを作らない（ブラウザからは一切読み書きできない）

revoke all on public.rooms, public.room_players, public.game_states, public.player_views from anon, authenticated;
grant select on public.rooms, public.room_players, public.player_views to authenticated;
grant all on public.rooms, public.room_players, public.game_states, public.player_views to service_role;
revoke all on function public.is_room_member(text) from public, anon;
grant execute on function public.is_room_member(text) to authenticated, service_role;

-- ---------- 状態の保存（サーバー専用） ----------
-- p_expected が null なら新規作成。そうでなければ version が一致したときだけ更新する（同時操作の衝突検出）。
create or replace function public.save_game(
  p_room text,
  p_expected int,
  p_state jsonb,
  p_player_ids uuid[],
  p_views jsonb
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_version int;
begin
  if p_expected is null then
    insert into public.game_states (room_id, state, version, player_ids)
    values (p_room, p_state, 1, p_player_ids)
    on conflict (room_id) do nothing;
    if not found then
      return false;
    end if;
    v_version := 1;
  else
    update public.game_states
    set state = p_state, version = version + 1, player_ids = p_player_ids, updated_at = now()
    where room_id = p_room and version = p_expected
    returning version into v_version;
    if not found then
      return false;
    end if;
  end if;

  insert into public.player_views (room_id, user_id, view, version)
  select p_room, (v ->> 'userId')::uuid, v -> 'view', v_version
  from jsonb_array_elements(coalesce(p_views, '[]'::jsonb)) as v
  on conflict (room_id, user_id) do update
    set view = excluded.view, version = excluded.version;

  return true;
end;
$$;

revoke all on function public.save_game(text, int, jsonb, uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.save_game(text, int, jsonb, uuid[], jsonb) to service_role;

-- 部屋の更新時刻（変更の合図として使う）
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rooms_touch on public.rooms;
create trigger rooms_touch before update on public.rooms
  for each row execute function public.touch_updated_at();

-- ---------- リアルタイム配信 ----------
do $$
declare
  t text;
begin
  foreach t in array array['rooms', 'room_players', 'player_views'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
