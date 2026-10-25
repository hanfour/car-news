-- 套用 migration 後的自我檢查。不會修改任何資料：
-- 每個測試都在子交易裡執行，結束時一律回滾，連「不小心成功」的寫入也會被撤銷。
-- 在 Supabase SQL Editor 貼上整份執行，看最後的結果表；ok = false 的列需要處理。

create temp table _t(name text, expected text, actual text);

create function pg_temp._try(p_name text, p_role text, p_sub text, p_sql text, p_expected text)
returns void language plpgsql as $f$
declare
  r text;
begin
  begin
    perform set_config('request.jwt.claims', '', true);
    execute format('set local role %I', p_role);
    if p_sub is not null then
      perform set_config('request.jwt.claims',
        json_build_object('sub', p_sub, 'role', p_role)::text, true);
    end if;
    execute p_sql;
    raise exception 'ROLLBACK_MARKER' using errcode = 'P0001';
  exception when others then
    if sqlerrm = 'ROLLBACK_MARKER' then
      r := 'allowed';
    else
      r := case sqlstate
             when '42501' then 'denied'
             when '23503' then 'passed-policy'
             else 'error:' || sqlstate
           end;
    end if;
  end;
  reset role;
  insert into _t values (p_name, p_expected, r);
end
$f$;

-- 1. 匿名不得讀取後台專用表
select pg_temp._try('anon 讀 ' || t, 'anon', null, format('select 1 from public.%I limit 1', t), 'denied')
from unnest(array['cron_logs','raw_articles','meta_credentials','ai_usage_logs',
                  'share_events','image_audit','style_configs','daily_topic_locks']) as t;
select pg_temp._try('會員讀 meta_credentials', 'authenticated', '00000000-0000-0000-0000-0000000000aa',
  'select 1 from public.meta_credentials limit 1', 'denied');

-- 2. 文章表：公開可讀，匿名與會員不得寫入（WHERE false 不會動到任何列）
select pg_temp._try('anon 讀 generated_articles', 'anon', null,
  'select 1 from public.generated_articles limit 1', 'allowed');
select pg_temp._try('anon 改 generated_articles', 'anon', null,
  'update public.generated_articles set title_zh = title_zh where false', 'denied');
select pg_temp._try('anon 刪 generated_articles', 'anon', null,
  'delete from public.generated_articles where false', 'denied');
select pg_temp._try('會員改 generated_articles', 'authenticated', '00000000-0000-0000-0000-0000000000aa',
  'update public.generated_articles set title_zh = title_zh where false', 'denied');

-- 3. 私訊：查詢不再因 policy 遞迴而報錯
select pg_temp._try('會員讀 messages', 'authenticated', '00000000-0000-0000-0000-0000000000aa',
  'select 1 from public.messages limit 1', 'allowed');
select pg_temp._try('會員讀 conversation_participants', 'authenticated', '00000000-0000-0000-0000-0000000000aa',
  'select 1 from public.conversation_participants limit 1', 'allowed');
select pg_temp._try('非參與者不能在對話中發訊息', 'authenticated', '00000000-0000-0000-0000-0000000000aa',
  'insert into public.messages(conversation_id, sender_id, content) values (gen_random_uuid(), ''00000000-0000-0000-0000-0000000000aa'', ''x'')',
  'denied');

-- 4. 車友會：不能自封 owner；一般加入的 policy 仍放行（會在外鍵檢查才失敗，代表 policy 通過）
select pg_temp._try('會員自封 owner', 'authenticated', '00000000-0000-0000-0000-0000000000aa',
  'insert into public.car_club_members(club_id, user_id, role, status) values ((select id from public.car_clubs where is_public limit 1), ''00000000-0000-0000-0000-0000000000aa'', ''owner'', ''active'')',
  'denied')
where exists (select 1 from public.car_clubs where is_public);
select pg_temp._try('會員以 member 加入公開車友會', 'authenticated', '00000000-0000-0000-0000-0000000000aa',
  'insert into public.car_club_members(club_id, user_id, role, status) values ((select id from public.car_clubs where is_public limit 1), ''00000000-0000-0000-0000-0000000000aa'', ''member'', ''active'')',
  'passed-policy')
where exists (select 1 from public.car_clubs where is_public);
insert into _t select '車友會加入測試略過：目前沒有公開車友會可用', 'n/a', 'n/a'
where not exists (select 1 from public.car_clubs where is_public);

-- 5. 會員不能把自己設為 admin
select pg_temp._try('會員新增 is_admin=true 的 profile', 'authenticated', '00000000-0000-0000-0000-0000000000aa',
  'insert into public.profiles(id, is_admin) values (''00000000-0000-0000-0000-0000000000aa'', true)', 'denied');

-- 6. 設定本身（直接查系統目錄）
insert into _t
select 'profiles 的 is_admin 防護 trigger 存在', 'true',
       exists (select 1 from pg_trigger where tgrelid = 'public.profiles'::regclass
               and tgname = 'trg_prevent_is_admin_self_escalation' and not tgisinternal)::text;
insert into _t
select 'car_club_members 的 UPDATE policy 只在同一個車友會內生效', 'true',
       exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'car_club_members'
               and cmd = 'UPDATE' and qual like '%is_club_manager%')::text;
insert into _t
select 'notifications.type 允許 direct_message 與 club_invitation', 'true',
       exists (select 1 from pg_constraint where conrelid = 'public.notifications'::regclass and contype = 'c'
               and pg_get_constraintdef(oid) like '%direct_message%'
               and pg_get_constraintdef(oid) like '%club_invitation%')::text;
insert into _t
select '沒有任何 policy 依賴 user_metadata', 'true',
       (not exists (select 1 from pg_policies where schemaname = 'public'
                    and (coalesce(qual, '') ilike '%user_metadata%' or coalesce(with_check, '') ilike '%user_metadata%')))::text;
insert into _t
select '計數函式皆為 SECURITY DEFINER', 'true',
       (not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
                    and p.proname in ('update_article_comments_count','update_article_favorites_count',
                                      'update_article_likes_count','update_article_share_count',
                                      'increment_share_count','update_comment_likes_count')
                    and not p.prosecdef))::text;
insert into _t
select '所有 public 資料表都已啟用 RLS', 'true',
       (not exists (select 1 from pg_class c where c.relnamespace = 'public'::regnamespace
                    and c.relkind = 'r' and not c.relrowsecurity))::text;

select name, expected, actual, (expected = actual) as ok
from _t
order by ok, name;
