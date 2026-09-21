-- RUN ONLY AFTER CLOUD APPROVAL. This is deliberately not an automatic migration.
-- First create Vault secrets loan_push_worker_url and loan_push_worker_secret
-- through the Supabase dashboard. Never commit secret values.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$
begin
  if (select count(*) from vault.decrypted_secrets where name='loan_push_worker_url'
      and decrypted_secret='https://kircmwdkcdcozckrwfid.supabase.co/functions/v1/push-worker')<>1 then
    raise exception 'Expected STAGING push worker URL in Vault';
  end if;
  if (select count(*) from vault.decrypted_secrets where name='loan_push_worker_secret'
      and length(decrypted_secret)>=32)<>1 then raise exception 'Missing worker secret in Vault'; end if;
end; $$;
select cron.schedule('loan-push-worker','* * * * *',$job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='loan_push_worker_url'),
    headers := jsonb_build_object('Content-Type','application/json','x-worker-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='loan_push_worker_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 65000
  );
$job$);
commit;
