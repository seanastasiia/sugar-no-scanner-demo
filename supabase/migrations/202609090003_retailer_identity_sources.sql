alter table public.retailer_catalog_food_identities
  drop constraint if exists retailer_catalog_food_identities_retailer_check;

alter table public.retailer_catalog_food_identities
  add constraint retailer_catalog_food_identities_retailer_check
  check (
    (source_id = 'rimi_lv' and retailer = 'Rimi') or
    (source_id = 'lidl_lv' and retailer = 'Lidl') or
    (source_id = 'livinn_lt' and retailer = 'Livin')
  );

comment on table public.retailer_catalog_food_identities is
  'Non-redistributable Rimi, Lidl and Livinn food identities used for exact SKU matching. Missing nutrition stays null by design in the separate rated-product layer.';
