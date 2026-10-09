create extension if not exists pg_cron;

create or replace function public.expire_old_items()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications(user_id, message, item_id)
    select user_id, 'Your report "' || title || '" was archived after 30 days without being claimed.', id
    from public.items where status='active' and created_at < now() - interval '30 days';
  update public.items set status='expired' where status='active' and created_at < now() - interval '30 days';
end $$;
revoke execute on function public.expire_old_items() from public, anon, authenticated;

select cron.schedule('expire-old-items', '0 1 * * *', 'select public.expire_old_items()');

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  sender_id uuid not null,
  recipient_id uuid not null,
  body text not null check (char_length(body) between 1 and 2000),
  read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "participants read" on public.messages for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "send as self" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and recipient_id <> auth.uid()
    and (exists (select 1 from public.items i where i.id = item_id and i.user_id = recipient_id)
      or exists (select 1 from public.messages m where m.item_id = messages.item_id and m.sender_id = recipient_id and m.recipient_id = auth.uid())));
create policy "recipient marks read" on public.messages for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create index on public.messages (item_id, sender_id, recipient_id);