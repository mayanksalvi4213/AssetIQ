ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS dest_cell_id INTEGER;

-- Optional per-device destination mapping (JSON string)
-- Example: {"101": 5001, "102": 5002}
ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS device_dest_map TEXT;

ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS transfer_type VARCHAR(20) DEFAULT 'individual';
ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS station_ids TEXT;
