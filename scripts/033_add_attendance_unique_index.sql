-- 033_add_attendance_unique_index.sql
-- Add a unique index to ensure there is at most one attendance record
-- per (user_id, patient_id, session_date). This allows UPSERTs that
-- use ON CONFLICT (user_id,patient_id,session_date) to work.

-- 1) Check for existing duplicates. If this returns rows you must
--    resolve them before creating the unique index.
SELECT user_id, patient_id, session_date, count(*) as cnt
FROM public.attendance
GROUP BY user_id, patient_id, session_date
HAVING count(*) > 1;

-- 2) If no duplicates are returned, create the unique index.
--    CREATE UNIQUE INDEX IF NOT EXISTS is preferred because it won't
--    error if the index already exists.
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_user_patient_date_unique
    ON public.attendance (user_id, patient_id, session_date);

-- 3) If you do have duplicates and want an example to deduplicate by
--    keeping the first row (lowest id) and deleting the rest, you can
--    run the following - but review carefully before executing in prod.
--
-- WITH duplicates AS (
--   SELECT id,
--          ROW_NUMBER() OVER (PARTITION BY user_id, patient_id, session_date ORDER BY id) rn
--   FROM public.attendance
-- )
-- DELETE FROM public.attendance WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- After cleaning duplicates, re-run the CREATE UNIQUE INDEX statement above.

-- Notes:
-- - Creating a unique index will fail if duplicate rows exist.
-- - It's intentionally conservative: we don't attempt to delete duplicates
--   automatically in this script to avoid data loss. Inspect duplicates
--   and choose the correct resolution strategy for your data.
