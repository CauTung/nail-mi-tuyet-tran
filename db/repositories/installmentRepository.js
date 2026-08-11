const fs = require("fs");
const path = require("path");
const { supabase, isSupabaseConnected } = require("../../config/supabase");

const DATA_DIR = path.join(__dirname, "../../data");
const INSTALLMENTS_FILE = path.join(DATA_DIR, "installments.json");

function ensureLocalFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(INSTALLMENTS_FILE)) {
    fs.writeFileSync(INSTALLMENTS_FILE, JSON.stringify([], null, 2), "utf-8");
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

async function getInstallmentsList() {
  if (isSupabaseConnected()) {
    try {
      const { data, error } = await supabase.from("installments").select("*").order("created_at", { ascending: false });
      if (!error && data) {
        return data;
      }
    } catch (err) {
      console.error("Lỗi lấy danh sách trả góp từ Supabase:", err);
    }
  }

  ensureLocalFile();
  try {
    return JSON.parse(fs.readFileSync(INSTALLMENTS_FILE, "utf-8"));
  } catch (e) {
    return [];
  }
}

async function saveInstallments(installmentsList, currentYearMonth) {
  ensureLocalFile();
  const current = await getInstallmentsList();
  const nextMonthStr = getNextYearMonth(currentYearMonth);
  const newPlans = [];

  installmentsList.forEach(item => {
    const monthly = item.monthly_amount || Math.round(item.total_amount / item.months);
    const plan = {
      id: `INS_${Date.now()}_${Math.floor(Math.random() * 100)}`,
      item_name: item.item_name,
      total_amount: Number(item.total_amount),
      months: Number(item.months),
      monthly_amount: Number(monthly),
      purchase_year_month: currentYearMonth,
      start_year_month: nextMonthStr,
      created_at: new Date().toISOString()
    };
    newPlans.push(plan);
    current.push(plan);
  });

  if (isSupabaseConnected() && newPlans.length > 0) {
    try {
      await supabase.from("installments").insert(newPlans);
    } catch (err) {
      console.error("Lỗi lưu mua trả góp vào Supabase:", err);
    }
  }

  fs.writeFileSync(INSTALLMENTS_FILE, JSON.stringify(current, null, 2), "utf-8");
  return current;
}

async function deleteInstallment(installmentId) {
  if (isSupabaseConnected()) {
    try {
      await supabase.from("installments").delete().eq("id", installmentId);
    } catch (err) {
      console.error("Lỗi xóa trả góp khỏi Supabase:", err);
    }
  }

  ensureLocalFile();
  const current = await getInstallmentsList();
  const updated = current.filter(p => p.id !== installmentId);
  fs.writeFileSync(INSTALLMENTS_FILE, JSON.stringify(updated, null, 2), "utf-8");
  return updated.length < current.length;
}

async function getActiveInstallmentsForMonth(targetYearMonth) {
  const allPlans = await getInstallmentsList();
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

module.exports = {
  getInstallmentsList,
  saveInstallments,
  deleteInstallment,
  getActiveInstallmentsForMonth
};
