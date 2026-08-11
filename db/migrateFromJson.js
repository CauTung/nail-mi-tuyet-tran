/**
 * Tool tự động đẩy dữ liệu JSON cũ lên Supabase Database
 * Cách dùng: node db/migrateFromJson.js
 */

const fs = require("fs");
const path = require("path");
const { supabase, isSupabaseConnected } = require("../config/supabase");

const DATA_DIR = path.join(__dirname, "../data");
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const STAFF_FILE = path.join(DATA_DIR, "staff.json");
const ADMINS_FILE = path.join(DATA_DIR, "admins.json");
const INSTALLMENTS_FILE = path.join(DATA_DIR, "installments.json");
const COMMISSION_FILE = path.join(DATA_DIR, "commission_config.json");

async function runMigration() {
  if (!isSupabaseConnected()) {
    console.error("❌ Chưa kết nối Supabase! Hãy điền SUPABASE_URL và SUPABASE_KEY vào .env trước khi chạy migration.");
    process.exit(1);
  }

  console.log("🚀 Bắt đầu quá trình Migration dữ liệu JSON cũ lên Supabase...");

  // 1. Migrate Staff
  if (fs.existsSync(STAFF_FILE)) {
    try {
      const staffList = JSON.parse(fs.readFileSync(STAFF_FILE, "utf-8"));
      const rows = staffList.map(name => ({ name, is_active: true }));
      await supabase.from("staff").upsert(rows, { onConflict: "name" });
      console.log(`✅ Đã migrate ${staffList.length} nhân viên.`);
    } catch (e) {
      console.error("Lỗi migrate staff:", e);
    }
  }

  // 2. Migrate Admins
  if (fs.existsSync(ADMINS_FILE)) {
    try {
      const adminList = JSON.parse(fs.readFileSync(ADMINS_FILE, "utf-8"));
      const rows = adminList.map(telegram_id => ({ telegram_id: String(telegram_id) }));
      await supabase.from("admins").upsert(rows, { onConflict: "telegram_id" });
      console.log(`✅ Đã migrate ${adminList.length} Telegram Admin User ID.`);
    } catch (e) {
      console.error("Lỗi migrate admins:", e);
    }
  }

  // 3. Migrate Commission Config
  if (fs.existsSync(COMMISSION_FILE)) {
    try {
      const config = JSON.parse(fs.readFileSync(COMMISSION_FILE, "utf-8"));
      await supabase.from("commission_config").upsert({
        id: 1,
        goi_mong_percent: config.goi_mong_percent || 10,
        mi_percent: config.mi_percent || 30,
        ngoai_gio_percent: config.ngoai_gio_percent || 50,
        updated_at: new Date().toISOString()
      });
      console.log("✅ Đã migrate cấu hình tỷ lệ hoa hồng %.");
    } catch (e) {
      console.error("Lỗi migrate commission config:", e);
    }
  }

  // 4. Migrate Installments
  if (fs.existsSync(INSTALLMENTS_FILE)) {
    try {
      const installments = JSON.parse(fs.readFileSync(INSTALLMENTS_FILE, "utf-8"));
      if (installments.length > 0) {
        await supabase.from("installments").upsert(installments, { onConflict: "id" });
      }
      console.log(`✅ Đã migrate ${installments.length} hợp đồng trả góp.`);
    } catch (e) {
      console.error("Lỗi migrate installments:", e);
    }
  }

  // 5. Migrate Daily Reports
  if (fs.existsSync(REPORTS_DIR)) {
    let reportCount = 0;
    const months = fs.readdirSync(REPORTS_DIR);

    for (const ym of months) {
      const monthPath = path.join(REPORTS_DIR, ym);
      if (fs.statSync(monthPath).isDirectory()) {
        const files = fs.readdirSync(monthPath).filter(f => f.endsWith(".json"));
        for (const file of files) {
          const filePath = path.join(monthPath, file);
          try {
            const reports = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            for (const r of reports) {
              reportCount++;
              const dateStr = r.date || file.replace(".json", "");

              // Insert main report
              await supabase.from("reports").upsert({
                id: r.id,
                report_date: dateStr,
                user_info: r.user_info || null,
                input_type: r.input_type || "text",
                raw_data: r.parsed_result || null,
                created_at: r.timestamp || new Date().toISOString()
              }, { onConflict: "id" });

              const parsed = r.parsed_result || {};

              // Insert staff revenue details
              if (Array.isArray(parsed.staff_data)) {
                for (const s of parsed.staff_data) {
                  await supabase.from("report_staff_revenue").insert({
                    report_id: r.id,
                    report_date: dateStr,
                    staff_name: s.name,
                    is_unknown_staff: s.is_unknown_staff || false,
                    attendance_description: s.attendance_description || "Làm cả ngày",
                    attendance_score: s.attendance_score !== undefined ? s.attendance_score : 1.0,
                    goi_mong: s.revenue?.goi_mong || 0,
                    mi: s.revenue?.mi || 0,
                    ngoai_gio: s.revenue?.ngoai_gio || 0
                  });
                }
              }

              // Insert expense details
              if (Array.isArray(parsed.expenses_data)) {
                for (const exp of parsed.expenses_data) {
                  await supabase.from("report_expenses").insert({
                    report_id: r.id,
                    report_date: dateStr,
                    category: exp.category || "Chi phí",
                    amount: exp.amount || 0,
                    notes: exp.notes || ""
                  });
                }
              }
            }
          } catch (e) {
            console.error(`Lỗi đọc file ${filePath}:`, e);
          }
        }
      }
    }
    console.log(`✅ Đã migrate tổng cộng ${reportCount} lượt báo cáo daily JSON.`);
  }

  console.log("🎉 Hoàn tất Migration thành công!");
  process.exit(0);
}

runMigration();
