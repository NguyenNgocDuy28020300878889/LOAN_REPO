begin;
create extension if not exists pgtap with schema extensions;
set local role postgres;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email) values
  ('c1000000-0000-4000-8000-000000000001', 'lifecycle-owner@example.invalid'),
  ('c1000000-0000-4000-8000-000000000002', 'lifecycle-recipient@example.invalid');
insert into auth.sessions (id, user_id) values
  ('c1100000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002');
insert into private.push_devices (
  id, secret_hash, user_id, session_id, expo_token, platform, timezone, locale
) values (
  'c1200000-0000-4000-8000-000000000002',
  repeat('c', 64),
  'c1000000-0000-4000-8000-000000000002',
  'c1100000-0000-4000-8000-000000000002',
  'ExpoPushToken[lifecycle]',
  'android',
  'Asia/Ho_Chi_Minh',
  'en'
);

create temporary table lifecycle_results (name text primary key, result jsonb);
grant all on lifecycle_results to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = 'c1000000-0000-4000-8000-000000000001';
insert into lifecycle_results values (
  'loan',
  public.create_loan(
    'LENDER', 5000, 'VND', '2026-09-01', '2026-10-01', 'Lifecycle', null,
    'c2000000-0000-4000-8000-000000000001',
    'lifecycle-recipient@example.invalid'
  )
);

set local request.jwt.claim.sub = 'c1000000-0000-4000-8000-000000000002';
select is(
  jsonb_array_length(public.get_my_pending_invites()),
  1,
  'Designated recipient sees a live invitation'
);
set local role postgres;
select is(
  (select count(*) from private.push_deliveries where kind = 'INVITE_RECEIVED' and status = 'pending'),
  1::bigint,
  'Creating a designated invitation queues one push'
);

set local role authenticated;
set local request.jwt.claim.sub = 'c1000000-0000-4000-8000-000000000001';
insert into lifecycle_results values (
  'rotated',
  public.manage_loan_invite(
    (select (result->>'loan_id')::uuid from lifecycle_results where name = 'loan'),
    'rotate',
    'c2000000-0000-4000-8000-000000000002'
  )
);
select isnt(
  (select result->>'invite_token' from lifecycle_results where name = 'rotated'),
  null::text,
  'Owner can replace a link bound to a designated recipient'
);
set local role postgres;
select is(
  (select count(*) from private.push_deliveries where kind = 'INVITE_RECEIVED' and status = 'pending'),
  1::bigint,
  'Replacing a link cancels the old push and queues one current push'
);

set local role authenticated;
set local request.jwt.claim.sub = 'c1000000-0000-4000-8000-000000000001';
select lives_ok(
  format(
    'select public.manage_loan_invite(%L, ''revoke'', %L)',
    (select result->>'loan_id' from lifecycle_results where name = 'loan'),
    'c2000000-0000-4000-8000-000000000003'
  ),
  'Owner can revoke a designated invitation link'
);
set local role postgres;
select is(
  (select count(*) from private.push_deliveries where kind = 'INVITE_RECEIVED' and status = 'pending'),
  0::bigint,
  'Revocation cancels queued invitation pushes'
);

set local request.jwt.claim.sub = 'c1000000-0000-4000-8000-000000000002';
set local role authenticated;
select is(
  jsonb_array_length(public.get_my_pending_invites()),
  0,
  'Revoked invitation disappears from the designated recipient list'
);
select throws_ok(
  format(
    'select public.get_pending_invite_detail(%L)',
    (select result->>'loan_id' from lifecycle_results where name = 'loan')
  ),
  'P0002',
  'INVITE_NOT_FOUND',
  'Revoked invitation detail is unavailable'
);
select throws_ok(
  format(
    'select public.respond_to_invite(%L, ''accept'', %L)',
    (select result->>'loan_id' from lifecycle_results where name = 'loan'),
    'c2000000-0000-4000-8000-000000000004'
  ),
  'P0001',
  'INVITE_UNAVAILABLE',
  'Designated recipient cannot bypass revocation with the loan id'
);

set local request.jwt.claim.sub = 'c1000000-0000-4000-8000-000000000001';
insert into lifecycle_results values (
  'fresh',
  public.manage_loan_invite(
    (select (result->>'loan_id')::uuid from lifecycle_results where name = 'loan'),
    'rotate',
    'c2000000-0000-4000-8000-000000000005'
  )
);

set local request.jwt.claim.sub = 'c1000000-0000-4000-8000-000000000002';
select is(
  jsonb_array_length(public.get_my_pending_invites()),
  1,
  'A replacement restores the designated invitation'
);

set local role postgres;
update public.loan_invites
set created_at = now() - interval '2 minutes',
    expires_at = now() - interval '1 minute'
where loan_id = (select (result->>'loan_id')::uuid from lifecycle_results where name = 'loan')
  and used_at is null
  and revoked_at is null;
select ok(
  not (
    select private.push_delivery_valid(delivery, now())
    from private.push_deliveries delivery
    where delivery.kind = 'INVITE_RECEIVED' and delivery.status = 'pending'
    order by delivery.created_at desc
    limit 1
  ),
  'Expired invitation invalidates its queued push'
);

set local role authenticated;
set local request.jwt.claim.sub = 'c1000000-0000-4000-8000-000000000002';
select is(
  jsonb_array_length(public.get_my_pending_invites()),
  0,
  'Expired invitation disappears from the designated recipient list'
);
select throws_ok(
  format(
    'select public.respond_to_invite(%L, ''accept'', %L)',
    (select result->>'loan_id' from lifecycle_results where name = 'loan'),
    'c2000000-0000-4000-8000-000000000006'
  ),
  'P0001',
  'INVITE_EXPIRED',
  'Designated recipient cannot bypass expiry with the loan id'
);

set local request.jwt.claim.sub = 'c1000000-0000-4000-8000-000000000001';
select lives_ok(
  format(
    'select public.manage_loan_invite(%L, ''rotate'', %L)',
    (select result->>'loan_id' from lifecycle_results where name = 'loan'),
    'c2000000-0000-4000-8000-000000000007'
  ),
  'Owner can replace an expired invitation'
);

set local request.jwt.claim.sub = 'c1000000-0000-4000-8000-000000000002';
select is(
  public.respond_to_invite(
    (select (result->>'loan_id')::uuid from lifecycle_results where name = 'loan'),
    'decline',
    'c2000000-0000-4000-8000-000000000008'
  )->>'status',
  'DECLINED',
  'Designated recipient can decline a fresh replacement'
);
select is(
  jsonb_array_length(public.get_my_pending_invites()),
  0,
  'Declined invitation no longer appears'
);

set local role postgres;
select * from finish();
rollback;
