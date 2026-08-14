const test = require("node:test");
const assert = require("node:assert");
const { getSystemPrompt } = require("../config/prompts");
const aiService = require("../services/aiService");

test("System Prompt Generation", () => {
  const customStaff = [
    { name: "Quỳnh Anh" },
    { name: "Huệ" }
  ];
  const prompt = getSystemPrompt(customStaff);

  assert.ok(typeof prompt === "string");
  assert.match(prompt, /Quỳnh Anh/);
  assert.match(prompt, /Huệ/);
  assert.match(prompt, /JSON/);
});

test("AI Service Daily Report Extractor Structure Check", async () => {
  assert.strictEqual(typeof aiService.extractDailyReport, "function");
});
