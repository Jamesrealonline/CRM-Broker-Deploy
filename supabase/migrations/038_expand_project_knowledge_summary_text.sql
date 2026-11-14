-- MIGRATION 038: NÂNG GIỚI HẠN TÓM TẮT DỰ ÁN LÊN 30.000 KÝ TỰ (TEXT)
ALTER TABLE public.project_knowledge ALTER COLUMN summary_text TYPE TEXT;
NOTIFY pgrst, 'reload schema';
