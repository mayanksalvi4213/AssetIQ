-- Create bills table for storing invoice information
CREATE TABLE IF NOT EXISTS bills (
    id VARCHAR(50) PRIMARY KEY,
    bill_number VARCHAR(100),
    vendor_name VARCHAR(200),
    vendor_gstin VARCHAR(15),
    vendor_address TEXT,
    vendor_phone VARCHAR(20),
    vendor_email VARCHAR(100),
    bill_date VARCHAR(20),
    due_date VARCHAR(20),
    total_amount DECIMAL(15,2),
    tax_amount DECIMAL(15,2),
    discount DECIMAL(15,2),
    warranty_info TEXT,
    raw_text TEXT,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create assets table for storing individual asset information
CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    asset_id VARCHAR(20) UNIQUE NOT NULL,  -- Custom ID like COMP001, LAP001
    bill_id VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(100),
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(15,2),
    total_price DECIMAL(15,2),
    warranty_period VARCHAR(50),
    qr_code_data TEXT,  -- Base64 encoded QR code image
    status VARCHAR(20) DEFAULT 'active',  -- active, disposed, damaged
    location VARCHAR(200),
    assigned_to VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at);
CREATE INDEX IF NOT EXISTS idx_assets_bill_id ON assets(bill_id);
CREATE INDEX IF NOT EXISTS idx_assets_asset_id ON assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);

-- Add update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
DROP TRIGGER IF EXISTS update_bills_updated_at ON bills;
CREATE TRIGGER update_bills_updated_at 
    BEFORE UPDATE ON bills 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
CREATE TRIGGER update_assets_updated_at 
    BEFORE UPDATE ON assets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();