const test = require("node:test");
const assert = require("node:assert");
const configRepo = require("../db/repositories/configRepository");
const financialService = require("../services/financialService");
const reportRepo = require("../db/repositories/reportRepository");
const { getSystemPrompt } = require("../config/prompts");

test("Dynamic Categories - CRUD & Calculation Flow", async () => {
  // 1. Get initial config
  const initialConfig = await configRepo.getCommissionConfig();
  assert.ok(Array.isArray(initialConfig.categories));
  assert.ok(initialConfig.categories.length >= 3);

  // 2. Add new category: Gội dưỡng sinh (goi_duong_sinh) - 20%
  const updatedConfig = await configRepo.addCategory("goi_duong_sinh", "Gội dưỡng sinh", 20);
  assert.ok(updatedConfig.categories.some(c => c.key === "goi_duong_sinh" && c.percent === 20));

  // 3. System prompt verification
  const prompt = getSystemPrompt(["Quỳnh Anh"], updatedConfig.categories);
  assert.ok(prompt.includes("Gội dưỡng sinh"));
  assert.ok(prompt.includes("goi_duong_sinh"));

  // 4. Save sample report with new category revenue
  const sampleReport = {
    report_date: "2026-09-01",
    staff_data: [
      {
        name: "Quỳnh Anh",
        revenue: {
          goi_mong: 100000,
          mi: 200000,
          ngoai_gio: 50000,
          goi_duong_sinh: 300000
        },
        attendance_score: 1.0
      }
    ],
    expenses_data: []
  };

  const saved = await reportRepo.saveReport(sampleReport, { inputType: "text" }, "2026-09-01");
  assert.ok(saved);

  // 5. Monthly Summary calculation
  const summary = await financialService.getMonthlySummary("2026-09");
  assert.ok(summary);
  assert.equal(summary.revenue.goi_duong_sinh, 300000);

  const qaStats = summary.staffStats["Quỳnh Anh"];
  assert.ok(qaStats);
  assert.equal(qaStats.categoryTotals["goi_duong_sinh"], 300000);
  assert.equal(qaStats.categoryCommissions["goi_duong_sinh"], 60000);

  // Clean up added category for test isolation
  await configRepo.removeCategory("goi_duong_sinh");
});
