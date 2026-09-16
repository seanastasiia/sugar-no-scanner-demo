-- The managed catalog is private. Only the server-side Supabase client may read it.
revoke all on table public.products, public.product_sources from anon, authenticated;
grant select on table public.products, public.product_sources to service_role;

