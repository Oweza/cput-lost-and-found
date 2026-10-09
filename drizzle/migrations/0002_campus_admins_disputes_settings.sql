create table public.campus_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campus text not null,
  created_at timestamptz not null default now(),
  unique (user_id, campus)
);
grant select, insert, delete on public.campus_admins to authenticated;
grant all on public.campus_admins to service_role;
alter table public.campus_admins enable row level security;

create or replace function public.is_campus_admin(_user_id uuid, _campus text)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.campus_admins where user_id = _user_id and campus = _campus) $$;

create or replace function public.is_any_campus_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.campus_admins where user_id = _user_id) $$;

create policy "read own or admin" on public.campus_admins for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin assign" on public.campus_admins for insert to authenticated
  with check (public.has_role(auth.uid(),'admin'));
create policy "admin unassign" on public.campus_admins for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- system admins manage roles
grant insert, delete on public.user_roles to authenticated;
create policy "admin add roles" on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(),'admin'));
create policy "admin remove roles" on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(),'admin') and user_id <> auth.uid());

-- campus admins on items / claims / profiles
create policy "campus admin update items" on public.items for update to authenticated
  using (public.is_campus_admin(auth.uid(), campus));
create policy "campus admin delete items" on public.items for delete to authenticated
  using (public.is_campus_admin(auth.uid(), campus));
create policy "campus admin read claims" on public.claims for select to authenticated
  using (exists (select 1 from public.items i where i.id = item_id and public.is_campus_admin(auth.uid(), i.campus)));
create policy "campus admin update claims" on public.claims for update to authenticated
  using (exists (select 1 from public.items i where i.id = item_id and public.is_campus_admin(auth.uid(), i.campus)));
create policy "campus admin read profiles" on public.profiles for select to authenticated
  using (public.is_any_campus_admin(auth.uid()));

-- settings
create table public.app_settings (
  id int primary key default 1 check (id = 1),
  expiry_days int not null default 30 check (expiry_days between 1 and 365),
  messaging_enabled boolean not null default true,
  support_email text not null default '',
  updated_at timestamptz not null default now()
);
grant select on public.app_settings to anon, authenticated;
grant insert, update on public.app_settings to authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create policy "everyone reads settings" on public.app_settings for select to anon, authenticated using (true);
create policy "admin inserts settings" on public.app_settings for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin updates settings" on public.app_settings for update to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.expire_old_items()
returns void language plpgsql security definer set search_path = public as $$
declare d int := coalesce((select expiry_days from public.app_settings where id = 1), 30);
begin
  insert into public.notifications(user_id, message, item_id)
    select user_id, 'Your report "' || title || '" was archived after ' || d || ' days without being claimed.', id
    from public.items where status='active' and created_at < now() - make_interval(days => d);
  update public.items set status='expired' where status='active' and created_at < now() - make_interval(days => d);
end $$;

-- disputes
create type public.dispute_status as enum ('open','resolved','dismissed');
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  claim_id uuid references public.claims(id) on delete set null,
  raised_by uuid not null,
  reason text not null check (char_length(reason) between 10 and 2000),
  status public.dispute_status not null default 'open',
  resolution text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
grant select, insert, update on public.disputes to authenticated;
grant all on public.disputes to service_role;
alter table public.disputes enable row level security;
create policy "raise dispute" on public.disputes for insert to authenticated
  with check (raised_by = auth.uid() and status = 'open' and (
    exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
    or exists (select 1 from public.claims c where c.item_id = disputes.item_id and c.claimant_id = auth.uid())));
create policy "read own or admin disputes" on public.disputes for select to authenticated
  using (raised_by = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin resolves disputes" on public.disputes for update to authenticated
  using (public.has_role(auth.uid(),'admin'));

create or replace function public.on_dispute_resolved()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> old.status and new.status <> 'open' then
    insert into public.notifications(user_id, message, item_id) values (new.raised_by,
      'Your dispute was ' || new.status || coalesce(': ' || nullif(new.resolution,''), '.'), new.item_id);
  end if;
  return new;
end $$;
create trigger disputes_resolved after update on public.disputes for each row execute function public.on_dispute_resolved();