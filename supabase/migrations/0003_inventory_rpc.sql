-- ============================================================================
-- Atomic inventory decrement, called from stripe-webhook.js after a payment
-- is confirmed. Doing this as a single UPDATE avoids a read-then-write race
-- between two nearly-simultaneous paid orders for the same variant.
-- SECURITY DEFINER so it can run with the privileges needed to update
-- product_variants even though anon/authenticated have no direct UPDATE
-- policy on that table; only granted to service_role below.
-- ============================================================================
create or replace function public.decrement_variant_inventory(p_variant_id uuid, p_quantity integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.product_variants
  set inventory_count = greatest(inventory_count - p_quantity, 0)
  where id = p_variant_id;
end;
$$;

revoke all on function public.decrement_variant_inventory(uuid, integer) from public;
grant execute on function public.decrement_variant_inventory(uuid, integer) to service_role;
