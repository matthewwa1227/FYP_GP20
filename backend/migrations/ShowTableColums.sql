-- Get ALL tables in your Supabase project
SELECT *
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'students' 
ORDER BY table_name;
