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

  // Nếu chọn chế độ thay thế (replace_all), xóa các báo cáo cũ trong cùng ngày
  if (reportData.replacement_mode === "replace_all") {
    if (isSupabaseConnected()) {
      try {
        await supabase.from("reports").delete().eq("report_date", targetDate);
      } catch (e) {
        console.error("Lỗi xóa báo cáo cũ trên Supabase:", e);
      }
    }
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

module.exports = {
  saveReport,
  deleteReport,
  updateStaffRevenue,
  updateExpense,
  getDailyReports,
  getMonthlyReportsList,
  savePhotoLog,
  getDateKeys
};
