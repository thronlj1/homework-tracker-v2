-- 当 homework_records 的 id 序列落后于表中 MAX(id) 时，INSERT 会报
-- duplicate key on homework_records_pkey (Key (id)=(n) already exists)
-- 执行一次以将序列拨到当前最大 id（在 Supabase SQL 编辑器中运行）

SELECT setval(
  pg_get_serial_sequence('public.homework_records', 'id'),
  COALESCE((SELECT MAX(id) FROM public.homework_records), 1),
  true
);
