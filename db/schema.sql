-- SQL Migration Script for Supabase PostgreSQL
-- Application: Nail Mi Tuyet Tran - Daily OCR & Financial Telegram Bot

-- 1. Table: staff (Danh sách nhân viên)
CREATE TABLE IF NOT EXISTS staff (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed mồi mặc định danh sách nhân viên của tiệm
INSERT INTO staff (name, is_active) VALUES
  ('bà chủ Tuyết Trần', true),
  ('Quỳnh Anh', true),
  ('Huệ', true),
  ('chị Cúc', true),
  ('Thảo', true),
  ('Nhi', true)
ON CONFLICT (name) DO NOTHING;

-- 2. Table: admins (Danh sách Telegram User ID của Admin)
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    telegram_id VARCHAR(100) UNIQUE NOT NULL,
    note VARCHAR(255) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table: commission_config (Cấu hình tỉ lệ % hoa hồng doanh thu)
CREATE TABLE IF NOT EXISTS commission_config (
    id INT PRIMARY KEY DEFAULT 1,
    goi_mong_percent INT NOT NULL DEFAULT 10,
    mi_percent INT NOT NULL DEFAULT 30,
    ngoai_gio_percent INT NOT NULL DEFAULT 50,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default commission config if not exists
INSERT INTO commission_config (id, goi_mong_percent, mi_percent, ngoai_gio_percent)
VALUES (1, 10, 30, 50)
ON CONFLICT (id) DO NOTHING;

-- 4. Table: reports (Mỗi lượt gửi báo cáo)
CREATE TABLE IF NOT EXISTS reports (
    id VARCHAR(100) PRIMARY KEY, -- REP_timestamp_random
    report_date DATE NOT NULL,
    user_info JSONB,
    input_type VARCHAR(50) DEFAULT 'text',
    raw_data JSONB,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'overwritten', 'deleted'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_report_date ON reports(report_date);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- 5. Table: report_staff_revenue (Doanh số & công của nhân viên từng lượt báo cáo)
CREATE TABLE IF NOT EXISTS report_staff_revenue (
    id SERIAL PRIMARY KEY,
    report_id VARCHAR(100) REFERENCES reports(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    staff_name VARCHAR(255) NOT NULL,
    is_unknown_staff BOOLEAN DEFAULT FALSE,
    attendance_description VARCHAR(255) DEFAULT 'Làm cả ngày',
    attendance_score NUMERIC(5, 2) DEFAULT 1.0,
    goi_mong NUMERIC(15, 2) DEFAULT 0,
    mi NUMERIC(15, 2) DEFAULT 0,
    ngoai_gio NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_revenue_date ON report_staff_revenue(report_date);
CREATE INDEX IF NOT EXISTS idx_staff_revenue_report_id ON report_staff_revenue(report_id);

-- 6. Table: report_expenses (Khoản chi tiêu trong từng lượt báo cáo)
CREATE TABLE IF NOT EXISTS report_expenses (
    id SERIAL PRIMARY KEY,
    report_id VARCHAR(100) REFERENCES reports(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    category VARCHAR(255) DEFAULT 'Chi phí',
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON report_expenses(report_date);
CREATE INDEX IF NOT EXISTS idx_expenses_report_id ON report_expenses(report_id);

-- 7. Table: installments (Danh sách hợp đồng trả góp thiết bị dài hạn)
CREATE TABLE IF NOT EXISTS installments (
    id VARCHAR(100) PRIMARY KEY, -- INS_timestamp_random
    item_name VARCHAR(255) NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL,
    months INT NOT NULL,
    monthly_amount NUMERIC(15, 2) NOT NULL,
    purchase_year_month VARCHAR(7) NOT NULL, -- YYYY-MM
    start_year_month VARCHAR(7) NOT NULL,    -- YYYY-MM
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_installments_start_ym ON installments(start_year_month);

-- 8. Table: ocr_logs (Lưu vết lịch sử tất cả các lần gửi ảnh/tin nhắn OCR)
CREATE TABLE IF NOT EXISTS ocr_logs (
    id SERIAL PRIMARY KEY,
    log_id VARCHAR(100) NOT NULL,
    report_date DATE,
    input_type VARCHAR(50) DEFAULT 'photo',
    user_info JSONB,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ocr_logs_date ON ocr_logs(report_date);

-- 9. Table: report_backups (Lưu vết sao lưu các phiên bản báo cáo cũ trước khi bị ghi đè hoặc sửa)
CREATE TABLE IF NOT EXISTS report_backups (
    id VARCHAR(100) PRIMARY KEY, -- BAK_timestamp_random
    original_report_id VARCHAR(100) NOT NULL,
    report_date DATE NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- 'overwrite', 'edit', 'delete'
    user_info JSONB,
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_backups_date ON report_backups(report_date);

-- 10. Table: audit_logs (Nhật ký theo dõi mọi hành động thay đổi dữ liệu của bot)
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL, -- 'CREATE', 'OVERWRITE', 'EDIT', 'DELETE', 'RESTORE'
    target_date DATE,
    report_id VARCHAR(100),
    user_info JSONB,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON audit_logs(target_date);


