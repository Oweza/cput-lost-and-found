create type public.app_role as enum ('admin','user');
create type public.item_type as enum ('lost','found');
create type public.item_status as enum ('active','claimed','expired');
create type public.claim_status as enum ('pending','approved','rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  student_number text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile write" on public.profiles for update to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type item_type not null,
  title text not null check (char_length(title) between 2 and 120),
  category text not null,
  description text not null default '' check (char_length(description) <= 2000),
  item_date date not null,
  campus text not null,
  location text not null default '',
  photo_url text,
  status item_status not null default 'active',
  created_at timestamptz not null default now()
);
grant select on public.items to anon;
grant select, insert, update, delete on public.items to authenticated;
grant all on public.items to service_role;
alter table public.items enable row level security;
create policy "public read items" on public.items for select to anon, authenticated using (true);
create policy "insert own items" on public.items for insert to authenticated with check (user_id = auth.uid());
create policy "update own or admin" on public.items for update to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "delete own or admin" on public.items for delete to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  claimant_id uuid not null,
  proof text not null check (char_length(proof) between 10 and 2000),
  contact text not null default '',
  status claim_status not null default 'pending',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.claims to authenticated;
grant all on public.claims to service_role;
alter table public.claims enable row level security;
create policy "claimant or admin read" on public.claims for select to authenticated using (claimant_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "insert own claim" on public.claims for insert to authenticated with check (claimant_id = auth.uid() and status = 'pending');
create policy "admin update claims" on public.claims for update to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  message text not null,
  item_id uuid references public.items(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "own notifications update" on public.notifications for update to authenticated using (user_id = auth.uid());
create policy "own notifications delete" on public.notifications for delete to authenticated using (user_id = auth.uid());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, student_number)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.raw_user_meta_data->>'student_number');
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.notify_matches() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.type = 'found' then
    for r in select * from public.items where type='lost' and status='active' and category=new.category and campus=new.campus and user_id <> new.user_id loop
      insert into public.notifications(user_id, message, item_id) values (r.user_id, 'A found item may match your lost "' || r.title || '": ' || new.title || ' (' || new.campus || ')', new.id);
    end loop;
  else
    for r in select * from public.items where type='found' and status='active' and category=new.category and campus=new.campus and user_id <> new.user_id loop
      insert into public.notifications(user_id, message, item_id) values (new.user_id, 'An already-reported found item may match your lost "' || new.title || '": ' || r.title, r.id);
    end loop;
  end if;
  return new;
end $$;
create trigger items_notify_matches after insert on public.items for each row execute function public.notify_matches();

create or replace function public.on_claim_change() returns trigger language plpgsql security definer set search_path = public as $$
declare t text;
begin
  select title into t from public.items where id = new.item_id;
  if tg_op = 'INSERT' then
    insert into public.notifications(user_id, message, item_id)
      select user_id, 'Someone submitted an ownership claim for "' || t || '". Campus security will verify it.', new.item_id from public.items where id = new.item_id;
  elsif new.status <> old.status then
    insert into public.notifications(user_id, message, item_id) values (new.claimant_id,
      case when new.status='approved' then 'Your claim for "' || t || '" was approved. Collect it at the campus security office with your student/staff card.'
           else 'Your claim for "' || t || '" was not approved.' end, new.item_id);
    if new.status='approved' then update public.items set status='claimed' where id = new.item_id; end if;
  end if;
  return new;
end $$;
create trigger claims_change after insert or update on public.claims for each row execute function public.on_claim_change();

create policy "item photos public read" on storage.objects for select using (bucket_id = 'item-photos');
create policy "item photos upload own" on storage.objects for insert to authenticated with check (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);