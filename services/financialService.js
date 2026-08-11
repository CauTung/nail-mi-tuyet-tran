const reportRepo = require("../db/repositories/reportRepository");
const configRepo = require("../db/repositories/configRepository");
const installmentRepo = require("../db/repositories/installmentRepository");

async function getDailySummary(dateStr) {
  const reports = await reportRepo.getDailyReports(dateStr);
  if (!reports || reports.length === 0) return null;

  let totalGoiMong = 0;
  let totalMi = 0;
  let totalNgoaiGio = 0;
  let totalExpenses = 0;
  const staffStats = {};
  const expensesList = [];
  const deletedItemsList = [];

  reports.forEach(r => {
    const parsed = r.parsed_result || {};
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

async function getMonthlySummary(yearMonth) {
  const reports = await reportRepo.getMonthlyReportsList(yearMonth);
  const commissionConfig = await configRepo.getCommissionConfig();

  let totalRevenueGoiMong = 0;
  let totalRevenueMi = 0;
  let totalRevenueNgoaiGio = 0;
  let totalDirectExpenses = 0;
  let totalReportsCount = reports.length;
  const staffStats = {};

  reports.forEach(rep => {
    const parsed = rep.parsed_result || {};

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

  const activeInstallments = await installmentRepo.getActiveInstallmentsForMonth(yearMonth);
  let totalInstallmentExpenses = 0;
  activeInstallments.forEach(ins => {
    totalInstallmentExpenses += ins.monthly_amount;
  });

  const totalRevenueAll = totalRevenueGoiMong + totalRevenueMi + totalRevenueNgoaiGio;
  const totalAllExpenses = totalDirectExpenses + totalInstallmentExpenses;
  const netProfit = totalRevenueAll - totalAllExpenses;

  return {
    yearMonth,
    daysCount: reports.length,
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

module.exports = {
  getDailySummary,
  getMonthlySummary
};
