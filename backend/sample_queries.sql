-- Check transcript data in database
-- This file contains sample queries to diagnose issues with transcript storage

-- View all transcripts with recording info
SELECT 
  t.id as transcript_id,
  t.recording_id,
  r.title as recording_title,
  r.url as recording_url,
  t.segment_count,
  jsonb_array_length(t.transcript_data) as actual_segment_count,
  t.created_at,
  r.transcript_processed
FROM 
  zoom_transcripts t
JOIN 
  zoom_recordings r ON t.recording_id = r.id
ORDER BY 
  t.created_at DESC
LIMIT 20;

-- Check for transcripts with empty or null data
SELECT 
  id as transcript_id,
  recording_id,
  segment_count,
  jsonb_array_length(transcript_data) as actual_segment_count,
  transcript_data IS NULL as is_data_null,
  jsonb_array_length(transcript_data) = 0 as is_data_empty,
  created_at
FROM 
  zoom_transcripts
WHERE
  transcript_data IS NULL
  OR jsonb_array_length(transcript_data) = 0
ORDER BY 
  created_at DESC;

-- View sample of transcript data from a specific transcript
-- Replace transcript_id with the actual ID you want to check
SELECT 
  id as transcript_id,
  jsonb_array_length(transcript_data) as segment_count,
  jsonb_array_elements(transcript_data) as transcript_item
FROM 
  zoom_transcripts
WHERE
  id = 'transcript_id_here'
LIMIT 10;

-- View recordings that are marked as processed but have no transcript
SELECT 
  r.id as recording_id,
  r.title,
  r.url,
  r.transcript_processed,
  r.created_at,
  r.updated_at
FROM 
  zoom_recordings r
LEFT JOIN 
  zoom_transcripts t ON r.id = t.recording_id
WHERE
  r.transcript_processed = true
  AND t.id IS NULL
ORDER BY 
  r.created_at DESC; 