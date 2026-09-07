-- Additive, backwards-compatible RPC upgrade. Existing cards and RLS remain unchanged.
create or replace function public.promote_shared_web_product(p_alias_key text, p_identity_key text, p_record jsonb, p_version_hash text)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  current_row public.shared_web_products%rowtype;
  alias_row public.shared_web_product_aliases%rowtype;
  merged jsonb;
  blocked text[] := '{}';
  path text[];
  field text;
  previous jsonb;
  incoming jsonb;
  decision text := 'accepted';
  product_id text := p_record->>'id';
begin
  if product_id is null or product_id !~ '^web:shared:[0-9a-f]{24}$'
    or p_alias_key not like 'page-v1:%' or length(p_alias_key) > 2000
    or length(p_identity_key) > 2000 or p_version_hash !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_record->'nutrientsPer100g') <> 'object' then
    raise exception 'invalid shared product observation';
  end if;
  perform pg_advisory_xact_lock(310923001);
  select * into alias_row from public.shared_web_product_aliases where alias_key = p_alias_key;
  if found and (alias_row.blocked or alias_row.product_id <> product_id) then
    update public.shared_web_product_aliases set blocked = true where alias_key = p_alias_key;
    insert into public.shared_web_product_observations values (p_version_hash, product_id, p_record, 'identity_conflict', now()) on conflict do nothing;
    return jsonb_build_object('status', 'conflict');
  end if;
  select * into current_row from public.shared_web_products where id = product_id;
  if found then
    if current_row.identity_key <> p_identity_key then
      return jsonb_build_object('status', 'conflict');
    end if;
    merged := current_row.record;
    blocked := current_row.blocked_fields;
    foreach field in array array['nutritionBasis', 'energyKcalPer100', 'proteinG', 'fiberG', 'totalSugarG', 'carbohydrateG'] loop
      path := case when field in ('nutritionBasis', 'energyKcalPer100') then array[field] else array['nutrientsPer100g', field] end;
      previous := coalesce(merged #> path, 'null'::jsonb);
      incoming := coalesce(p_record #> path, 'null'::jsonb);
      if previous <> 'null'::jsonb and incoming <> 'null'::jsonb and previous <> incoming then
        blocked := array_append(blocked, field);
        decision := 'field_conflict';
      end if;
      if field = any(blocked) then
        merged := jsonb_set(merged, path, 'null'::jsonb);
      elsif previous = 'null'::jsonb and incoming <> 'null'::jsonb then
        merged := jsonb_set(merged, path, incoming);
      end if;
    end loop;
    -- Combining partial observations must not create an inconsistent table.
    if ((merged #>> '{nutrientsPer100g,totalSugarG}')::numeric > (merged #>> '{nutrientsPer100g,carbohydrateG}')::numeric)
      or (coalesce((merged #>> '{nutrientsPer100g,proteinG}')::numeric, 0) + coalesce((merged #>> '{nutrientsPer100g,carbohydrateG}')::numeric, 0) > 101)
      or ((merged #>> '{nutrientsPer100g,proteinG}')::numeric * 4 > (merged->>'energyKcalPer100')::numeric + 5) then
      blocked := array_append(blocked, 'nutritionBasis');
      decision := 'field_conflict';
    end if;
    -- A conflict about per-100 g/ml invalidates every nutrient, not just a label.
    if 'nutritionBasis' = any(blocked) then
      blocked := array['nutritionBasis', 'energyKcalPer100', 'proteinG', 'fiberG', 'totalSugarG', 'carbohydrateG'];
      merged := jsonb_set(merged, '{nutritionBasis}', 'null');
      merged := jsonb_set(merged, '{energyKcalPer100}', 'null');
      merged := jsonb_set(merged, '{nutrientsPer100g}', '{"proteinG":null,"fiberG":null,"totalSugarG":null,"carbohydrateG":null}');
    end if;
    -- Composition is one exact-source observation, never a per-field merge.
    previous := coalesce(current_row.record->'canonicalShelfEvidence', 'null'::jsonb);
    incoming := coalesce(p_record->'canonicalShelfEvidence', 'null'::jsonb);
    if previous <> 'null'::jsonb and incoming <> 'null'::jsonb
       and (previous - 'checkedAt') <> (incoming - 'checkedAt') then
      blocked := array_append(blocked, 'canonicalShelfEvidence');
      decision := 'field_conflict';
    end if;
    -- Any earlier nutrition/composition conflict keeps Personal Fit unknown.
    if cardinality(blocked) > 0 then
      merged := merged - 'canonicalShelfEvidence';
    elsif previous = 'null'::jsonb and incoming <> 'null'::jsonb then
      merged := jsonb_set(merged, '{canonicalShelfEvidence}', incoming);
    end if;
    -- Keep both provenance records when filling formerly unknown fields.
    if merged <> current_row.record then
      merged := jsonb_set(merged, '{sources}', coalesce(merged->'sources', '[]') || coalesce(p_record->'sources', '[]'));
    end if;
    update public.shared_web_products set record = merged, blocked_fields = blocked, checked_at = now() where id = product_id;
  else
    merged := p_record;
    insert into public.shared_web_products(id, identity_key, record) values(product_id, p_identity_key, merged);
  end if;
  insert into public.shared_web_product_aliases(alias_key, product_id) values (p_alias_key, product_id) on conflict do nothing;
  insert into public.shared_web_product_observations values (p_version_hash, product_id, p_record, decision, now()) on conflict do nothing;
  return jsonb_build_object('status', 'accepted', 'record', merged);
end;
$$;
revoke all on function public.promote_shared_web_product(text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.promote_shared_web_product(text, text, jsonb, text) to service_role;
