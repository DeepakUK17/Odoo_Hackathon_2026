-- Performance indexes for AssetFlow
-- Run this once against your Neon DB

-- Assets: most-queried table (org_id + status filter used on every page)
CREATE INDEX IF NOT EXISTS idx_assets_org_id ON assets(org_id);
CREATE INDEX IF NOT EXISTS idx_assets_org_status ON assets(org_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_dept ON assets(dept_id);

-- Allocations: queried on dashboard overdue + employee pages
CREATE INDEX IF NOT EXISTS idx_allocations_status ON allocations(status);
CREATE INDEX IF NOT EXISTS idx_allocations_employee ON allocations(employee_id);
CREATE INDEX IF NOT EXISTS idx_allocations_asset ON allocations(asset_id);

-- Maintenance: filtered by status on kanban (no org_id column - joins through assets)
CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON maintenance_requests(asset_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_assigned ON maintenance_requests(assigned_to);

-- Employees: login lookup by email
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(org_id);

-- Notifications: unread count query (uses recipient_id not employee_id)
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_id, is_read) WHERE is_read = false;

-- Activity logs: recent feed
CREATE INDEX IF NOT EXISTS idx_activity_logs_org ON activity_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);

-- Bookings: time-range queries
CREATE INDEX IF NOT EXISTS idx_bookings_resource ON bookings(resource_id);
CREATE INDEX IF NOT EXISTS idx_bookings_time ON bookings(start_time, end_time);

-- Transfer requests: pending filter (no org_id - joins through assets)
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_transfers_asset ON transfer_requests(asset_id);

-- Audits
CREATE INDEX IF NOT EXISTS idx_audits_org ON audits(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_items_asset ON audit_items(asset_id);

ANALYZE;
