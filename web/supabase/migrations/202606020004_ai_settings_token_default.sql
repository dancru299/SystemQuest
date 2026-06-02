-- Tang gioi han output token de tranh JSON quest bi cat cut (truncation) khi import plan.
-- Row seed truoc day mac dinh max_tokens = 4000, khong du cho mot lo trinh nhieu ngay.
alter table public.system_ai_settings
  alter column max_tokens set default 8000;

-- Nang gia tri cho row hien co neu van con o muc thap gay truncation.
update public.system_ai_settings
set max_tokens = 8000
where max_tokens < 8000;

notify pgrst, 'reload schema';
