const test = require("node:test");
const assert = require("node:assert");
const chartService = require("../services/chartService");
const confirmHandler = require("../bot/handlers/confirmHandler");
const fs = require("fs");
const path = require("path");

test("Chart Service - generateMonthlyChartUrl", () => {
  const sampleSummary = {
    monthStr: "2026-08",
    categories: [
      { key: "goi_mong", label: "Gội/Móng" },
      { key: "mi", label: "Mi/Xăm" }
    ],
    staffStats: {
      "Quỳnh Anh": {
        categoryTotals: { goi_mong: 3000000, mi: 1500000 }
      },
      "Huệ": {
        categoryTotals: { goi_mong: 2000000, mi: 800000 }
      }
    }
  };

  const chartUrl = chartService.generateMonthlyChartUrl(sampleSummary);
  assert.ok(chartUrl);
  assert.ok(chartUrl.startsWith("https://quickchart.io/chart?c="));
  assert.ok(chartUrl.includes("Qu%E1%BB%B3nh%20Anh"));
});

test("Draft Persistence - File Save and Restore", () => {
  const sampleResult = { status: "success", report_date: "2026-09-05" };
  const draftId = confirmHandler.saveDraft(sampleResult, { inputType: "text" }, { telegram: {}, chatId: 99999 });

  const filePath = path.join(__dirname, "../data/pending_drafts.json");
  assert.ok(fs.existsSync(filePath));

  const raw = fs.readFileSync(filePath, "utf8");
  assert.ok(raw.includes("2026-09-05"));

  // Clean up test draft
  confirmHandler.deleteDraft(draftId);
});
