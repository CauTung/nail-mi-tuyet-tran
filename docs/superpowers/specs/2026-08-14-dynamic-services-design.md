# Dynamic Service Categories & Custom Commission Design Spec

## 1. Overview
Transition the Nail Mi Tuyet Tran financial tracking system from fixed revenue fields (`goi_mong`, `mi`, `ngoai_gio`) to a dynamic category model. This allows the salon admin to dynamically add, edit, or remove service categories and set custom commission percentages directly via Telegram bot commands without modifying source code or database schemas.

## 2. Architecture & Data Structures

### 2.1 Configuration Schema (`data/commission_config.json` & `configRepository.js`)
The configuration repository will store service categories as a dynamic list:

```json
{
  "categories": [
    { "key": "goi_mong", "label": "Gội / Móng", "percent": 10 },
    { "key": "mi", "label": "Mi / Phun Xăm", "percent": 30 },
    { "key": "ngoai_gio", "label": "Ngoài Giờ / Tăng Ca", "percent": 50 }
  ]
}
```

### 2.2 Report Data Structure
Each staff record stores revenue as a dynamic key-value map:

```json
{
  "name": "Quỳnh Anh",
  "attendance_score": 1.0,
  "revenue": {
    "goi_mong": 300000,
    "mi": 200000,
    "san_pham": 150000
  }
}
```

### 2.3 Backwards Compatibility
Legacy reports containing flat or nested `goi_mong`, `mi`, `ngoai_gio` fields will automatically be parsed and mapped to the active category keys to ensure 100% data fidelity for past historical reports.

---

## 3. AI Extraction & System Prompt Generator (`services/aiService.js` & `config/prompts.js`)
When processing OCR photos or text reports:
1. `aiService.js` fetches active categories from `configRepository.getCommissionConfig()`.
2. A dynamic system prompt is constructed listing all active categories and their expected JSON keys.
3. Gemini Vision processes the handwriting/text and outputs `revenue: { [categoryKey]: amount }`.

---

## 4. Financial Calculation Engine (`services/financialService.js`)
- `getDailySummary(dateStr)` & `getMonthlySummary(yearMonth)` iterate over active category definitions.
- For each category key, total category revenue is aggregated.
- Commission is calculated per category: `Math.round(amount * (category.percent / 100))`.
- Total staff commission is the sum of commissions across all categories.

---

## 5. Reporting & UI (`ocrHandler.js`, `queryHandler.js`, `exportService.js`)
- **Telegram Preview & Monthly Summary**: Dynamically renders each service label with its revenue amount > 0.
- **Salary Sheet (`/luong`)**: Lists current commission percentages dynamically.
- **CSV Export (`exportService.js`)**: Dynamically generates columns for each active service category (both Revenue and Commission columns).

---

## 6. Admin Bot Commands (`bot/handlers/adminHandler.js`)
- `/categories`: View all active service categories, keys, and commission percentages.
- `/addcategory <key> "<Label>" <percent>`: Add a new service category.
- `/setcommission <key> <percent>`: Update the commission percentage for an existing category key.
- `/delcategory <key>`: Remove a service category from future reports.

---

## 7. Verification & Automated Testing Plan
- `tests/financialService.test.js` updated to verify:
  1. Backward compatibility with legacy report format.
  2. Calculation correctness with newly added custom categories.
  3. Dynamic CSV column generation in export service.
