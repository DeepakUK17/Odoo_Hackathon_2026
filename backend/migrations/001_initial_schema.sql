-- AssetFlow Database Migration
-- Run: psql $DATABASE_URL -f migrations/001_initial_schema.sql

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- 1. ORGANIZATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. DEPARTMENTS (hierarchical)
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  parent_dept_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. EMPLOYEES / USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dept_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'employee' CHECK (role IN ('admin', 'asset_manager', 'dept_head', 'employee')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  avatar_url TEXT,
  phone VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add head_employee_id FK after employees table is created
ALTER TABLE departments ADD COLUMN IF NOT EXISTS head_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;

-- ============================================================
-- 4. ASSET CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_categories (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  icon VARCHAR(50) DEFAULT 'box',
  color VARCHAR(20) DEFAULT '#6C63FF',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. ASSETS (core table)
-- ============================================================
CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tag VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category_id INTEGER REFERENCES asset_categories(id) ON DELETE SET NULL,
  serial_number VARCHAR(255),
  model VARCHAR(255),
  manufacturer VARCHAR(255),
  purchase_date DATE,
  purchase_cost DECIMAL(12,2),
  warranty_start DATE,
  warranty_end DATE,
  location VARCHAR(255),
  dept_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'available'
    CHECK (status IN ('available', 'allocated', 'maintenance', 'retired', 'lost', 'reserved')),
  condition VARCHAR(30) DEFAULT 'good'
    CHECK (condition IN ('excellent', 'good', 'fair', 'poor')),
  health_score INTEGER DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
  notes TEXT,
  qr_code_data TEXT,
  created_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_org ON assets(org_id);
CREATE INDEX IF NOT EXISTS idx_assets_tag ON assets(tag);

-- ============================================================
-- 6. ALLOCATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS allocations (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  dept_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  allocated_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  allocated_at TIMESTAMPTZ DEFAULT NOW(),
  expected_return DATE,
  returned_at TIMESTAMPTZ,
  return_condition VARCHAR(30),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'returned'))
);

CREATE INDEX IF NOT EXISTS idx_allocations_asset ON allocations(asset_id);
CREATE INDEX IF NOT EXISTS idx_allocations_employee ON allocations(employee_id);
CREATE INDEX IF NOT EXISTS idx_allocations_status ON allocations(status);

-- ============================================================
-- 7. TRANSFER REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS transfer_requests (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  from_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  to_employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  requested_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================
-- 8. RESOURCES (bookable: rooms, vehicles, projectors)
-- ============================================================
CREATE TABLE IF NOT EXISTS resources (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) DEFAULT 'room' CHECK (type IN ('room', 'vehicle', 'equipment', 'other')),
  location VARCHAR(255),
  capacity INTEGER,
  description TEXT,
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'unavailable', 'maintenance')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. BOOKINGS (with overlap constraint)
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title VARCHAR(255),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  attendees INTEGER DEFAULT 1,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_booking_times CHECK (end_time > start_time),
  EXCLUDE USING GIST (
    resource_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  ) WHERE (status = 'confirmed')
);

CREATE INDEX IF NOT EXISTS idx_bookings_resource ON bookings(resource_id);
CREATE INDEX IF NOT EXISTS idx_bookings_employee ON bookings(employee_id);

-- ============================================================
-- 10. MAINTENANCE REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  raised_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  assigned_to INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(30) DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'assigned', 'in_progress', 'resolved', 'cancelled')),
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON maintenance_requests(asset_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_requests(status);

-- ============================================================
-- 11. AUDITS
-- ============================================================
CREATE TABLE IF NOT EXISTS audits (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dept_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'cancelled')),
  created_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 12. AUDIT ITEMS (per-asset verification)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_items (
  id SERIAL PRIMARY KEY,
  audit_id INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  expected_location VARCHAR(255),
  actual_location VARCHAR(255),
  verification_status VARCHAR(20) DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'missing', 'damaged')),
  notes TEXT,
  verified_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ
);

-- ============================================================
-- 13. ASSET DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_documents (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  doc_type VARCHAR(50) DEFAULT 'other'
    CHECK (doc_type IN ('invoice', 'warranty', 'manual', 'image', 'other')),
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 14. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  recipient_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  title VARCHAR(255) NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- ============================================================
-- 15. ACTIVITY LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  description TEXT NOT NULL,
  metadata JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_org ON activity_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_actor ON activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);

-- ============================================================
-- TRIGGERS: auto-update assets.updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_maintenance_updated_at ON maintenance_requests;
CREATE TRIGGER update_maintenance_updated_at
  BEFORE UPDATE ON maintenance_requests
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================
-- FULL-TEXT SEARCH INDEX on assets
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_assets_fts ON assets
  USING GIN(to_tsvector('english', coalesce(name,'') || ' ' || coalesce(tag,'') || ' ' || coalesce(serial_number,'') || ' ' || coalesce(location,'')));

SELECT 'Migration 001 completed successfully' AS status;
