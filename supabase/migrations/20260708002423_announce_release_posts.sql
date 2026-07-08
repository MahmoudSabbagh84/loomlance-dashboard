-- Phase 5: in-app announcements. Publishing a release post with announce_in_app fans out one
-- notification per user into the existing bell (user_notifications), exactly once — the
-- announced_at stamp makes re-publishes no-ops. SECURITY DEFINER so the fan-out insert isn't
-- blocked by user_notifications RLS. Runs inside the publish transaction: if fan-out fails,
-- the publish fails visibly. Per-user insert is trivial at current scale; revisit batching
-- around ~10k users.
alter table public.posts
  add column announce_in_app boolean not null default false,
  add column announced_at timestamptz;

create or replace function public.announce_release_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published'
     and new.announce_in_app
     and new.announced_at is null
     and new.category = 'release' then
    insert into public.user_notifications (user_id, kind, payload, link_to)
    select
      u.id,
      'announcement',
      jsonb_build_object('title', new.title, 'body', new.excerpt),
      coalesce(new.external_url, 'https://loomlance.com/blog/' || new.slug)
    from auth.users u;

    -- Stamp AFTER the fan-out; this UPDATE re-fires the trigger but the announced_at
    -- condition is then false, so it cannot recurse into a second fan-out.
    update public.posts set announced_at = now() where id = new.id;
  end if;
  return new;
end;
$$;

create trigger posts_announce
  after insert or update on public.posts
  for each row execute function public.announce_release_post();
