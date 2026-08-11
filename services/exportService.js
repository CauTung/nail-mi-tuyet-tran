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

  let csvContent = "\uFEFF"; // UTF-8 BOM cho Excel mở tiếng Việt chuẩn
  csvContent += `Cấu hình hoa hồng % lương: Gội/Móng ${commissionConfig.goi_mong_percent}%, Mi/Phun xăm ${commissionConfig.mi_percent}%, Tăng ca ${commissionConfig.ngoai_gio_percent}%\n`;
  csvContent += "Ngày,Mã Báo Cáo,Tên Nhân Viên,Công (Score),Thời Gian / Ghi Chú Đi Muộn,Gội/Móng (VNĐ),Mi/Phun Xăm (VNĐ),Tăng Ca (VNĐ),Tổng Doanh Thu Lượt (VNĐ),Hoa Hồng Gội/Móng (VNĐ),Hoa Hồng Mi (VNĐ),Hoa Hồng Tăng Ca (VNĐ),Tổng Hoa Hồng Lượt (VNĐ),Khoản Chi Tiêu,Số Tiền Chi (VNĐ)\n";

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

  const summary = await financialService.getMonthlySummary(yearMonth);
  if (summary && summary.staffStats) {
    csvContent += "\n--- BẢNG TỔNG HỢP LƯƠNG & HOA HỒNG NHÂN VIÊN THÁNG ---\n";
    csvContent += "Tên Nhân Viên,Tổng Công (Score),Số Ngày Làm,Số Ngày Nghỉ,Số Lần Muộn,Tổng Phút Muộn,Tổng Gội/Móng (VNĐ),Tổng Mi/Phun Xăm (VNĐ),Tổng Tăng Ca (VNĐ),Tổng Doanh Thu NV (VNĐ),Lương % Gội/Móng,Lương % Mi,Lương % Tăng Ca,TỔNG LƯƠNG % HOA HỒNG DOANH THU (VNĐ)\n";
    Object.keys(summary.staffStats).forEach(name => {
      const st = summary.staffStats[name];
      csvContent += `"${name}",${st.total_score},${st.days_worked},${st.days_off},${st.days_late},${st.late_minutes},${st.total_goi_mong},${st.total_mi},${st.total_ngoai_gio},${st.total_revenue},${st.commission_goi_mong},${st.commission_mi},${st.commission_ngoai_gio},${st.total_commission}\n`;
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
