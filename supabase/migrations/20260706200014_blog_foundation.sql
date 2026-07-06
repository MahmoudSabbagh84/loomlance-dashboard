-- Blog + admin foundation: profiles.is_admin, is_admin() helper, posts table, blog-images bucket.

alter table public.profiles add column is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
$$;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 200),
  excerpt text not null default '' check (char_length(excerpt) <= 300),
  body_md text not null default '',
  cover_image_url text,
  category text not null check (category in ('release','update','press')),
  external_url text,
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts enable row level security;

create policy "posts_select_published_or_admin"
  on public.posts for select
  using (status = 'published' or public.is_admin());

create policy "posts_insert_admin"
  on public.posts for insert
  with check (public.is_admin());

create policy "posts_update_admin"
  on public.posts for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "posts_delete_admin"
  on public.posts for delete
  using (public.is_admin());

create index posts_published_idx on public.posts (published_at desc) where status = 'published';

-- Reuse the existing generic updated_at trigger helper (public.set_updated_at(), from
-- 20260609185350_profiles.sql) instead of creating a duplicate posts-specific function.
create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

-- Public bucket: covers must load on the anonymous blog pages.
insert into storage.buckets (id, name, public) values ('blog-images', 'blog-images', true)
on conflict (id) do nothing;

create policy "blog_images_insert_admin"
  on storage.objects for insert
  with check (bucket_id = 'blog-images' and public.is_admin());

create policy "blog_images_update_admin"
  on storage.objects for update
  using (bucket_id = 'blog-images' and public.is_admin());

create policy "blog_images_delete_admin"
  on storage.objects for delete
  using (bucket_id = 'blog-images' and public.is_admin());
