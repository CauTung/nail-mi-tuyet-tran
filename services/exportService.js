const fs = require("fs");
const path = require("path");
const reportRepo = require("../db/repositories/reportRepository");
const configRepo = require("../db/repositories/configRepository");
const financialService = require("./financialService");

const DATA_DIR = path.join(__dirname, "../data");

async function exportMonthlyCsv(yearMonth) {
  const reports = await reportRepo.getMonthlyReportsList(yearMonth);
  if (!reports || reports.length === 0) return null;

  const commissionConfig = await configRepo.getCommissionConfig();
  const categories = commissionConfig.categories || configRepo.DEFAULT_CATEGORIES;

  let csvContent = "\uFEFF"; // UTF-8 BOM cho Excel mở tiếng Việt chuẩn
  const configHeaderStr = categories.map(c => `${c.label} ${c.percent}%`).join(", ");
  csvContent += `Cấu hình hoa hồng % lương: ${configHeaderStr}\n`;

  const catRevHeaders = categories.map(c => `"${c.label} (VNĐ)"`).join(",");
  const catCommHeaders = categories.map(c => `"Hoa Hồng ${c.label} (VNĐ)"`).join(",");
  csvContent += `Ngày,Mã Báo Cáo,Tên Nhân Viên,Công (Score),Thời Gian / Ghi Chú Đi Muộn,${catRevHeaders},Tổng Doanh Thu Lượt (VNĐ),${catCommHeaders},Tổng Hoa Hồng Lượt (VNĐ),Khoản Chi Tiêu,Số Tiền Chi (VNĐ)\n`;

  reports.forEach(r => {
    const date = r.date;
    const repId = r.id;
    const parsed = r.parsed_result || {};

    const staffData = parsed.staff_data || [];
    const expensesData = parsed.expenses_data || [];
    const maxRows = Math.max(staffData.length, expensesData.length, 1);

    for (let i = 0; i < maxRows; i++) {
      const s = staffData[i] || {};
      const e = expensesData[i] || {};

      const sName = s.name ? `"${s.name}"` : "";
      const sScore = s.attendance_score !== undefined ? s.attendance_score : "";
      const sAttendance = s.attendance_description ? `"${s.attendance_description.replace(/"/g, '""')}"` : "";

      const revVals = [];
      const commVals = [];
      let sTotal = 0;
      let commTotal = 0;

      categories.forEach(cat => {
        let val = 0;
        if (typeof s.revenue === "object" && s.revenue !== null) {
          val = Number(s.revenue[cat.key]) || 0;
        }
        if (!val && cat.key === "goi_mong") val = Number(s.goi_mong || s.goi || 0);
        if (!val && cat.key === "mi") val = Number(s.mi || s.xam || 0);
        if (!val && cat.key === "ngoai_gio") val = Number(s.ngoai_gio || s.tang_ca || 0);

        const comm = s.name ? Math.round(val * (cat.percent / 100)) : 0;
        revVals.push(val);
        commVals.push(comm);

        sTotal += val;
        commTotal += comm;
      });

      const eNotes = e.notes ? `"${e.notes.replace(/"/g, '""')}"` : "";
      const eAmount = e.amount || 0;

      csvContent += `${date},${repId},${sName},${sScore},${sAttendance},${revVals.join(",")},${sTotal},${commVals.join(",")},${commTotal},${eNotes},${eAmount}\n`;
    }
  });

  const summary = await financialService.getMonthlySummary(yearMonth);
  if (summary && summary.staffStats) {
    csvContent += "\n--- BẢNG TỔNG HỢP LƯƠNG & HOA HỒNG NHÂN VIÊN THÁNG ---\n";
    const sumRevHeaders = categories.map(c => `"Tổng ${c.label} (VNĐ)"`).join(",");
    const sumCommHeaders = categories.map(c => `"Lương % ${c.label}"`).join(",");
    csvContent += `Tên Nhân Viên,Tổng Công (Score),Số Ngày Làm,Số Ngày Nghỉ,Số Lần Muộn,Tổng Phút Muộn,${sumRevHeaders},Tổng Doanh Thu NV (VNĐ),${sumCommHeaders},TỔNG LƯƠNG % HOA HỒNG DOANH THU (VNĐ)\n`;
    
    Object.keys(summary.staffStats).forEach(name => {
      const st = summary.staffStats[name];
      const revCols = categories.map(c => st.categoryTotals[c.key] || 0).join(",");
      const commCols = categories.map(c => st.categoryCommissions[c.key] || 0).join(",");
      csvContent += `"${name}",${st.total_score},${st.days_worked},${st.days_off},${st.days_late},${st.late_minutes},${revCols},${st.total_revenue},${commCols},${st.total_commission}\n`;
    });
  }

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const exportPath = path.join(DATA_DIR, `BaoCao_NailMi_TuyetTran_${yearMonth}.csv`);
  fs.writeFileSync(exportPath, csvContent, "utf-8");
  return exportPath;
}

module.exports = {
  exportMonthlyCsv
};
