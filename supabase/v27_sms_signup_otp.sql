-- SmartSell V27 — défis OTP SMS pour l'inscription autonome avec Nimba.
begin;

create table if not exists public.signup_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  email text not null,
  full_name text not null,
  company_name text not null,
  code_hash text not null,
  attempts smallint not null default 0,
  max_attempts smallint not null default 5,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists signup_otp_phone_created on public.signup_otp_challenges(phone, created_at desc);
create index if not exists signup_otp_email_created on public.signup_otp_challenges(email, created_at desc);
alter table public.signup_otp_challenges enable row level security;
revoke all on public.signup_otp_challenges from anon, authenticated;

commit;
