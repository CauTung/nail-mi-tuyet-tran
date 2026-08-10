const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const STAFF_FILE = path.join(DATA_DIR, "staff.json");
const ADMINS_FILE = path.join(DATA_DIR, "admins.json");
const INSTALLMENTS_FILE = path.join(DATA_DIR, "installments.json");

function initDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
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
              staffStats[s.name] = { total_score: 0, total_revenue: 0 };
            }
            staffStats[s.name].total_score += (s.attendance_score || 0);
            staffStats[s.name].total_revenue += (goiMong + mi + ngoaiGio);
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

module.exports = {
  initDb,
  getStaffListDb,
  saveStaffListDb,
  addStaffDb,
  removeStaffDb,
  getAdminListDb,
  isAdminUser,
  addAdminUser,
  getInstallmentsDb,
  saveInstallmentsDb,
  deleteInstallmentDb,
  getActiveInstallmentsForMonth,
  saveReportDb,
  deleteReportDb,
  updateStaffRevenueDb,
  updateExpenseDb,
  getDailyReports,
  getDailySummary,
  getMonthlySummary,
  getDateKeys
};
