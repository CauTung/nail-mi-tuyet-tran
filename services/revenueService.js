/**
 * Centralized Service for Staff Revenue Calculations & Breakdown Parsing
 */
const { formatMoney } = require("../utils/formatter");

/**
 * Tính tổng doanh số của 1 nhân viên từ object staffData
 * Hỗ trợ cả cấu trúc s.revenue (động) lẫn s.goi_mong, s.mi, s.ngoai_gio (cũ)
 */
function getStaffTotalRevenue(s) {
  if (!s) return 0;
  let total = 0;
  if (s.revenue && typeof s.revenue === "object") {
    Object.values(s.revenue).forEach(val => {
      total += Number(val) || 0;
    });
  } else {
    total += Number(s.goi_mong || s.goi || 0);
    total += Number(s.mi || s.xam || 0);
    total += Number(s.ngoai_gio || s.tang_ca || 0);
  }
  return total;
}

/**
 * Lấy mảng các mục doanh thu đã phân loại của 1 nhân viên
 * ví dụ: ["Gội/Móng 300.000đ", "Mi 200.000đ"]
 */
function getStaffRevenueBreakdown(s) {
  if (!s) return [];
  const parts = [];
  if (s.revenue && typeof s.revenue === "object") {
    Object.entries(s.revenue).forEach(([k, val]) => {
      const num = Number(val) || 0;
      if (num > 0) {
        parts.push(`${k} ${formatMoney(num)}`);
      }
    });
  } else {
    if (s.goi_mong > 0) parts.push(`Gội/Móng ${formatMoney(s.goi_mong)}`);
    if (s.mi > 0) parts.push(`Mi/Xăm ${formatMoney(s.mi)}`);
    if (s.ngoai_gio > 0) parts.push(`Ngoài giờ ${formatMoney(s.ngoai_gio)}`);
  }
  return parts;
}

module.exports = {
  getStaffTotalRevenue,
  getStaffRevenueBreakdown
};
