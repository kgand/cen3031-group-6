-- Add segment_count column to zoom_transcripts table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'zoom_transcripts' AND column_name = 'segment_count'
    ) THEN
        ALTER TABLE zoom_transcripts ADD COLUMN segment_count integer NOT NULL DEFAULT 0;
        RAISE NOTICE 'Added segment_count column to zoom_transcripts table';
    ELSE
        RAISE NOTICE 'segment_count column already exists in zoom_transcripts table';
    END IF;
END
$$; 