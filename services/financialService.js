const reportRepo = require("../db/repositories/reportRepository");
const configRepo = require("../db/repositories/configRepository");
const installmentRepo = require("../db/repositories/installmentRepository");

async function getDailySummary(dateStr) {
  const [reports, commissionConfig] = await Promise.all([
    reportRepo.getDailyReports(dateStr),
    configRepo.getCommissionConfig()
  ]);

  if (!reports || reports.length === 0) return null;

  const categories = commissionConfig.categories || configRepo.DEFAULT_CATEGORIES;
  const categoryTotals = {};
  categories.forEach(c => { categoryTotals[c.key] = 0; });

  let totalExpenses = 0;
  const staffStats = {};
  const expensesList = [];
  const deletedItemsList = [];

  reports.forEach(r => {
    const parsed = r.parsed_result || {};
    if (Array.isArray(parsed.staff_data)) {
      parsed.staff_data.forEach(s => {
        if (!staffStats[s.name]) {
          staffStats[s.name] = { 
            score: 0, 
            goi_mong: 0, 
            mi: 0, 
            ngoai_gio: 0, 
            total: 0,
            categoryTotals: {} 
          };
          categories.forEach(c => { staffStats[s.name].categoryTotals[c.key] = 0; });
        }
        staffStats[s.name].score += (s.attendance_score || 0);

        categories.forEach(cat => {
          let val = 0;
          if (typeof s.revenue === "object" && s.revenue !== null) {
            val = Number(s.revenue[cat.key]) || 0;
          }
          if (!val && cat.key === "goi_mong") val = Number(s.goi_mong || s.goi || 0);
          if (!val && cat.key === "mi") val = Number(s.mi || s.xam || 0);
          if (!val && cat.key === "ngoai_gio") val = Number(s.ngoai_gio || s.tang_ca || 0);

          categoryTotals[cat.key] = (categoryTotals[cat.key] || 0) + val;
          staffStats[s.name].categoryTotals[cat.key] = (staffStats[s.name].categoryTotals[cat.key] || 0) + val;
          staffStats[s.name].total += val;

          if (cat.key === "goi_mong") staffStats[s.name].goi_mong += val;
          if (cat.key === "mi") staffStats[s.name].mi += val;
          if (cat.key === "ngoai_gio") staffStats[s.name].ngoai_gio += val;
        });
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

  const totalRevenue = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
  const netProfit = totalRevenue - totalExpenses;

  return {
    dateStr,
    reportsCount: reports.length,
    reports,
    categories,
    revenue: {
      ...categoryTotals,
      goi_mong: categoryTotals["goi_mong"] || 0,
      mi: categoryTotals["mi"] || 0,
      ngoai_gio: categoryTotals["ngoai_gio"] || 0,
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

async function getMonthlySummary(yearMonth) {
  const [reports, commissionConfig, activeInstallments] = await Promise.all([
    reportRepo.getMonthlyReportsList(yearMonth),
    configRepo.getCommissionConfig(),
    installmentRepo.getActiveInstallmentsForMonth(yearMonth)
  ]);

  const categories = commissionConfig.categories || configRepo.DEFAULT_CATEGORIES;
  const categoryTotals = {};
  categories.forEach(c => { categoryTotals[c.key] = 0; });

  let totalDirectExpenses = 0;
  let totalReportsCount = reports.length;
  const staffStats = {};

  reports.forEach(rep => {
    const parsed = rep.parsed_result || {};

    if (Array.isArray(parsed.staff_data)) {
      parsed.staff_data.forEach(s => {
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
            categoryTotals: {},
            categoryCommissions: {},
            attendance_notes: []
          };
          categories.forEach(c => {
            staffStats[s.name].categoryTotals[c.key] = 0;
            staffStats[s.name].categoryCommissions[c.key] = 0;
          });
        }

        const score = s.attendance_score !== undefined ? s.attendance_score : 1;
        staffStats[s.name].total_score += score;
        if (score > 0) {
          staffStats[s.name].days_worked += 1;
        } else {
          staffStats[s.name].days_off += 1;
        }

        categories.forEach(cat => {
          let val = 0;
          if (typeof s.revenue === "object" && s.revenue !== null) {
            val = Number(s.revenue[cat.key]) || 0;
          }
          if (!val && cat.key === "goi_mong") val = Number(s.goi_mong || s.goi || 0);
          if (!val && cat.key === "mi") val = Number(s.mi || s.xam || 0);
          if (!val && cat.key === "ngoai_gio") val = Number(s.ngoai_gio || s.tang_ca || 0);

          const comm = Math.round(val * (cat.percent / 100));

          categoryTotals[cat.key] = (categoryTotals[cat.key] || 0) + val;
          staffStats[s.name].categoryTotals[cat.key] = (staffStats[s.name].categoryTotals[cat.key] || 0) + val;
          staffStats[s.name].categoryCommissions[cat.key] = (staffStats[s.name].categoryCommissions[cat.key] || 0) + comm;
          staffStats[s.name].total_revenue += val;
          staffStats[s.name].total_commission += comm;

          if (cat.key === "goi_mong") {
            staffStats[s.name].total_goi_mong += val;
            staffStats[s.name].commission_goi_mong += comm;
          }
          if (cat.key === "mi") {
            staffStats[s.name].total_mi += val;
            staffStats[s.name].commission_mi += comm;
          }
          if (cat.key === "ngoai_gio") {
            staffStats[s.name].total_ngoai_gio += val;
            staffStats[s.name].commission_ngoai_gio += comm;
          }
        });

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
              date: rep.date,
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

  let totalInstallmentExpenses = 0;
  if (Array.isArray(activeInstallments)) {
    activeInstallments.forEach(ins => {
      totalInstallmentExpenses += (ins.monthly_amount || 0);
    });
  }

  const totalRevenueAll = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
  const totalAllExpenses = totalDirectExpenses + totalInstallmentExpenses;
  const netProfit = totalRevenueAll - totalAllExpenses;

  return {
    yearMonth,
    daysCount: reports.length,
    totalReportsCount,
    commissionConfig,
    categories,
    revenue: {
      ...categoryTotals,
      goi_mong: categoryTotals["goi_mong"] || 0,
      mi: categoryTotals["mi"] || 0,
      ngoai_gio: categoryTotals["ngoai_gio"] || 0,
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
  getDailySummary,
  getMonthlySummary
};
