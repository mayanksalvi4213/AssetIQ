-- Add station_qr_value column to lab_stations table
-- This column stores a QR-encoded string containing info about all devices at a station
ALTER TABLE public.lab_stations ADD COLUMN IF NOT EXISTS station_qr_value TEXT;
