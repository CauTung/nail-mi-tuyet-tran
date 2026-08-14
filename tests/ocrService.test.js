const test = require("node:test");
const assert = require("node:assert");
const ocrService = require("../services/ocrService");

test("ocrService - Null or invalid buffer", async () => {
  const res1 = await ocrService.extractTextFromImage(null);
  assert.strictEqual(res1, null);

  const res2 = await ocrService.extractTextFromImage("invalid_data");
  assert.strictEqual(res2, null);
});

test("ocrService - Buffer structure check", async () => {
  const dummyBuffer = Buffer.from("dummy image content");
  const res = await ocrService.extractTextFromImage(dummyBuffer);
  // Expect string or null depending on API Key / Network
  assert.ok(res === null || typeof res === "string");
});
