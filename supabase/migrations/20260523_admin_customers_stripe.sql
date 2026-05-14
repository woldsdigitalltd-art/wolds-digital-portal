-- Add stripe_customer_id to the get_admin_customers RPC output.
-- Previously the column was omitted, so ProvisionStripeButton always
-- showed "Create Stripe" even after a customer had been provisioned.

create or replace function public.get_admin_customers()
returns json
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  result json;
begin
  if not public.is_current_user_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(json_agg(c), '[]'::json)
  into result
  from (
    select
      u.id,
      u.email,
      u.created_at,
      u.last_sign_in_at,
      p.full_name,
      p.company_name,
      p.phone,
      p.stripe_customer_id,
      (select count(*) from public.sites s where s.owner_id = u.id) as site_count,
      sub.plan,
      sub.status              as subscription_status,
      sub.current_period_end  as subscription_renews_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join lateral (
      select plan, status, current_period_end
      from public.subscriptions s
      where s.owner_id = u.id
      order by updated_at desc nulls last
      limit 1
    ) sub on true
    where coalesce(p.is_admin, false) = false
    order by u.created_at desc nulls last
  ) c;

  return result;
end;
$$;
