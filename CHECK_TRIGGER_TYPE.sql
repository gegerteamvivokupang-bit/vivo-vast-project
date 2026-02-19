-- CEK DETAIL TRIGGER CONVERSIONS SEKARANG
-- Untuk tahu apakah FOR EACH ROW atau FOR EACH STATEMENT

SELECT 
    tgname as "Trigger Name",
    pg_get_triggerdef(oid) as "Full Definition"
FROM pg_trigger
WHERE tgrelid = 'conversions'::regclass
  AND NOT tgisinternal;
