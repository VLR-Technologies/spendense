-- Preserve the original migrations for projects that have already applied them.
-- An explicit state is safe to retry after a lost HTTP response. No financial
-- amount is changed and the existing repository contract is retained.
create function public.daywise_set_paid(p_id text, p_commitment text, p_paid boolean)
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if p_paid is null then
    raise exception 'Payment state is required' using errcode = '22004';
  end if;
  perform public.daywise_lock(p_id);
  update public.monthly_commitments set paid = p_paid
    where id = p_commitment and "profileId" = p_id;
  if not found then
    raise exception 'Commitment unavailable' using errcode = '42501';
  end if;
end $$;

revoke all on function public.daywise_set_paid(text, text, boolean) from public, anon, authenticated;
grant execute on function public.daywise_set_paid(text, text, boolean) to authenticated;
