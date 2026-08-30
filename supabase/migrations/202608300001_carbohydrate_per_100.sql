do $$
begin
  if to_regclass('public.products') is not null then
    execute 'alter table public.products add column if not exists carbohydrate_g_100 numeric check (carbohydrate_g_100 >= 0)';
    execute 'comment on column public.products.carbohydrate_g_100 is ''Source-backed carbohydrate amount per 100 g or 100 ml. Informational only; not part of Sugar.no Fit.''';
  end if;

  if to_regclass('public.retailer_catalog_products') is not null then
    execute 'alter table public.retailer_catalog_products add column if not exists carbohydrate_g_100 numeric check (carbohydrate_g_100 >= 0)';
    execute 'comment on column public.retailer_catalog_products.carbohydrate_g_100 is ''Retailer-reported carbohydrate amount per 100 g or 100 ml.''';
  end if;

  if to_regclass('public.retailer_catalog_product_versions') is not null then
    execute 'alter table public.retailer_catalog_product_versions add column if not exists carbohydrate_g_100 numeric check (carbohydrate_g_100 >= 0)';
    execute 'comment on column public.retailer_catalog_product_versions.carbohydrate_g_100 is ''Versioned retailer-reported carbohydrate amount per 100 g or 100 ml.''';
  end if;

  if to_regclass('public.open_food_facts_products') is not null then
    execute 'alter table public.open_food_facts_products add column if not exists carbohydrate_g_100 numeric check (carbohydrate_g_100 >= 0)';
    execute 'comment on column public.open_food_facts_products.carbohydrate_g_100 is ''Open Food Facts carbohydrate amount per 100 g or 100 ml.''';
  end if;
end $$;
