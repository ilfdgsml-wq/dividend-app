-- 開拓ボードゲーム：オンライン対戦用のテーブル（何度実行しても大丈夫です）
--
-- ・読み書きはすべて Edge Function「game」がサーバー用の鍵で行う。ブラウザからは一切アクセスできない。
-- ・プレイヤーはログインせず、ブラウザごとの秘密のキーの SHA-256（64文字の16進数）をユーザーIDとして使う。
-- ・game_states は完全な状態（山札・全員の手札）、player_views は各プレイヤーから見た状態（他人の手札は伏せ字）。
-- ・画面の更新は Realtime の Broadcast（チャンネル room:部屋コード）で「変わった」とだけ知らせ、中身は関数から読む。

-- 部屋
create table if not exists public.rooms (
  id text primary key check (id ~ '^[A-Z2-9]{6}$'),
  host text not null check (host ~ '^[0-9a-f]{64}$'),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  board text not null default 'random' check (board in ('random', 'beginner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 部屋の参加者（席順 = 手番順）
create table if not exists public.room_players (
  room_id text not null references public.rooms (id) on delete cascade,
  user_id text not null check (user_id ~ '^[0-9a-f]{64}$'),
  seat int not null check (seat between 0 and 3),
  name text not null check (char_length(name) between 1 and 12),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat)
);

-- ゲームの完全な状態
create table if not exists public.game_states (
  room_id text primary key references public.rooms (id) on delete cascade,
  state jsonb not null,
  version int not null,
  player_ids text[] not null,
  updated_at timestamptz not null default now()
);

-- 各プレイヤーから見た状態
create table if not exists public.player_views (
  room_id text not null references public.rooms (id) on delete cascade,
  user_id text not null,
  view jsonb not null,
  version int not null,
  primary key (room_id, user_id)
);

-- ---------- アクセス制限：ブラウザ（anon / authenticated）からは何もできない ----------
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.game_states enable row level security;
alter table public.player_views enable row level security;

revoke all on public.rooms, public.room_players, public.game_states, public.player_views from anon, authenticated;
grant all on public.rooms, public.room_players, public.game_states, public.player_views to service_role;

-- ---------- 状態の保存 ----------
-- p_expected が null なら新規作成。そうでなければ version が一致したときだけ更新する（同時操作の衝突検出）。
-- game_states と全員分の player_views を1トランザクションで更新する。
create or replace function public.save_game(
  p_room text,
  p_expected int,
  p_state jsonb,
  p_player_ids text[],
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
  select p_room, v ->> 'userId', v -> 'view', v_version
  from jsonb_array_elements(coalesce(p_views, '[]'::jsonb)) as v
  on conflict (room_id, user_id) do update
    set view = excluded.view, version = excluded.version;

  return true;
end;
$$;

revoke all on function public.save_game(text, int, jsonb, text[], jsonb) from public, anon, authenticated;
grant execute on function public.save_game(text, int, jsonb, text[], jsonb) to service_role;

-- 部屋の更新時刻
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

-- 古い部屋の掃除（最後の更新から30日たった部屋を消す）。必要なら SQL Editor で実行する：
--   delete from public.rooms where updated_at < now() - interval '30 days';
