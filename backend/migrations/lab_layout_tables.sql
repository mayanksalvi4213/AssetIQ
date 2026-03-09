-- =========================================
-- LAB LAYOUT BLUEPRINT TABLES
-- Migration: Create tables for lab layout
-- blueprints (station zone planning without
-- actual device assignment)
-- =========================================

-- -------------------------
-- STATION TYPES
-- Defines the kinds of stations a lab can have
-- -------------------------
CREATE TABLE IF NOT EXISTS public.station_types (
    station_type_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(100) NOT NULL,
    icon VARCHAR(10) DEFAULT '📦',
    color VARCHAR(20) DEFAULT '#3b82f6',
    description TEXT,
    -- Which equipment_types (device types) are allowed at this station
    allowed_device_types INTEGER[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT now()
);

-- Seed default station types
INSERT INTO public.station_types (name, label, icon, color, description, allowed_device_types)
VALUES
    ('computer',    'Computer Station', '🖥️', '#3b82f6', 'Desktop workstation: PC, Monitor, Keyboard, Mouse, etc.', '{2,12,13,14}'),
    ('laptop',      'Laptop Station',   '💻', '#8b5cf6', 'Laptop workstation with peripherals',                     '{1,12,13,14}'),
    ('ac',          'AC Unit',          '❄️', '#06b6d4', 'Air conditioning unit placement',                          '{3}'),
    ('projector',   'Projector',        '📽️', '#f59e0b', 'Projector or Smart Board station',                         '{4,5}'),
    ('network',     'Network Equipment','🔌', '#10b981', 'Router, Switch, and networking gear',                      '{9,10}'),
    ('printer',     'Printer/Scanner',  '🖨️', '#ec4899', 'Printer or scanner station',                               '{6,7}'),
    ('ups',         'UPS',              '🔋', '#ef4444', 'Uninterruptible power supply',                             '{8}'),
    ('server',      'Server Rack',      '🖥️', '#6366f1', 'Server and related equipment',                             '{11}'),
    ('teacher',     'Teacher Desk',     '👨‍🏫', '#f97316', 'Teacher/instructor station with PC or Laptop',             '{1,2,12,13,14}'),
    ('empty',       'Empty',            '⬜', '#6b7280', 'Empty/unassigned cell',                                    '{}'),
    ('passage',     'Passage/Aisle',    '🚶', '#374151', 'Walkway or aisle - no equipment',                          '{}')
ON CONFLICT (name) DO NOTHING;

-- -------------------------
-- LAB LAYOUT TEMPLATES
-- A blueprint for how a lab is arranged
-- -------------------------
CREATE TABLE IF NOT EXISTS public.lab_layout_templates (
    layout_id SERIAL PRIMARY KEY,
    layout_name VARCHAR(100) NOT NULL,
    description TEXT,
    rows INTEGER NOT NULL DEFAULT 6,
    columns INTEGER NOT NULL DEFAULT 6,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- -------------------------
-- LAB LAYOUT CELLS
-- Each cell in the blueprint grid
-- -------------------------
CREATE TABLE IF NOT EXISTS public.lab_layout_cells (
    cell_id SERIAL PRIMARY KEY,
    layout_id INTEGER NOT NULL REFERENCES lab_layout_templates(layout_id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    column_number INTEGER NOT NULL,
    station_type_id INTEGER REFERENCES station_types(station_type_id),
    station_label VARCHAR(100),   -- optional custom label like "PC-1", "AC-North"
    os_windows BOOLEAN DEFAULT FALSE,
    os_linux BOOLEAN DEFAULT FALSE,
    os_other BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT now(),
    CONSTRAINT unique_layout_cell UNIQUE (layout_id, row_number, column_number)
);

-- -------------------------
-- OPTIONAL: Link labs to layout templates
-- Adds layout_id column to existing labs table
-- -------------------------
ALTER TABLE public.labs ADD COLUMN IF NOT EXISTS layout_id INTEGER REFERENCES lab_layout_templates(layout_id);
