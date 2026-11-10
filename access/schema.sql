-- «Магия каждого дня. 2027 г.» — схема персонального доступа.
-- Тарифы с 2026-11-10: по Москве (Europe/Moscow, UTC+3), конец периода исключительно, цена в копейках.
-- ЗАГОТОВКА для Supabase. Не запускать платежный webhook без проверки подписи!
-- Выполнять только в доверенном SQL Editor Supabase; никакие ключи сюда не помещать.

create extension if not exists pgcrypto;

-- Авторитетный прайс хранится на сервере, а не в браузере.
create table if not exists public.magic_calendar_prices (
  tier text primary key check (tier in ('early','mid','regular')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  amount_kopecks integer not null check (amount_kopecks > 0),
  currency text not null default 'RUB' check (currency = 'RUB'),
  check (ends_at is null or ends_at > starts_at)
);
insert into public.magic_calendar_prices (tier, starts_at, ends_at, amount_kopecks)
values
 ('early','2026-10-01 00:00:00+03','2026-12-01 00:00:00+03',99000),
 ('mid','2026-12-01 00:00:00+03','2026-12-16 00:00:00+03',159000),
 ('regular','2026-12-16 00:00:00+03',null,199000)
on conflict (tier) do update
 set starts_at=excluded.starts_at,
     ends_at=excluded.ends_at,
     amount_kopecks=excluded.amount_kopecks;

-- Покупатель входит через Supabase Auth (email с одноразовым кодом/ссылкой).
create table if not exists public.magic_calendar_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id),
  product_code text not null default 'magic-calendar-2027'
    check (product_code = 'magic-calendar-2027'),
  tier text not null references public.magic_calendar_prices(tier),
  amount_kopecks integer not null check (amount_kopecks in (99000,159000,199000)),
  currency text not null default 'RUB' check (currency='RUB'),
  status text not null default 'pending'
    check (status in ('pending','paid','cancelled','refunded')),
  prodamus_payment_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists magic_orders_buyer_status_idx
  on public.magic_calendar_orders(buyer_id,status,created_at desc);

-- Доступ создаётся только на сервере после подтверждённого платежа.
create table if not exists public.magic_calendar_access (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id),
  order_id uuid not null unique references public.magic_calendar_orders(id),
  product_code text not null default 'magic-calendar-2027'
    check (product_code = 'magic-calendar-2027'),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null default '2028-01-01 00:00:00+05',
  revoked_at timestamptz,
  check (expires_at > granted_at)
);
create index if not exists magic_access_buyer_expiry_idx
  on public.magic_calendar_access(buyer_id,expires_at);

-- Повторное уведомление Prodamus не создаёт вторую выдачу доступа:
-- уникальный order_id в таблице доступа и уникальный prodamus_payment_id в заказах.
-- Важно дополнительно проверять подлинную подпись, order_num, магазин, сумму, валюту, статус.

alter table public.magic_calendar_prices enable row level security;
alter table public.magic_calendar_orders enable row level security;
alter table public.magic_calendar_access enable row level security;

-- Клиент может только читать прайс и СВОИ заказы / доступ.
-- CREATE/UPDATE/DELETE заказов и доступов выполняет доверенная Edge Function
-- через service_role, никогда не раскрываемый в браузере.
create policy "Read calendar prices" on public.magic_calendar_prices
  for select to anon, authenticated using (true);
create policy "Read own calendar orders" on public.magic_calendar_orders
  for select to authenticated using ((select auth.uid()) = buyer_id);
create policy "Read own calendar access" on public.magic_calendar_access
  for select to authenticated using ((select auth.uid()) = buyer_id);

grant select on public.magic_calendar_prices to anon, authenticated;
grant select on public.magic_calendar_orders to authenticated;
grant select on public.magic_calendar_access to authenticated;
revoke insert, update, delete on public.magic_calendar_orders from anon, authenticated;
revoke insert, update, delete on public.magic_calendar_access from anon, authenticated;

-- Проверка сервера для открытия платного календаря:
-- orders.status = 'paid', access.revoked_at IS NULL, access.expires_at > now().
-- Не считать переход на «оплата успешна» подтверждением платежа.
