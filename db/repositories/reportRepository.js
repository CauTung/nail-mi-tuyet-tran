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
      const backupRecord = {
        id: backupId,
        original_report_date: targetDate,
        action_type: "overwrite",
        user_info: metaInfo.userInfo || null,
        snapshot_data: existingReports,
        created_at: now.toISOString()
      };

      // Backup local JSON
      const backupDir = path.join(DATA_DIR, "backups");
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(path.join(backupDir, `${backupId}.json`), JSON.stringify(backupRecord, null, 2), "utf-8");

      // Backup Supabase
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
          console.error("Lỗi lưu backup báo cáo trên Supabase:", e);
        }
      }
    }

    // Reset file JSON local thành mảng rỗng cho ngày đó
    const monthFolder = path.join(REPORTS_DIR, yearMonth);
    const dailyFile = path.join(monthFolder, `${targetDate}.json`);
    if (fs.existsSync(dailyFile)) {
      try { fs.writeFileSync(dailyFile, JSON.stringify([], null, 2), "utf-8"); } catch (e) {}
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

  // Local JSON saving
  const monthFolder = path.join(REPORTS_DIR, yearMonth);
  if (!fs.existsSync(monthFolder)) fs.mkdirSync(monthFolder, { recursive: true });
  const dailyFile = path.join(monthFolder, `${targetDate}.json`);

  let dailyReports = [];
  if (fs.existsSync(dailyFile)) {
    try {
      dailyReports = JSON.parse(fs.readFileSync(dailyFile, "utf-8"));
    } catch (e) {
      dailyReports = [];
    }
  }
  dailyReports.unshift(record);
  fs.writeFileSync(dailyFile, JSON.stringify(dailyReports, null, 2), "utf-8");

  // Save Installments if any
  if (Array.isArray(reportData.installments_data) && reportData.installments_data.length > 0) {
    await installmentRepo.saveInstallments(reportData.installments_data, yearMonth);
  }

  // Supabase saving
  if (isSupabaseConnected()) {
    try {
      await supabase.from("reports").insert({
        id: reportId,
        report_date: targetDate,
        user_info: metaInfo.userInfo || null,
        input_type: metaInfo.inputType || "text",
        raw_data: reportData,
        created_at: now.toISOString()
      });

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
      console.error("Lỗi ghi báo cáo vào Supabase:", err);
    }
  }

  return { record, filePath: dailyFile, dateStr: targetDate };
}

async function deleteReport(reportId) {
  if (isSupabaseConnected()) {
    try {
      await supabase.from("reports").delete().eq("id", reportId);
    } catch (err) {
      console.error("Lỗi xóa báo cáo trên Supabase:", err);
    }
  }

  ensureLocalDirs();
  const months = fs.readdirSync(REPORTS_DIR);
  let deleted = false;

  for (const ym of months) {
    const monthPath = path.join(REPORTS_DIR, ym);
    if (fs.statSync(monthPath).isDirectory()) {
      const files = fs.readdirSync(monthPath).filter(f => f.endsWith(".json"));
      for (const file of files) {
        const filePath = path.join(monthPath, file);
        try {
          let list = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          const originalLen = list.length;
          list = list.filter(r => r.id !== reportId);
          if (list.length < originalLen) {
            fs.writeFileSync(filePath, JSON.stringify(list, null, 2), "utf-8");
            deleted = true;
            break;
          }
        } catch (e) {}
      }
    }
    if (deleted) break;
  }
  return deleted;
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
    } catch (err) {
      console.error("Lỗi cập nhật doanh số nhân viên Supabase:", err);
    }
  }

  // Local JSON fallback update
  ensureLocalDirs();
  const months = fs.readdirSync(REPORTS_DIR);
  let updatedRecord = null;

  for (const ym of months) {
    const monthPath = path.join(REPORTS_DIR, ym);
    if (fs.statSync(monthPath).isDirectory()) {
      const files = fs.readdirSync(monthPath).filter(f => f.endsWith(".json"));
      for (const file of files) {
        const filePath = path.join(monthPath, file);
        try {
          let list = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          const target = list.find(r => r.id === reportId);
          if (target) {
            let staffObj = target.parsed_result.staff_data.find(s => s.name.toLowerCase() === staffName.toLowerCase());
            if (!staffObj) {
              staffObj = {
                name: staffName,
                is_unknown_staff: false,
                attendance_description: "Làm cả ngày",
                attendance_score: 1.0,
                revenue: { goi_mong: 0, mi: 0, ngoai_gio: 0 }
              };
              target.parsed_result.staff_data.push(staffObj);
            }
            if (goiMong !== undefined && goiMong !== null) staffObj.revenue.goi_mong = Number(goiMong);
            if (mi !== undefined && mi !== null) staffObj.revenue.mi = Number(mi);
            if (ngoaiGio !== undefined && ngoaiGio !== null) staffObj.revenue.ngoai_gio = Number(ngoaiGio);

            fs.writeFileSync(filePath, JSON.stringify(list, null, 2), "utf-8");
            updatedRecord = target;
            break;
          }
        } catch (e) {}
      }
    }
    if (updatedRecord) break;
  }
  return updatedRecord;
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
    } catch (err) {
      console.error("Lỗi cập nhật chi tiêu Supabase:", err);
    }
  }

  ensureLocalDirs();
  const months = fs.readdirSync(REPORTS_DIR);
  let updatedRecord = null;

  for (const ym of months) {
    const monthPath = path.join(REPORTS_DIR, ym);
    if (fs.statSync(monthPath).isDirectory()) {
      const files = fs.readdirSync(monthPath).filter(f => f.endsWith(".json"));
      for (const file of files) {
        const filePath = path.join(monthPath, file);
        try {
          let list = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          const target = list.find(r => r.id === reportId);
          if (target) {
            target.parsed_result.expenses_data = [
              {
                category: "Chi phí điều chỉnh",
                amount: Number(amount),
                notes: notes || "Đã điều chỉnh chi tiêu"
              }
            ];
            fs.writeFileSync(filePath, JSON.stringify(list, null, 2), "utf-8");
            updatedRecord = target;
            break;
          }
        } catch (e) {}
      }
    }
    if (updatedRecord) break;
  }
  return updatedRecord;
}

async function getDailyReports(dateStr) {
  if (isSupabaseConnected()) {
    try {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("report_date", dateStr)
        .or("status.is.null,status.neq.overwritten")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map(row => ({
          id: row.id,
          date: row.report_date,
          user_info: row.user_info,
          input_type: row.input_type,
          parsed_result: row.raw_data
        }));
      }
    } catch (err) {
      console.error("Lỗi lấy báo cáo ngày từ Supabase:", err);
    }
  }

  ensureLocalDirs();
  const [year, month] = dateStr.split("-");
  const yearMonth = `${year}-${month}`;
  const dailyFile = path.join(REPORTS_DIR, yearMonth, `${dateStr}.json`);

  if (!fs.existsSync(dailyFile)) return [];

  try {
    return JSON.parse(fs.readFileSync(dailyFile, "utf-8"));
  } catch (err) {
    return [];
  }
}

async function getMonthlyReportsList(yearMonth) {
  if (isSupabaseConnected()) {
    try {
      const startDate = `${yearMonth}-01`;
      const endDate = `${yearMonth}-31`;
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .gte("report_date", startDate)
        .lte("report_date", endDate)
        .or("status.is.null,status.neq.overwritten")
        .order("report_date", { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map(row => ({
          id: row.id,
          date: row.report_date,
          user_info: row.user_info,
          input_type: row.input_type,
          parsed_result: row.raw_data
        }));
      }
    } catch (err) {
      console.error("Lỗi lấy báo cáo tháng từ Supabase:", err);
    }
  }

  ensureLocalDirs();
  const monthFolder = path.join(REPORTS_DIR, yearMonth);
  if (!fs.existsSync(monthFolder)) return [];

  const files = fs.readdirSync(monthFolder).filter(f => f.endsWith(".json")).sort();
  const allReports = [];

  files.forEach(file => {
    const filePath = path.join(monthFolder, file);
    try {
      const reports = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      allReports.push(...reports);
    } catch (e) {}
  });

  return allReports;
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

