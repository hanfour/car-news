-- generated_articles.ai_model：記錄這篇文章實際是由哪個模型寫出來的
--
-- 動機：
-- - 品質閘門依模型自己填的信心分數決定要不要發布，不同模型的打分習慣不同。
--   Gemini 額度用盡、改由 Claude 或 OpenAI 寫稿之後，被擋下的比例變高，
--   但資料表沒有欄位能區分每篇是誰寫的，無法直接比較。
-- - 有這一欄之後，就能依模型比較信心分數與發布比例。
--
-- 由 src/app/api/cron/generator/route.ts 寫入，值是實際用到的模型 id，
-- 例：gemini-2.5-flash、claude-sonnet-5-5、gpt-4o。
-- Claude 失敗、改由 OpenAI 寫稿時記的是 gpt-4o，不是 Claude。
-- 舊文章當時沒有記錄，維持 NULL。
--
-- 套用方式：Supabase Dashboard > SQL Editor 貼上整份執行。
-- 可重複執行；只新增欄位，不改動任何既有資料。
--
-- 套用順序：程式對「欄位尚未存在」有容錯，會退回不帶該欄位寫入並記一則警告，
-- 所以先合併程式或先套用本檔，都不會讓產線停擺。
-- 建議先套用本檔，新文章從第一篇起就有記錄。

ALTER TABLE generated_articles
    ADD COLUMN IF NOT EXISTS ai_model TEXT;

COMMENT ON COLUMN generated_articles.ai_model IS
    '實際寫出這篇文章的模型 id，例：gemini-2.5-flash、claude-sonnet-5-5、gpt-4o。舊文章為 NULL。';

-- 讓 PostgREST 立刻認得新欄位
NOTIFY pgrst, 'reload schema';

-- 驗證：應回傳一列
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'generated_articles'
  AND column_name = 'ai_model';
