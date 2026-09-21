begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();

insert into auth.users(id,email) values
 ('a1000000-0000-4000-8000-000000000001','push-a@example.invalid'),
 ('a1000000-0000-4000-8000-000000000002','push-b@example.invalid'),
 ('a1000000-0000-4000-8000-000000000003','push-c@example.invalid');
insert into auth.sessions(id,user_id) values
 ('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001'),
 ('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002');
insert into public.loans(id,principal_minor,currency,loan_date,due_date,status,created_by)
values('a3000000-0000-4000-8000-000000000001',1000,'VND','2099-10-01','2099-10-03','ACTIVE','a1000000-0000-4000-8000-000000000001');
insert into public.loan_members(loan_id,user_id,role,membership_status,joined_at) values
 ('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','LENDER','ACCEPTED',now()),
 ('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','BORROWER','ACCEPTED',now());

select ok(not has_function_privilege('authenticated','public.claim_push_work(boolean,integer)','execute'),'Clients cannot claim work');
select ok(not has_function_privilege('anon','public.register_push_device(uuid,text,text,text,text,text)','execute'),'Anonymous cannot register');
select ok(not has_table_privilege('authenticated','private.push_devices','select'),'Tokens hidden from clients');
select ok(not has_table_privilege('authenticated','private.push_deliveries','insert'),'Clients cannot forge notifications');
select ok(has_function_privilege('service_role','public.claim_push_work(boolean,integer)','execute'),'Worker can claim');

set local role authenticated;
set local request.jwt.claims='{"sub":"a1000000-0000-4000-8000-000000000001","session_id":"a2000000-0000-4000-8000-000000000001"}';
select lives_ok($$select public.register_push_device('a4000000-0000-4000-8000-000000000001',repeat('a',64),'ExpoPushToken[fixtureA]','android','Asia/Ho_Chi_Minh','vi')$$,'Register own device');
select throws_ok($$select public.register_push_device('a4000000-0000-4000-8000-000000000001',repeat('a',64),'ExpoPushToken[fixtureA]','android','Not/AZone','vi')$$,'P0001','INVALID_TIMEZONE','Reject unknown timezone');
set local request.jwt.claims='{"sub":"a1000000-0000-4000-8000-000000000002","session_id":"a2000000-0000-4000-8000-000000000002"}';
select throws_ok($$select public.register_push_device('a4000000-0000-4000-8000-000000000001',repeat('b',64),'ExpoPushToken[hijack]','android','UTC','vi')$$,'42501','DEVICE_OWNERSHIP_REQUIRED','Cannot hijack another installation');
select lives_ok($$select public.register_push_device('a4000000-0000-4000-8000-000000000002',repeat('b',64),'ExpoPushToken[fixtureB]','android','Asia/Ho_Chi_Minh','vi')$$,'Register borrower');
reset role;

insert into public.loan_events(id,loan_id,event_type,actor_id) values
 ('a5000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','LOAN_ACCEPTED','a1000000-0000-4000-8000-000000000002');
select is((select count(*) from private.push_deliveries where event_id='a5000000-0000-4000-8000-000000000001'),1::bigint,'One event notification, excludes actor');
select is((select user_id from private.push_deliveries where event_id='a5000000-0000-4000-8000-000000000001'),'a1000000-0000-4000-8000-000000000001'::uuid,'Other member receives update');
savepoint before_event;
insert into public.loan_events(id,loan_id,event_type,actor_id) values
 ('a5000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000001','REPAYMENT_SUBMITTED','a1000000-0000-4000-8000-000000000002');
rollback to before_event;
select is((select count(*) from private.push_deliveries where event_id='a5000000-0000-4000-8000-000000000002'),0::bigint,'Rolled back business event leaves no notification');

create temp table claimed as select public.claim_push_work(false,50) as jobs;
select is(jsonb_array_length((select jobs from claimed)),1,'Claim event once');
select is(jsonb_array_length(public.claim_push_work(false,50)),0,'Second worker cannot claim leased work');
select ok(public.authorize_push_send((select (jobs->0->>'id')::uuid from claimed),(select (jobs->0->>'lease_id')::uuid from claimed)),'Eligible job authorized');
select public.finish_push_work((select (jobs->0->>'id')::uuid from claimed),gen_random_uuid(),'accepted','wrong');
select is((select status from private.push_deliveries where event_id='a5000000-0000-4000-8000-000000000001'),'sending','Stale lease cannot acknowledge work');
select public.finish_push_work((select (jobs->0->>'id')::uuid from claimed),(select (jobs->0->>'lease_id')::uuid from claimed),'accepted','test-ticket');
select is((select status from private.push_deliveries where event_id='a5000000-0000-4000-8000-000000000001'),'ticketed','Provider acceptance is not delivery');
update private.push_deliveries set available_at=now()-interval '1 second' where ticket_id='test-ticket';
update claimed set jobs=public.claim_push_work(true,50);
select public.finish_push_work((select (jobs->0->>'id')::uuid from claimed),(select (jobs->0->>'lease_id')::uuid from claimed),'delivered');
select is((select status from private.push_deliveries where ticket_id='test-ticket'),'delivered','Receipt confirms provider delivery');

select is(public.enqueue_due_push('2099-10-02 01:59:00Z'),0,'No reminder before 09:00 local');
select is(public.enqueue_due_push('2099-10-02 02:00:00Z'),2,'09:00 local enqueues both members');
select is(public.enqueue_due_push('2099-10-02 02:01:00Z'),0,'Repeated scheduler creates no duplicates');
select is((select count(*) from private.push_deliveries where kind='DUE_TOMORROW'),2::bigint,'Tomorrow reminder kind recorded');
select ok((select bool_and(private.push_delivery_valid(j,'2099-10-02 02:00:00Z')) from private.push_deliveries j where kind='DUE_TOMORROW'),'Scheduled reminders eligible on their local day');
select ok(not (select bool_or(private.push_delivery_valid(j,'2099-10-03 02:00:00Z')) from private.push_deliveries j where kind='DUE_TOMORROW'),'No stale reminders on another day');
update public.loans set due_date='2099-10-04' where id='a3000000-0000-4000-8000-000000000001';
select ok(not (select bool_or(private.push_delivery_valid(j,'2099-10-02 02:00:00Z')) from private.push_deliveries j where kind='DUE_TOMORROW'),'Changing due date invalidates old reminders');
update public.loans set due_date='2099-10-03',status='REPAID' where id='a3000000-0000-4000-8000-000000000001';
select is(public.enqueue_due_push('2099-10-03 02:00:00Z'),0,'Paid loan not scheduled');
select ok(not (select bool_or(private.push_delivery_valid(j,'2099-10-02 02:00:00Z')) from private.push_deliveries j where kind='DUE_TOMORROW'),'Paid loan invalidates queued reminders');
update public.loans set status='ACTIVE' where id='a3000000-0000-4000-8000-000000000001';
insert into public.notification_preferences(user_id,push_enabled,due_reminders_enabled)
 values('a1000000-0000-4000-8000-000000000001',true,false);
select is((select status from private.push_deliveries where kind='DUE_TOMORROW' and user_id='a1000000-0000-4000-8000-000000000001'),'cancelled','Disabling reminders cancels queued reminder');
select is(public.enqueue_due_push('2099-10-03 02:00:00Z'),1,'Only opted in member receives due-day reminder');
update public.notification_preferences set push_enabled=false where user_id='a1000000-0000-4000-8000-000000000001';
insert into public.loan_events(id,loan_id,event_type,actor_id) values
 ('a5000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000001','REPAYMENT_DISPUTED','a1000000-0000-4000-8000-000000000002');
select is((select count(*) from private.push_deliveries where event_id='a5000000-0000-4000-8000-000000000003'),0::bigint,'Master opt out suppresses event pushes');

-- Real state transitions for transient errors, receipts and invalid device tokens.
insert into public.loan_events(id,loan_id,event_type,actor_id) values
 ('a5000000-0000-4000-8000-000000000004','a3000000-0000-4000-8000-000000000001','REPAYMENT_SUBMITTED','a1000000-0000-4000-8000-000000000001');
update claimed set jobs=public.claim_push_work(false,50);
select public.finish_push_work((select (jobs->0->>'id')::uuid from claimed),(select (jobs->0->>'lease_id')::uuid from claimed),'retry',null,'ProviderUnavailable');
select is((select status from private.push_deliveries where event_id='a5000000-0000-4000-8000-000000000004'),'pending','Temporary send failure returns work to queue');
select is(jsonb_array_length(public.claim_push_work(false,50)),0,'Retry observes backoff');
update private.push_deliveries set available_at=now()-interval '1 second' where event_id='a5000000-0000-4000-8000-000000000004';
update claimed set jobs=public.claim_push_work(false,50);
select public.finish_push_work((select (jobs->0->>'id')::uuid from claimed),(select (jobs->0->>'lease_id')::uuid from claimed),'accepted','rate-ticket');
update private.push_deliveries set available_at=now()-interval '1 second' where ticket_id='rate-ticket';
update claimed set jobs=public.claim_push_work(true,50);
select public.finish_push_work((select (jobs->0->>'id')::uuid from claimed),(select (jobs->0->>'lease_id')::uuid from claimed),'retry',null,'MessageRateExceeded');
select is((select status from private.push_deliveries where event_id='a5000000-0000-4000-8000-000000000004'),'pending','Explicit transient receipt retries delivery');
select is((select ticket_id from private.push_deliveries where event_id='a5000000-0000-4000-8000-000000000004'),null::text,'Retry does not poll the old failed ticket');
update private.push_deliveries set available_at=now()-interval '1 second' where event_id='a5000000-0000-4000-8000-000000000004';
update claimed set jobs=public.claim_push_work(false,50);
select public.finish_push_work((select (jobs->0->>'id')::uuid from claimed),(select (jobs->0->>'lease_id')::uuid from claimed),'failed',null,'DeviceNotRegistered');
select ok(not (select enabled from private.push_devices where id='a4000000-0000-4000-8000-000000000002'),'Invalid provider token disables device');

set local role authenticated;
select public.unregister_push_device('a4000000-0000-4000-8000-000000000002',repeat('b',64));
reset role;
select ok(not (select enabled from private.push_devices where id='a4000000-0000-4000-8000-000000000002'),'Logout disables device');
select ok(not (select bool_or(private.push_delivery_valid(j,'2099-10-03 02:00:00Z')) from private.push_deliveries j where kind='DUE_TODAY'),'Logout invalidates old queued work');
set local role authenticated;
set local request.jwt.claims='{"sub":"a1000000-0000-4000-8000-000000000001","session_id":"a2000000-0000-4000-8000-000000000001"}';
select public.register_push_device('a4000000-0000-4000-8000-000000000002',repeat('b',64),'ExpoPushToken[fixtureB]','android','Asia/Ho_Chi_Minh','vi');
reset role;
select is((select user_id from private.push_devices where id='a4000000-0000-4000-8000-000000000002'),'a1000000-0000-4000-8000-000000000001'::uuid,'Same installation can bind to new account with its secret');
select ok(not (select bool_or(private.push_delivery_valid(j,'2099-10-03 02:00:00Z')) from private.push_deliveries j where kind='DUE_TODAY'),'Account rebind cannot receive previous account work');

select * from finish();
rollback;
