const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const LOGS_DIR = path.join(DATA_DIR, "logs");
const STAFF_FILE = path.join(DATA_DIR, "staff.json");
const ADMINS_FILE = path.join(DATA_DIR, "admins.json");
const INSTALLMENTS_FILE = path.join(DATA_DIR, "installments.json");
const COMMISSION_FILE = path.join(DATA_DIR, "commission_config.json");

const DEFAULT_COMMISSION = {
  goi_mong_percent: 10,
  mi_percent: 30,
  ngoai_gio_percent: 50
};

function initDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }

  if (!fs.existsSync(STAFF_FILE)) {
    const defaultStaff = ["bà chủ Tuyết Trần", "Quỳnh Anh", "Huệ", "chị Cúc"];
    fs.writeFileSync(STAFF_FILE, JSON.stringify(defaultStaff, null, 2), "utf-8");
  }

  if (!fs.existsSync(ADMINS_FILE)) {
    const envAdmins = (process.env.ADMIN_USER_IDS || "")
      .split(",")
      .map(id => id.trim())
      .filter(Boolean);
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(envAdmins, null, 2), "utf-8");
  }

  if (!fs.existsSync(INSTALLMENTS_FILE)) {
    fs.writeFileSync(INSTALLMENTS_FILE, JSON.stringify([], null, 2), "utf-8");
  }

  if (!fs.existsSync(COMMISSION_FILE)) {
    fs.writeFileSync(COMMISSION_FILE, JSON.stringify(DEFAULT_COMMISSION, null, 2), "utf-8");
  }
}

function getCommissionConfigDb() {
  initDb();
  try {
    const data = fs.readFileSync(COMMISSION_FILE, "utf-8");
    return { ...DEFAULT_COMMISSION, ...JSON.parse(data) };
  } catch (err) {
    return DEFAULT_COMMISSION;
  }
}

function saveCommissionConfigDb(config) {
  initDb();
  const current = getCommissionConfigDb();
  const updated = {
    goi_mong_percent: config.goi_mong_percent !== undefined ? Number(config.goi_mong_percent) : current.goi_mong_percent,
    mi_percent: config.mi_percent !== undefined ? Number(config.mi_percent) : current.mi_percent,
    ngoai_gio_percent: config.ngoai_gio_percent !== undefined ? Number(config.ngoai_gio_percent) : current.ngoai_gio_percent
  };
  fs.writeFileSync(COMMISSION_FILE, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
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

function getStaffListDb() {
  initDb();
  try {
    const data = fs.readFileSync(STAFF_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    return ["bà chủ Tuyết Trần", "Quỳnh Anh", "Huệ", "chị Cúc"];
  }
}

function saveStaffListDb(staffArray) {
  initDb();
  const cleanList = Array.from(new Set(staffArray.map(s => s.trim()).filter(Boolean)));
  fs.writeFileSync(STAFF_FILE, JSON.stringify(cleanList, null, 2), "utf-8");
  return cleanList;
}

function addStaffDb(names) {
  const current = getStaffListDb();
  const newNames = Array.isArray(names) ? names : [names];
  newNames.forEach(n => {
    if (n && !current.includes(n.trim())) {
      current.push(n.trim());
    }
  });
  return saveStaffListDb(current);
}

function removeStaffDb(name) {
  const current = getStaffListDb();
  const updated = current.filter(s => s.toLowerCase() !== name.trim().toLowerCase());
  return saveStaffListDb(updated);
}

function getAdminListDb() {
  initDb();
  let admins = [];
  try {
    admins = JSON.parse(fs.readFileSync(ADMINS_FILE, "utf-8"));
  } catch (e) {
    admins = [];
  }

  const envAdmins = (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map(id => id.trim())
    .filter(Boolean);

  const combined = Array.from(new Set([...admins, ...envAdmins]));
  return combined;
}

function isAdminUser(userId) {
  if (!userId) return false;
  const admins = getAdminListDb();
  if (admins.length === 0) return true;
  return admins.includes(String(userId));
}

function addAdminUser(userId) {
  initDb();
  const current = getAdminListDb();
  if (!current.includes(String(userId))) {
    current.push(String(userId));
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(current, null, 2), "utf-8");
  }
  return current;
}

function getInstallmentsDb() {
  initDb();
  try {
    return JSON.parse(fs.readFileSync(INSTALLMENTS_FILE, "utf-8"));
  } catch (e) {
    return [];
  }
}

function getNextYearMonth(yearMonthStr) {
  const [y, m] = yearMonthStr.split("-").map(Number);
  let nextY = y;
  let nextM = m + 1;
  if (nextM > 12) {
    nextM = 1;
    nextY += 1;
  }
  return `${nextY}-${String(nextM).padStart(2, "0")}`;
}

function saveInstallmentsDb(installmentsList, currentYearMonth) {
  initDb();
  const current = getInstallmentsDb();
  const nextMonthStr = getNextYearMonth(currentYearMonth);

  installmentsList.forEach(item => {
    const monthly = item.monthly_amount || Math.round(item.total_amount / item.months);
    const plan = {
      id: `INS_${Date.now()}_${Math.floor(Math.random() * 100)}`,
      item_name: item.item_name,
      total_amount: item.total_amount,
      months: item.months,
      monthly_amount: monthly,
      purchase_year_month: currentYearMonth, // Tháng mua hàng
      start_year_month: nextMonthStr,         // Tháng bắt đầu tính tiền trả góp (Tháng Sau)
      created_at: new Date().toISOString()
    };
    current.push(plan);
  });

  fs.writeFileSync(INSTALLMENTS_FILE, JSON.stringify(current, null, 2), "utf-8");
  return current;
}

function deleteInstallmentDb(installmentId) {
  initDb();
  const current = getInstallmentsDb();
  const updated = current.filter(p => p.id !== installmentId);
  fs.writeFileSync(INSTALLMENTS_FILE, JSON.stringify(updated, null, 2), "utf-8");
  return updated.length < current.length;
}

function getActiveInstallmentsForMonth(targetYearMonth) {
  const allPlans = getInstallmentsDb();
  const activePlans = [];

  const [tYear, tMonth] = targetYearMonth.split("-").map(Number);
  const targetIndex = tYear * 12 + tMonth;

  allPlans.forEach(plan => {
    const [sYear, sMonth] = plan.start_year_month.split("-").map(Number);
    const startIndex = sYear * 12 + sMonth;
    const endIndex = startIndex + plan.months - 1;

    if (targetIndex >= startIndex && targetIndex <= endIndex) {
      const monthNum = targetIndex - startIndex + 1;
      activePlans.push({
        ...plan,
        current_month_index: monthNum
      });
    }
  });

  return activePlans;
}

function saveReportDb(reportData, metaInfo = {}, explicitDate = null) {
  initDb();

  const now = new Date();
  let targetDate = explicitDate || reportData.report_date;

  // Kiểm tra định dạng YYYY-MM-DD
  if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    const { dateStr } = getDateKeys(now);
    targetDate = dateStr;
  } else {
    // Sửa lỗi nếu AI đoán năm cũ (< 2026) thành 2026
    const parts = targetDate.split("-");
    if (parseInt(parts[0], 10) < 2026) {
      targetDate = `2026-${parts[1]}-${parts[2]}`;
    }
  }

  const [year, month] = targetDate.split("-");
  const yearMonth = `${year}-${month}`;

  const monthFolder = path.join(REPORTS_DIR, yearMonth);
  if (!fs.existsSync(monthFolder)) {
    fs.mkdirSync(monthFolder, { recursive: true });
  }

  const dailyFile = path.join(monthFolder, `${targetDate}.json`);

  let dailyReports = [];
  if (fs.existsSync(dailyFile)) {
    try {
      dailyReports = JSON.parse(fs.readFileSync(dailyFile, "utf-8"));
    } catch (e) {
      dailyReports = [];
    }
  }

  const record = {
    id: `REP_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    timestamp: now.toISOString(),
    date: targetDate,
    user_info: metaInfo.userInfo || null,
    input_type: metaInfo.inputType || "text",
    parsed_result: reportData
  };

  dailyReports.unshift(record);
  fs.writeFileSync(dailyFile, JSON.stringify(dailyReports, null, 2), "utf-8");

  if (Array.isArray(reportData.installments_data) && reportData.installments_data.length > 0) {
    saveInstallmentsDb(reportData.installments_data, yearMonth);
  }

  return { record, filePath: dailyFile, dateStr: targetDate };
}

/**
 * Xóa một lượt báo cáo dựa vào reportId
 */
function deleteReportDb(reportId) {
  initDb();
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

/**
 * Cập nhật doanh số nhân viên trong báo cáo
 */
function updateStaffRevenueDb(reportId, staffName, goiMong, mi, ngoaiGio) {
  initDb();
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

/**
 * Cập nhật khoản chi tiêu trong báo cáo
 */
function updateExpenseDb(reportId, amount, notes) {
  initDb();
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

function getDailyReports(dateStr) {
  initDb();
  const [year, month] = dateStr.split("-");
  const yearMonth = `${year}-${month}`;
  const dailyFile = path.join(REPORTS_DIR, yearMonth, `${dateStr}.json`);

  if (!fs.existsSync(dailyFile)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(dailyFile, "utf-8"));
  } catch (err) {
    return [];
  }
}

/**
 * Tổng hợp báo cáo thu chi & doanh số nhân viên chi tiết theo NGÀY (YYYY-MM-DD)
 */
function getDailySummary(dateStr) {
  const reports = getDailyReports(dateStr);
  if (reports.length === 0) return null;

  let totalGoiMong = 0;
  let totalMi = 0;
  let totalNgoaiGio = 0;
  let totalExpenses = 0;
  const staffStats = {};
  const expensesList = [];
  const deletedItemsList = [];

  reports.forEach(r => {
    const parsed = r.parsed_result;
    if (Array.isArray(parsed.staff_data)) {
      parsed.staff_data.forEach(s => {
        const gm = s.revenue?.goi_mong || 0;
        const mi = s.revenue?.mi || 0;
        const ng = s.revenue?.ngoai_gio || 0;
        totalGoiMong += gm;
        totalMi += mi;
        totalNgoaiGio += ng;

        if (!staffStats[s.name]) {
          staffStats[s.name] = { score: 0, goi_mong: 0, mi: 0, ngoai_gio: 0, total: 0 };
        }
        staffStats[s.name].score += (s.attendance_score || 0);
        staffStats[s.name].goi_mong += gm;
        staffStats[s.name].mi += mi;
        staffStats[s.name].ngoai_gio += ng;
        staffStats[s.name].total += (gm + mi + ng);
      });
    }

    if (Array.isArray(parsed.expenses_data)) {
      parsed.expenses_data.forEach(exp => {
        totalExpenses += (exp.amount || 0);
        expensesList.push({
          amount: exp.amount || 0,
          notes: exp.notes || exp.category || "Chi tiêu"
        });
      });
    }

    if (Array.isArray(parsed.deleted_items)) {
      parsed.deleted_items.forEach(del => {
        deletedItemsList.push({
          content: del.content || "Dòng bị gạch xóa",
          original_amount: del.original_amount || 0,
          reason: del.reason || "Không có lý do"
        });
      });
    }
  });

  const totalRevenue = totalGoiMong + totalMi + totalNgoaiGio;
  const netProfit = totalRevenue - totalExpenses;

  return {
    dateStr,
    reportsCount: reports.length,
    reports,
    revenue: {
      goi_mong: totalGoiMong,
      mi: totalMi,
      ngoai_gio: totalNgoaiGio,
      total: totalRevenue
    },
    expenses: {
      total: totalExpenses,
      list: expensesList
    },
    deletedItems: deletedItemsList,
    netProfit,
    staffStats
  };
}

function getMonthlySummary(yearMonth) {
  initDb();
  const monthFolder = path.join(REPORTS_DIR, yearMonth);

  let files = [];
  if (fs.existsSync(monthFolder)) {
    files = fs.readdirSync(monthFolder).filter(f => f.endsWith(".json"));
  }

  let totalRevenueGoiMong = 0;
  let totalRevenueMi = 0;
  let totalRevenueNgoaiGio = 0;
  let totalDirectExpenses = 0;
  let totalReportsCount = 0;
  const staffStats = {};
  const commissionConfig = getCommissionConfigDb();

  files.forEach(file => {
    const filePath = path.join(monthFolder, file);
    try {
      const reports = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      reports.forEach(rep => {
        totalReportsCount++;
        const parsed = rep.parsed_result;

        if (Array.isArray(parsed.staff_data)) {
          parsed.staff_data.forEach(s => {
            const goiMong = s.revenue?.goi_mong || 0;
            const mi = s.revenue?.mi || 0;
            const ngoaiGio = s.revenue?.ngoai_gio || 0;

            totalRevenueGoiMong += goiMong;
            totalRevenueMi += mi;
            totalRevenueNgoaiGio += ngoaiGio;

            if (!staffStats[s.name]) {
              staffStats[s.name] = { 
                total_score: 0, 
                days_worked: 0,
                days_off: 0,
                days_late: 0,
                late_minutes: 0,
                total_goi_mong: 0,
                total_mi: 0,
                total_ngoai_gio: 0,
                total_revenue: 0, 
                commission_goi_mong: 0,
                commission_mi: 0,
                commission_ngoai_gio: 0,
                total_commission: 0,
                attendance_notes: [] 
              };
            }
            const score = s.attendance_score !== undefined ? s.attendance_score : 1;
            staffStats[s.name].total_score += score;
            if (score > 0) {
              staffStats[s.name].days_worked += 1;
            } else {
              staffStats[s.name].days_off += 1;
            }

            staffStats[s.name].total_goi_mong += goiMong;
            staffStats[s.name].total_mi += mi;
            staffStats[s.name].total_ngoai_gio += ngoaiGio;
            staffStats[s.name].total_revenue += (goiMong + mi + ngoaiGio);

            const commGM = Math.round(goiMong * (commissionConfig.goi_mong_percent / 100));
            const commMi = Math.round(mi * (commissionConfig.mi_percent / 100));
            const commNG = Math.round(ngoaiGio * (commissionConfig.ngoai_gio_percent / 100));

            staffStats[s.name].commission_goi_mong += commGM;
            staffStats[s.name].commission_mi += commMi;
            staffStats[s.name].commission_ngoai_gio += commNG;
            staffStats[s.name].total_commission += (commGM + commMi + commNG);

            if (s.attendance_description) {
              const desc = s.attendance_description.trim();
              if (desc && desc !== "Làm cả ngày") {
                if (desc.toLowerCase().includes("muộn")) {
                  staffStats[s.name].days_late += 1;
                  const match = desc.match(/(\d+)\s*phút/i) || desc.match(/muộn\s*(\d+)/i);
                  if (match) {
                    staffStats[s.name].late_minutes += parseInt(match[1], 10);
                  }
                }
                staffStats[s.name].attendance_notes.push({
                  date: rep.date || file.replace(".json", ""),
                  note: desc
                });
              }
            }
          });
        }

        if (Array.isArray(parsed.expenses_data)) {
          parsed.expenses_data.forEach(exp => {
            totalDirectExpenses += (exp.amount || 0);
          });
        }
      });
    } catch (e) {
      console.error(`Lỗi đọc file ${filePath}:`, e);
    }
  });

  const activeInstallments = getActiveInstallmentsForMonth(yearMonth);
  let totalInstallmentExpenses = 0;
  activeInstallments.forEach(ins => {
    totalInstallmentExpenses += ins.monthly_amount;
  });

  const totalRevenueAll = totalRevenueGoiMong + totalRevenueMi + totalRevenueNgoaiGio;
  const totalAllExpenses = totalDirectExpenses + totalInstallmentExpenses;
  const netProfit = totalRevenueAll - totalAllExpenses;

  return {
    yearMonth,
    daysCount: files.length,
    totalReportsCount,
    commissionConfig,
    revenue: {
      goi_mong: totalRevenueGoiMong,
      mi: totalRevenueMi,
      ngoai_gio: totalRevenueNgoaiGio,
      total: totalRevenueAll
    },
    expenses: {
      direct: totalDirectExpenses,
      installments: totalInstallmentExpenses,
      total: totalAllExpenses
    },
    activeInstallments,
    netProfit,
    staffStats
  };
}

/**
 * Xuất dữ liệu báo cáo tháng ra file CSV (Excel)
 */
function exportMonthlyCsv(yearMonth) {
  initDb();
  const monthFolder = path.join(REPORTS_DIR, yearMonth);
  if (!fs.existsSync(monthFolder)) return null;

  const commissionConfig = getCommissionConfigDb();
  const files = fs.readdirSync(monthFolder).filter(f => f.endsWith(".json")).sort();

  let csvContent = "\uFEFF"; // UTF-8 BOM cho Excel mở tiếng Việt không lỗi font
  csvContent += `Cấu hình hoa hồng % lương: Gội/Móng ${commissionConfig.goi_mong_percent}%, Mi/Phun xăm ${commissionConfig.mi_percent}%, Tăng ca ${commissionConfig.ngoai_gio_percent}%\n`;
  csvContent += "Ngày,Mã Báo Cáo,Tên Nhân Viên,Công (Score),Thời Gian / Ghi Chú Đi Muộn,Gội/Móng (VNĐ),Mi/Phun Xăm (VNĐ),Tăng Ca (VNĐ),Tổng Doanh Thu Lượt (VNĐ),Hoa Hồng Gội/Móng (VNĐ),Hoa Hồng Mi (VNĐ),Hoa Hồng Tăng Ca (VNĐ),Tổng Hoa Hồng Lượt (VNĐ),Khoản Chi Tiêu,Số Tiền Chi (VNĐ)\n";

  files.forEach(file => {
    const filePath = path.join(monthFolder, file);
    try {
      const reports = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      reports.forEach(r => {
        const date = r.date;
        const repId = r.id;
        const parsed = r.parsed_result;

        const staffData = parsed.staff_data || [];
        const expensesData = parsed.expenses_data || [];
        const maxRows = Math.max(staffData.length, expensesData.length, 1);

        for (let i = 0; i < maxRows; i++) {
          const s = staffData[i] || {};
          const e = expensesData[i] || {};

          const sName = s.name ? `"${s.name}"` : "";
          const sScore = s.attendance_score !== undefined ? s.attendance_score : "";
          const sAttendance = s.attendance_description ? `"${s.attendance_description.replace(/"/g, '""')}"` : "";
          const sGoiMong = s.revenue?.goi_mong || 0;
          const sMi = s.revenue?.mi || 0;
          const sNgoaiGio = s.revenue?.ngoai_gio || 0;
          const sTotal = (sGoiMong + sMi + sNgoaiGio) || 0;

          let commGM = 0, commMi = 0, commNG = 0, commTotal = 0;
          if (s.name) {
            commGM = Math.round(sGoiMong * (commissionConfig.goi_mong_percent / 100));
            commMi = Math.round(sMi * (commissionConfig.mi_percent / 100));
            commNG = Math.round(sNgoaiGio * (commissionConfig.ngoai_gio_percent / 100));
            commTotal = commGM + commMi + commNG;
          }

          const eNotes = e.notes ? `"${e.notes.replace(/"/g, '""')}"` : "";
          const eAmount = e.amount || 0;

          csvContent += `${date},${repId},${sName},${sScore},${sAttendance},${sGoiMong},${sMi},${sNgoaiGio},${sTotal},${commGM},${commMi},${commNG},${commTotal},${eNotes},${eAmount}\n`;
        }
      });
    } catch (err) {}
  });

  // Thêm bảng tổng hợp lương nhân viên ở cuối file CSV
  const summary = getMonthlySummary(yearMonth);
  if (summary && summary.staffStats) {
    csvContent += "\n--- BẢNG TỔNG HỢP LƯƠNG & HOA HỒNG NHÂN VIÊN THÁNG ---\n";
    csvContent += "Tên Nhân Viên,Tổng Công (Score),Số Ngày Làm,Số Ngày Nghỉ,Số Lần Muộn,Tổng Phút Muộn,Tổng Gội/Móng (VNĐ),Tổng Mi/Phun Xăm (VNĐ),Tổng Tăng Ca (VNĐ),Tổng Doanh Thu NV (VNĐ),Lương % Gội/Móng (10%),Lương % Mi (30%),Lương % Tăng Ca (50%),TỔNG LƯƠNG % HOA HỒNG DOANH THU (VNĐ)\n";
    Object.keys(summary.staffStats).forEach(name => {
      const st = summary.staffStats[name];
      csvContent += `"${name}",${st.total_score},${st.days_worked},${st.days_off},${st.days_late},${st.late_minutes},${st.total_goi_mong},${st.total_mi},${st.total_ngoai_gio},${st.total_revenue},${st.commission_goi_mong},${st.commission_mi},${st.commission_ngoai_gio},${st.total_commission}\n`;
    });
  }

  const exportPath = path.join(DATA_DIR, `BaoCao_NailMi_TuyetTran_${yearMonth}.csv`);
  fs.writeFileSync(exportPath, csvContent, "utf-8");
  return exportPath;
}

/**
 * Lưu vết hình ảnh và kết quả bóc tách OCR vào data/logs
 */
function savePhotoLogDb(imageBuffer, parsedResult, errorMsg = null) {
  initDb();
  const timestamp = Date.now();
  const dateFolder = new Date().toISOString().substring(0, 10);
  const targetDir = path.join(LOGS_DIR, dateFolder);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

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
  initDb,
  getStaffListDb,
  saveStaffListDb,
  addStaffDb,
  removeStaffDb,
  getAdminListDb,
  isAdminUser,
  addAdminUser,
  getCommissionConfigDb,
  saveCommissionConfigDb,
  getInstallmentsDb,
  saveInstallmentsDb,
  deleteInstallmentDb,
  getActiveInstallmentsForMonth,
  saveReportDb,
  savePhotoLogDb,
  deleteReportDb,
  updateStaffRevenueDb,
  updateExpenseDb,
  getDailyReports,
  getDailySummary,
  getMonthlySummary,
  exportMonthlyCsv,
  getDateKeys
};
