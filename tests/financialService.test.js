const test = require("node:test");
const assert = require("node:assert");
const financialService = require("../services/financialService");
const reportRepo = require("../db/repositories/reportRepository");

test("financialService - getMonthlySummary with sample draft data", async () => {
  const sampleReport = {
    report_date: "2026-08-14",
    staff_data: [
      { name: "Quỳnh Anh", goi_mong: 300000, mi: 200000, attendance_score: 1.0 }
    ],
    expenses_data: [
      { notes: "Nước đá", amount: 50000 }
    ]
  };

  const saved = await reportRepo.saveReport(sampleReport, { inputType: "text" }, "2026-08-14");
  assert.ok(saved);

  const monthlySummary = await financialService.getMonthlySummary("2026-08");
  assert.ok(monthlySummary);
  assert.ok(monthlySummary.daysCount > 0);
  assert.ok(monthlySummary.revenue.total >= 500000);
  assert.ok(monthlySummary.expenses.total >= 50000);
});
