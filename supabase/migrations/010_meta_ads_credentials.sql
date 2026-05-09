-- ================================================================
-- META ADS: credenciais e sincronização de campanhas
-- ================================================================

-- Credenciais da API do Meta por tenant (criptografadas na aplicação)
create table if not exists meta_ads_credentials (
  tenant_id      uuid primary key references tenants(id) on delete cascade,
  app_id         text not null,
  access_token   text not null,    -- token de acesso (long-lived user token)
  ad_account_id  text not null,    -- ex: act_1234567890
  synced_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table meta_ads_credentials enable row level security;

create policy "admins_manage_meta_credentials" on meta_ads_credentials
  for all using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and role = 'admin' and active = true
    )
  );

-- Campanhas já existem na migration 008 (tabela campaigns)
-- Apenas garantimos que o índice existe
create index if not exists campaigns_tenant_synced
  on campaigns (tenant_id, synced_at desc);
