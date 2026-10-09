-- ClassAI database schema
-- Run this in the Supabase SQL editor to set up the database

-- Teachers (maps to Supabase auth.users)
create table if not exists public.teachers (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text not null unique,
  created_at timestamptz default now()
);

-- Classes
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  name text not null,
  grade int not null check (grade between 8 and 12),
  subject text not null,
  archived boolean not null default false,
  created_at timestamptz default now()
);

-- Chapters
create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null,
  "order" int not null default 0,
  created_at timestamptz default now()
);

-- Topics
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  title text not null,
  notes text,
  status text not null default 'not_started' check (status in ('not_started', 'teaching', 'covered')),
  "order" int not null default 0,
  created_at timestamptz default now()
);

-- Lessons
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  instructions text,
  html_url text,
  share_token uuid not null default gen_random_uuid() unique,
  status text not null default 'draft' check (status in ('draft', 'shared')),
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.teachers enable row level security;
alter table public.classes enable row level security;
alter table public.chapters enable row level security;
alter table public.topics enable row level security;
alter table public.lessons enable row level security;

-- RLS Policies: teachers see only their own data
create policy "Teachers: own row" on public.teachers
  for all using (id = auth.uid());

create policy "Classes: own" on public.classes
  for all using (teacher_id = auth.uid());

create policy "Chapters: own via class" on public.chapters
  for all using (
    class_id in (select id from public.classes where teacher_id = auth.uid())
  );

create policy "Topics: own via chapter" on public.topics
  for all using (
    chapter_id in (
      select c.id from public.chapters c
      join public.classes cl on cl.id = c.class_id
      where cl.teacher_id = auth.uid()
    )
  );

create policy "Lessons: own" on public.lessons
  for all using (teacher_id = auth.uid());

-- School library flag on lessons
alter table public.lessons add column if not exists is_school_shared boolean not null default false;

-- Quiz responses (public insert, teacher read)
create table if not exists public.quiz_responses (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_name text not null,
  question_index int not null,
  question_text text not null,
  chosen_answer text not null,
  correct_answer text not null,
  is_correct boolean not null,
  responded_at timestamptz default now()
);

alter table public.quiz_responses enable row level security;

create policy "Quiz: public insert" on public.quiz_responses
  for insert with check (true);

create policy "Quiz: teacher read" on public.quiz_responses
  for select using (
    lesson_id in (select id from public.lessons where teacher_id = auth.uid())
  );

-- School library RLS
create or replace function public.current_teacher_domain()
returns text language sql security definer set search_path = ''
as $$ select split_part(email, '@', 2) from public.teachers where id = auth.uid() $$;

create policy "School library: same domain" on public.lessons
  for select using (
    is_school_shared = true
    and (
      teacher_id = auth.uid()
      or exists (
        select 1 from public.teachers
        where id = auth.uid()
        and split_part(email,'@',2) = (
          select split_part(email,'@',2) from public.teachers where id = lessons.teacher_id
        )
      )
    )
  );

-- Auto-insert teacher row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.teachers (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do update set
    name = coalesce(excluded.name, public.teachers.name);
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
