const fs = require("fs");
const path = require("path");
const { supabase, isSupabaseConnected } = require("../../config/supabase");
const installmentRepo = require("./installmentRepository");

const DATA_DIR = path.join(__dirname, "../../data");
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const LOGS_DIR = path.join(DATA_DIR, "logs");

function ensureLocalDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function getDateKeys(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return {
    yearMonth: `${year}-${month}`,
    dateStr: `${year}-${month}-${day}`
  };
}

async function saveReport(reportData, metaInfo = {}, explicitDate = null) {
  ensureLocalDirs();

  const now = new Date();
  let targetDate = explicitDate || reportData.report_date;

  if (targetDate && /^\d{4}-\d{1,2}-\d{1,2}$/.test(targetDate)) {
    const parts = targetDate.split("-");
    const y = parts[0];
    const m = parts[1].padStart(2, "0");
    const d = parts[2].padStart(2, "0");
    targetDate = `${y}-${m}-${d}`;
  }

  if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    const { dateStr } = getDateKeys(now);
    targetDate = dateStr;
  } else {
    const parts = targetDate.split("-");
    if (parseInt(parts[0], 10) < 2026) {
      targetDate = `2026-${parts[1]}-${parts[2]}`;
    }
  }

  const [year, month] = targetDate.split("-");
  const yearMonth = `${year}-${month}`;
  const reportId = `REP_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // Nếu chọn chế độ thay thế (replace_all), lưu backup toàn bộ báo cáo cũ của ngày trước khi cập nhật
  if (reportData.replacement_mode === "replace_all") {
    const existingReports = await getDailyReports(targetDate);
    if (existingReports && existingReports.length > 0) {
      const backupId = `BAK_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      if (isSupabaseConnected()) {
        try {
          await supabase.from("report_backups").insert({
            id: backupId,
            original_report_id: existingReports[0]?.id || "BULK",
            report_date: targetDate,
            action_type: "overwrite",
            user_info: metaInfo.userInfo || null,
            snapshot_data: existingReports,
            created_at: now.toISOString()
          });

          // Soft delete bằng cách cập nhật status = 'overwritten'
          await supabase.from("reports")
            .update({ status: "overwritten" })
            .eq("report_date", targetDate)
            .eq("status", "active");
        } catch (e) {
          console.error("❌ Lỗi lưu backup báo cáo trên Supabase:", e);
        }
      }
    }
  }

  const record = {
    id: reportId,
    timestamp: now.toISOString(),
    date: targetDate,
    user_info: metaInfo.userInfo || null,
    input_type: metaInfo.inputType || "text",
    parsed_result: reportData
  };

  // Save Installments if any
  if (Array.isArray(reportData.installments_data) && reportData.installments_data.length > 0) {
    await installmentRepo.saveInstallments(reportData.installments_data, yearMonth);
  }

  let dbSaved = false;
  let dbError = null;

  // Supabase saving
  if (isSupabaseConnected()) {
    try {
      const { error: insErr } = await supabase.from("reports").insert({
        id: reportId,
        report_date: targetDate,
        user_info: metaInfo.userInfo || null,
        input_type: metaInfo.inputType || "text",
        raw_data: reportData,
        created_at: now.toISOString(),
        status: "active"
      });

      if (insErr) {
        dbError = insErr.message;
        console.error(`❌ [SUPABASE ERROR] Lỗi ghi báo cáo ngày ${targetDate}: ${insErr.message}`);
      } else {
        dbSaved = true;
        console.log(`✅ [SUPABASE SUCCESS] Đã lưu thành công báo cáo vào Supabase Database (ID: ${reportId}, Ngày: ${targetDate})`);
      }

      // Ghi log lịch sử ocr_logs
      await supabase.from("ocr_logs").insert({
        log_id: reportId,
        report_date: targetDate,
        input_type: metaInfo.inputType || "text",
        user_info: metaInfo.userInfo || null,
        raw_data: reportData,
        created_at: now.toISOString()
      });

      // Staff revenue records
      if (Array.isArray(reportData.staff_data) && reportData.staff_data.length > 0) {
        const staffRows = reportData.staff_data.map(s => ({
          report_id: reportId,
          report_date: targetDate,
          staff_name: s.name,
          is_unknown_staff: s.is_unknown_staff || false,
          attendance_description: s.attendance_description || "Làm cả ngày",
          attendance_score: s.attendance_score !== undefined ? s.attendance_score : 1.0,
          late_minutes: Number(s.late_minutes) || 0,
          goi_mong: s.revenue?.goi_mong || 0,
          mi: s.revenue?.mi || 0,
          ngoai_gio: s.revenue?.ngoai_gio || 0
        }));
        await supabase.from("report_staff_revenue").insert(staffRows);
      }

      // Expense records
      if (Array.isArray(reportData.expenses_data) && reportData.expenses_data.length > 0) {
        const expRows = reportData.expenses_data.map(exp => ({
          report_id: reportId,
          report_date: targetDate,
          category: exp.category || "Chi phí",
          amount: exp.amount || 0,
          notes: exp.notes || ""
        }));
        await supabase.from("report_expenses").insert(expRows);
      }
    } catch (err) {
      dbError = err.message;
      console.error("❌ [SUPABASE EXCEPTION] Lỗi ngoại lệ khi ghi báo cáo vào Supabase:", err.message);
    }
  } else {
    console.warn("⚠️ [STORAGE WARN] Chưa kết nối Supabase CSDL.");
  }

  return { record, dateStr: targetDate, dbSaved, dbError };
}

async function deleteReport(reportId) {
  if (isSupabaseConnected()) {
    try {
      const { error } = await supabase.from("reports").delete().eq("id", reportId);
      await supabase.from("report_staff_revenue").delete().eq("report_id", reportId).catch(() => {});
      await supabase.from("report_expenses").delete().eq("report_id", reportId).catch(() => {});
      return !error;
    } catch (err) {
      console.error("Lỗi xóa báo cáo trên Supabase:", err);
      return false;
    }
  }
  return false;
}

async function updateStaffRevenue(reportId, staffName, goiMong, mi, ngoaiGio) {
  if (isSupabaseConnected()) {
    try {
      const { data: staffRow } = await supabase
        .from("report_staff_revenue")
        .select("*")
        .eq("report_id", reportId)
        .ilike("staff_name", staffName)
        .maybeSingle();

      if (staffRow) {
        const updateData = {};
        if (goiMong !== undefined && goiMong !== null) updateData.goi_mong = Number(goiMong);
        if (mi !== undefined && mi !== null) updateData.mi = Number(mi);
        if (ngoaiGio !== undefined && ngoaiGio !== null) updateData.ngoai_gio = Number(ngoaiGio);
        await supabase.from("report_staff_revenue").update(updateData).eq("id", staffRow.id);
      }

      const { data: repRow } = await supabase
        .from("reports")
        .select("raw_data")
        .eq("id", reportId)
        .maybeSingle();

      if (repRow && repRow.raw_data) {
        const rawData = { ...repRow.raw_data };
        if (!Array.isArray(rawData.staff_data)) rawData.staff_data = [];
        let staffObj = rawData.staff_data.find(s => (s.name || "").toLowerCase() === staffName.toLowerCase());
        if (!staffObj) {
          staffObj = { name: staffName, revenue: { goi_mong: 0, mi: 0, ngoai_gio: 0 } };
          rawData.staff_data.push(staffObj);
        }
        if (!staffObj.revenue || typeof staffObj.revenue !== "object") {
          staffObj.revenue = {};
        }
        if (goiMong !== undefined && goiMong !== null) {
          staffObj.revenue.goi_mong = Number(goiMong);
          staffObj.goi_mong = Number(goiMong);
        }
        if (mi !== undefined && mi !== null) {
          staffObj.revenue.mi = Number(mi);
          staffObj.mi = Number(mi);
        }
        if (ngoaiGio !== undefined && ngoaiGio !== null) {
          staffObj.revenue.ngoai_gio = Number(ngoaiGio);
          staffObj.ngoai_gio = Number(ngoaiGio);
        }
        await supabase.from("reports").update({ raw_data: rawData }).eq("id", reportId);
        return { id: reportId, parsed_result: rawData };
      }
    } catch (err) {
      console.error("Lỗi cập nhật doanh số nhân viên Supabase:", err);
    }
  }
  return null;
}

async function updateExpense(reportId, amount, notes) {
  if (isSupabaseConnected()) {
    try {
      await supabase.from("report_expenses").delete().eq("report_id", reportId);
      await supabase.from("report_expenses").insert({
        report_id: reportId,
        category: "Chi phí điều chỉnh",
        amount: Number(amount),
        notes: notes || "Đã điều chỉnh chi tiêu"
      });

      const { data: repRow } = await supabase
        .from("reports")
        .select("raw_data")
        .eq("id", reportId)
        .maybeSingle();

      if (repRow && repRow.raw_data) {
        const rawData = { ...repRow.raw_data };
        rawData.expenses_data = [
          {
            category: "Chi phí điều chỉnh",
            amount: Number(amount),
            notes: notes || "Đã điều chỉnh chi tiêu"
          }
        ];
        await supabase.from("reports").update({ raw_data: rawData }).eq("id", reportId);
        return { id: reportId, parsed_result: rawData };
      }
    } catch (err) {
      console.error("Lỗi cập nhật chi tiêu Supabase:", err);
    }
  }
  return null;
}

async function getDailyReports(dateStr) {
  if (isSupabaseConnected()) {
    try {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("report_date", dateStr)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(`⚠️ [SUPABASE ERROR] Lỗi truy vấn báo cáo ngày ${dateStr}:`, error.message);
        return [];
      } else if (Array.isArray(data)) {
        const activeReports = data.filter(row => !row.status || row.status !== "overwritten");
        console.log(`📊 [SUPABASE] Tìm thấy ${activeReports.length}/${data.length} báo cáo hợp lệ cho ngày ${dateStr}`);
        return activeReports.map(row => ({
          id: row.id,
          date: row.report_date,
          user_info: row.user_info,
          input_type: row.input_type,
          parsed_result: row.raw_data
        }));
      }
    } catch (err) {
      console.error("❌ Lỗi kết nối Supabase khi lấy báo cáo ngày:", err.message);
    }
  }
  return [];
}

async function getMonthlyReportsList(yearMonth) {
  if (isSupabaseConnected()) {
    try {
      const [y, m] = yearMonth.split("-").map(Number);
      const startDate = `${yearMonth}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const endDate = `${yearMonth}-${String(lastDay).padStart(2, "0")}`;

      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .gte("report_date", startDate)
        .lte("report_date", endDate)
        .order("report_date", { ascending: true });

      if (error) {
        console.error(`⚠️ [SUPABASE ERROR] Lỗi truy vấn báo cáo tháng ${yearMonth}:`, error.message);
        return [];
      } else if (Array.isArray(data)) {
        const activeReports = data.filter(row => !row.status || row.status !== "overwritten");
        console.log(`📊 [SUPABASE] Tìm thấy ${activeReports.length}/${data.length} báo cáo hợp lệ cho tháng ${yearMonth}`);
        return activeReports.map(row => ({
          id: row.id,
          date: row.report_date,
          user_info: row.user_info,
          input_type: row.input_type,
          parsed_result: row.raw_data
        }));
      }
    } catch (err) {
      console.error("❌ Lỗi kết nối Supabase khi lấy báo cáo tháng:", err.message);
    }
  }
  return [];
}

function savePhotoLog(imageBuffer, parsedResult, errorMsg = null) {
  ensureLocalDirs();
  const timestamp = Date.now();
  const dateFolder = new Date().toISOString().substring(0, 10);
  const targetDir = path.join(LOGS_DIR, dateFolder);

  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const baseName = `ocr_${timestamp}`;
  if (imageBuffer) {
    const imgPath = path.join(targetDir, `${baseName}.jpg`);
    fs.writeFileSync(imgPath, imageBuffer);
  }

  const logMeta = {
    timestamp: new Date().toISOString(),
    status: errorMsg ? "error" : "success",
    error: errorMsg || null,
    parsed_result: parsedResult || null
  };

  const jsonPath = path.join(targetDir, `${baseName}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(logMeta, null, 2), "utf-8");

  return { baseName, dateFolder };
}

async function getBackupsByDate(dateStr) {
  if (isSupabaseConnected()) {
    try {
      const { data, error } = await supabase
        .from("report_backups")
        .select("*")
        .eq("report_date", dateStr)
        .order("created_at", { ascending: false });
      if (!error && data) return data;
    } catch (e) {
      console.error("Lỗi lấy danh sách backup từ Supabase:", e);
    }
  }

  ensureLocalDirs();
  const backupDir = path.join(DATA_DIR, "backups");
  if (!fs.existsSync(backupDir)) return [];

  const files = fs.readdirSync(backupDir).filter(f => f.endsWith(".json"));
  const backups = [];
  files.forEach(f => {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(backupDir, f), "utf-8"));
      if (content.original_report_date === dateStr || content.report_date === dateStr) {
        backups.push(content);
      }
    } catch (e) {}
  });

  return backups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

async function restoreReportBackup(backupId) {
  let backupData = null;

  if (isSupabaseConnected()) {
    try {
      const { data } = await supabase.from("report_backups").select("*").eq("id", backupId).single();
      if (data) backupData = data;
    } catch (e) {}
  }

  if (!backupData) {
    const backupFile = path.join(DATA_DIR, "backups", `${backupId}.json`);
    if (fs.existsSync(backupFile)) {
      try { backupData = JSON.parse(fs.readFileSync(backupFile, "utf-8")); } catch (e) {}
    }
  }

  if (!backupData) {
    throw new Error(`Không tìm thấy bản ghi sao lưu có ID: ${backupId}`);
  }

  const reportsToRestore = backupData.snapshot_data || backupData.raw_data;
  const targetDate = backupData.report_date || backupData.original_report_date;

  if (!Array.isArray(reportsToRestore) || reportsToRestore.length === 0) {
    throw new Error("Bản sao lưu không chứa dữ liệu hợp lệ để khôi phục!");
  }

  // Khôi phục file local JSON
  const [year, month] = targetDate.split("-");
  const monthFolder = path.join(REPORTS_DIR, `${year}-${month}`);
  if (!fs.existsSync(monthFolder)) fs.mkdirSync(monthFolder, { recursive: true });
  const dailyFile = path.join(monthFolder, `${targetDate}.json`);
  fs.writeFileSync(dailyFile, JSON.stringify(reportsToRestore, null, 2), "utf-8");

  // Khôi phục Supabase nếu có
  if (isSupabaseConnected()) {
    try {
      // Đặt lại status = 'active' cho các báo cáo trong snapshot
      for (const rep of reportsToRestore) {
        const parsed = rep.parsed_result || rep;
        await supabase.from("reports").upsert({
          id: rep.id,
          report_date: targetDate,
          user_info: rep.user_info,
          input_type: rep.input_type || "restored",
          raw_data: parsed,
          status: "active"
        });
      }
    } catch (e) {
      console.error("Lỗi khôi phục Supabase:", e);
    }
  }

  return { targetDate, restoredCount: reportsToRestore.length };
}

async function logAuditAction(action, targetDate, reportId, userInfo, details) {
  if (isSupabaseConnected()) {
    try {
      await supabase.from("audit_logs").insert({
        action,
        target_date: targetDate,
        report_id: reportId,
        user_info: userInfo,
        details
      });
    } catch (e) {}
  }
}

module.exports = {
  saveReport,
  deleteReport,
  updateStaffRevenue,
  updateExpense,
  getDailyReports,
  getMonthlyReportsList,
  savePhotoLog,
  getDateKeys,
  getBackupsByDate,
  restoreReportBackup,
  logAuditAction
};

