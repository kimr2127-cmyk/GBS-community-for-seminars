-- 세미나 회원제 커뮤니티 스키마
-- Supabase Dashboard > SQL Editor에서 이 파일 전체를 실행하세요.
-- 학번 1400~1421만 최초 가입할 수 있고, 첫 로그인 뒤 개인 비밀번호 변경을 강제합니다.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  student_id integer not null unique check (student_id between 1400 and 1421),
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

-- Auth 가입 시 학번을 읽어 회원 프로필을 자동으로 만듭니다.
create or replace function public.handle_new_member()
returns trigger language plpgsql security definer set search_path = public as $$
declare submitted_student_id integer;
begin
  submitted_student_id := nullif(new.raw_user_meta_data ->> 'student_id', '')::integer;
  if submitted_student_id is null or submitted_student_id not between 1400 and 1421 then
    raise exception '학번은 1400부터 1421까지만 사용할 수 있습니다.';
  end if;
  -- 공통 초기 비밀번호(Seminar2026!)가 아니면 계정을 만들지 않습니다.
  -- crypt는 새 Auth 비밀번호 해시의 salt를 이용해 서버에서만 비교합니다.
  if new.encrypted_password is distinct from extensions.crypt('Seminar2026!', new.encrypted_password) then
    raise exception '최초 가입에는 지정된 초기 비밀번호가 필요합니다.';
  end if;
  insert into public.profiles (id, student_id) values (new.id, submitted_student_id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_member();

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null check (char_length(author_name) <= 40),
  title text not null check (char_length(title) between 3 and 150),
  body text not null check (char_length(body) between 1 and 5000),
  topic text not null check (topic in ('인문·사회', '자연과학', '공학·컴퓨터', '경제·경영', '예술·문화')),
  likes integer not null default 0 check (likes >= 0),
  reply_count integer not null default 0 check (reply_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null check (char_length(author_name) <= 40),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists comments_post_id_created_at_idx on public.comments (post_id, created_at);
create index if not exists post_likes_user_id_idx on public.post_likes (user_id);

-- 댓글·공감 수는 DB 트리거가 집계합니다.
create or replace function public.update_reply_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update public.posts set reply_count = reply_count + 1 where id = new.post_id; return new;
  elsif tg_op = 'DELETE' then update public.posts set reply_count = greatest(0, reply_count - 1) where id = old.post_id; return old;
  end if;
  return null;
end;
$$;
drop trigger if exists comments_reply_count on public.comments;
create trigger comments_reply_count after insert or delete on public.comments for each row execute function public.update_reply_count();

create or replace function public.update_like_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update public.posts set likes = likes + 1 where id = new.post_id; return new;
  elsif tg_op = 'DELETE' then update public.posts set likes = greatest(0, likes - 1) where id = old.post_id; return old;
  end if;
  return null;
end;
$$;
drop trigger if exists post_likes_count on public.post_likes;
create trigger post_likes_count after insert or delete on public.post_likes for each row execute function public.update_like_count();

-- 활성 회원 여부를 RLS 정책에서만 확인합니다.
create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and must_change_password = false);
$$;

create or replace function public.complete_first_login()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set must_change_password = false where id = auth.uid();
  if not found then raise exception '회원 프로필을 찾을 수 없습니다.'; end if;
end;
$$;
revoke all on function public.is_active_member() from public;
revoke all on function public.complete_first_login() from public;
grant execute on function public.is_active_member() to authenticated;
grant execute on function public.complete_first_login() to authenticated;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;

-- 기존 공개 정책을 회원제 정책으로 바꿉니다. 재실행해도 됩니다.
drop policy if exists "Members can see their own profile" on public.profiles;
create policy "Members can see their own profile" on public.profiles for select to authenticated using (auth.uid() = id);

drop policy if exists "Anyone can read posts" on public.posts;
drop policy if exists "Active members can read posts" on public.posts;
drop policy if exists "Authenticated users can create posts" on public.posts;
drop policy if exists "Active members can create posts" on public.posts;
drop policy if exists "Owners can update their posts" on public.posts;
drop policy if exists "Active members can update their posts" on public.posts;
drop policy if exists "Owners can delete their posts" on public.posts;
drop policy if exists "Active members can delete their posts" on public.posts;
create policy "Active members can read posts" on public.posts for select to authenticated using (public.is_active_member());
create policy "Active members can create posts" on public.posts for insert to authenticated with check (auth.uid() = user_id and public.is_active_member());
create policy "Active members can update their posts" on public.posts for update to authenticated using (auth.uid() = user_id and public.is_active_member()) with check (auth.uid() = user_id and public.is_active_member());
create policy "Active members can delete their posts" on public.posts for delete to authenticated using (auth.uid() = user_id and public.is_active_member());

drop policy if exists "Anyone can read comments" on public.comments;
drop policy if exists "Active members can read comments" on public.comments;
drop policy if exists "Authenticated users can create comments" on public.comments;
drop policy if exists "Active members can create comments" on public.comments;
drop policy if exists "Owners can update their comments" on public.comments;
drop policy if exists "Active members can update their comments" on public.comments;
drop policy if exists "Owners can delete their comments" on public.comments;
drop policy if exists "Active members can delete their comments" on public.comments;
create policy "Active members can read comments" on public.comments for select to authenticated using (public.is_active_member());
create policy "Active members can create comments" on public.comments for insert to authenticated with check (auth.uid() = user_id and public.is_active_member());
create policy "Active members can update their comments" on public.comments for update to authenticated using (auth.uid() = user_id and public.is_active_member()) with check (auth.uid() = user_id and public.is_active_member());
create policy "Active members can delete their comments" on public.comments for delete to authenticated using (auth.uid() = user_id and public.is_active_member());

drop policy if exists "Users can read their own likes" on public.post_likes;
drop policy if exists "Users can create their own likes" on public.post_likes;
drop policy if exists "Users can remove their own likes" on public.post_likes;
create policy "Users can read their own likes" on public.post_likes for select to authenticated using (auth.uid() = user_id and public.is_active_member());
create policy "Users can create their own likes" on public.post_likes for insert to authenticated with check (auth.uid() = user_id and public.is_active_member());
create policy "Users can remove their own likes" on public.post_likes for delete to authenticated using (auth.uid() = user_id and public.is_active_member());

-- Supabase Authentication > Providers > Email에서 Confirm email을 반드시 끄세요.
-- 앱은 student1400@seminar.local 같은 내부 로그인 이메일을 사용합니다.
