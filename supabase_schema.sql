-- =====================================================================
-- CRM Empresarial - Esquema Supabase (con Supabase Auth + RLS real)
-- Copia y pega TODO este script en Supabase > SQL Editor y ejecutalo.
--
-- MODELO: equipo compartido.
-- Todos los usuarios autenticados ven y editan los MISMOS datos
-- (clientes, productos, presupuestos, pedidos).
-- La seguridad esta en que SOLO los usuarios autenticados pueden acceder;
-- el rol publico "anon" (que es el que expone la ANON KEY del frontend)
-- NO tiene ninguna politica y por tanto NO puede leer ni escribir nada.
-- Es decir: aunque alguien obtenga la URL y la ANON KEY publica, no
-- podra acceder a los datos sin haberse autenticado antes.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- TABLA clientes ---------------------------------------------------
create table if not exists public.clientes (
  id                uuid primary key default gen_random_uuid(),
  numero_cliente    text unique not null,
  nombre            text not null,
  dni               text,
  telefono          text,
  email             text,
  direccion         text,
  poblacion         text,
  cp                text,
  provincia         text,
  observaciones     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_clientes_nombre    on public.clientes (lower(nombre));
create index if not exists idx_clientes_dni       on public.clientes (dni);
create index if not exists idx_clientes_telefono  on public.clientes (telefono);

-- ---------- TABLA productos --------------------------------------------------
create table if not exists public.productos (
  id            uuid primary key default gen_random_uuid(),
  referencia    text unique not null,
  nombre        text not null,
  descripcion   text,
  precio        numeric(12,2) not null default 0,
  stock         numeric(12,2),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_productos_nombre on public.productos (lower(nombre));

-- ---------- TABLA presupuestos ----------------------------------------------
create table if not exists public.presupuestos (
  id                    uuid primary key default gen_random_uuid(),
  numero_presupuesto    text unique not null,
  cliente_id            uuid not null references public.clientes(id) on delete restrict,
  fecha                 date not null default current_date,
  estado                text not null default 'Pendiente',
  observaciones         text,
  subtotal              numeric(12,2) not null default 0,
  iva                   numeric(12,2) not null default 0,
  total                 numeric(12,2) not null default 0,
  pedido_id             uuid,
  pedido_numero         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_presupuestos_cliente on public.presupuestos (cliente_id);
create index if not exists idx_presupuestos_estado  on public.presupuestos (estado);

-- ---------- TABLA presupuesto_items -----------------------------------------
create table if not exists public.presupuesto_items (
  id               uuid primary key default gen_random_uuid(),
  presupuesto_id   uuid not null references public.presupuestos(id) on delete cascade,
  producto_id      uuid references public.productos(id) on delete set null,
  producto_codigo  text,
  descripcion      text,
  cantidad         numeric(12,2) not null default 1,
  precio           numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0
);
create index if not exists idx_pres_items_presupuesto on public.presupuesto_items (presupuesto_id);

-- ---------- TABLA pedidos ----------------------------------------------------
create table if not exists public.pedidos (
  id                uuid primary key default gen_random_uuid(),
  numero_pedido     text unique not null,
  cliente_id        uuid not null references public.clientes(id) on delete restrict,
  presupuesto_id    uuid references public.presupuestos(id) on delete set null,
  presupuesto_numero text,
  fecha             date not null default current_date,
  estado            text not null default 'Pendiente',
  observaciones     text,
  subtotal          numeric(12,2) not null default 0,
  iva               numeric(12,2) not null default 0,
  total             numeric(12,2) not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_pedidos_cliente     on public.pedidos (cliente_id);
create index if not exists idx_pedidos_presupuesto on public.pedidos (presupuesto_id);
create index if not exists idx_pedidos_estado      on public.pedidos (estado);

-- ---------- TABLA pedido_items ----------------------------------------------
create table if not exists public.pedido_items (
  id               uuid primary key default gen_random_uuid(),
  pedido_id        uuid not null references public.pedidos(id) on delete cascade,
  producto_id      uuid references public.productos(id) on delete set null,
  producto_codigo  text,
  descripcion      text,
  cantidad         numeric(12,2) not null default 1,
  precio           numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0
);
create index if not exists idx_pedido_items_pedido on public.pedido_items (pedido_id);

-- ---------- Trigger para updated_at -----------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_clientes_updated_at on public.clientes;
create trigger trg_clientes_updated_at before update on public.clientes
for each row execute function public.set_updated_at();

drop trigger if exists trg_productos_updated_at on public.productos;
create trigger trg_productos_updated_at before update on public.productos
for each row execute function public.set_updated_at();

drop trigger if exists trg_presupuestos_updated_at on public.presupuestos;
create trigger trg_presupuestos_updated_at before update on public.presupuestos
for each row execute function public.set_updated_at();

drop trigger if exists trg_pedidos_updated_at on public.pedidos;
create trigger trg_pedidos_updated_at before update on public.pedidos
for each row execute function public.set_updated_at();

-- ---------- Numeracion segura sin duplicados --------------------------------
create table if not exists public.contadores (
  kind   text primary key,
  valor  bigint not null default 0
);

create or replace function public.siguiente_numero(
  p_kind    text,
  p_prefijo text,
  p_digitos int
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next bigint;
begin
  -- security definer: puede tocar public.contadores incluso si
  -- el rol authenticated no tiene permiso directo sobre esa tabla.
  insert into public.contadores(kind, valor)
  values (p_kind, 1)
  on conflict (kind) do update
     set valor = public.contadores.valor + 1
  returning valor into v_next;

  return p_prefijo || lpad(v_next::text, p_digitos, '0');
end $$;

revoke all on function public.siguiente_numero(text, text, int) from public;
revoke execute on function public.siguiente_numero(text, text, int) from anon;
grant execute on function public.siguiente_numero(text, text, int) to authenticated;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
-- Activamos RLS en todas las tablas. Definimos politicas SOLO para el
-- rol "authenticated". El rol "anon" no tiene ninguna politica y por
-- tanto no puede leer, insertar, actualizar ni borrar nada.
--
-- IMPORTANTE: el rol "authenticated" solo se aplica cuando el cliente
-- envia un JWT valido de Supabase Auth. Sin login -> rol anon -> sin
-- acceso.
-- =====================================================================

alter table public.clientes            enable row level security;
alter table public.productos           enable row level security;
alter table public.presupuestos        enable row level security;
alter table public.presupuesto_items   enable row level security;
alter table public.pedidos             enable row level security;
alter table public.pedido_items        enable row level security;
alter table public.contadores          enable row level security;

-- Limpieza de posibles politicas antiguas (idempotente).
do $$
declare
  t text;
  p text;
begin
  foreach t in array array[
    'clientes','productos','presupuestos','presupuesto_items',
    'pedidos','pedido_items','contadores'
  ] loop
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I;', p, t);
    end loop;
  end loop;
end $$;

-- Politicas para tablas simples (equipo compartido: todo authenticated).
do $$
declare
  t text;
begin
  foreach t in array array['clientes','productos'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (true);',
      t || '_select_auth', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (true);',
      t || '_insert_auth', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (true) with check (true);',
      t || '_update_auth', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (true);',
      t || '_delete_auth', t);
  end loop;
end $$;

-- Presupuestos y pedidos (cabeceras): mismo criterio.
create policy presupuestos_select_auth on public.presupuestos
  for select to authenticated using (true);
create policy presupuestos_insert_auth on public.presupuestos
  for insert to authenticated with check (true);
create policy presupuestos_update_auth on public.presupuestos
  for update to authenticated using (true) with check (true);
create policy presupuestos_delete_auth on public.presupuestos
  for delete to authenticated using (true);

create policy pedidos_select_auth on public.pedidos
  for select to authenticated using (true);
create policy pedidos_insert_auth on public.pedidos
  for insert to authenticated with check (true);
create policy pedidos_update_auth on public.pedidos
  for update to authenticated using (true) with check (true);
create policy pedidos_delete_auth on public.pedidos
  for delete to authenticated using (true);

-- Items: se protegen ademas exigiendo que la cabecera padre exista
-- (para que nadie pueda insertar un item huerfano o apuntando a un
-- presupuesto/pedido que no ve).
create policy presupuesto_items_select_auth on public.presupuesto_items
  for select to authenticated
  using (
    exists (select 1 from public.presupuestos p where p.id = presupuesto_id)
  );
create policy presupuesto_items_insert_auth on public.presupuesto_items
  for insert to authenticated
  with check (
    exists (select 1 from public.presupuestos p where p.id = presupuesto_id)
  );
create policy presupuesto_items_update_auth on public.presupuesto_items
  for update to authenticated
  using (
    exists (select 1 from public.presupuestos p where p.id = presupuesto_id)
  )
  with check (
    exists (select 1 from public.presupuestos p where p.id = presupuesto_id)
  );
create policy presupuesto_items_delete_auth on public.presupuesto_items
  for delete to authenticated
  using (
    exists (select 1 from public.presupuestos p where p.id = presupuesto_id)
  );

create policy pedido_items_select_auth on public.pedido_items
  for select to authenticated
  using (
    exists (select 1 from public.pedidos p where p.id = pedido_id)
  );
create policy pedido_items_insert_auth on public.pedido_items
  for insert to authenticated
  with check (
    exists (select 1 from public.pedidos p where p.id = pedido_id)
  );
create policy pedido_items_update_auth on public.pedido_items
  for update to authenticated
  using (
    exists (select 1 from public.pedidos p where p.id = pedido_id)
  )
  with check (
    exists (select 1 from public.pedidos p where p.id = pedido_id)
  );
create policy pedido_items_delete_auth on public.pedido_items
  for delete to authenticated
  using (
    exists (select 1 from public.pedidos p where p.id = pedido_id)
  );

-- contadores: no exponemos NINGUNA politica de lectura/escritura directa.
-- Solo la funcion RPC "siguiente_numero" (security definer) puede
-- modificar esa tabla. Asi se evita que el frontend manipule contadores.

-- =====================================================================
-- FIN.
-- Siguientes pasos:
-- 1) En Supabase > Authentication > Providers, deja habilitado "Email".
-- 2) En Supabase > Authentication > Users, crea manualmente los
--    usuarios del equipo (email + password). No hay auto-registro.
-- 3) En js/supabase.js pega la Project URL y la ANON KEY.
-- =====================================================================
