-- Direct ALTER TABLE command to add segment_count column
ALTER TABLE public.zoom_transcripts ADD COLUMN IF NOT EXISTS segment_count integer NOT NULL DEFAULT 0; 