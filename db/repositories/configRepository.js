const fs = require("fs");
const path = require("path");
const { supabase, isSupabaseConnected } = require("../../config/supabase");

const DATA_DIR = path.join(__dirname, "../../data");
const COMMISSION_FILE = path.join(DATA_DIR, "commission_config.json");

const DEFAULT_CATEGORIES = [
  { key: "goi_mong", label: "Gội / Móng", percent: 10 },
  { key: "mi", label: "Mi / Phun Xăm", percent: 30 },
  { key: "ngoai_gio", label: "Ngoài Giờ / Tăng Ca", percent: 50 }
];

function ensureLocalFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(COMMISSION_FILE)) {
    fs.writeFileSync(COMMISSION_FILE, JSON.stringify({ categories: DEFAULT_CATEGORIES }, null, 2), "utf-8");
  }
}

function normalizeConfig(data) {
  let categories = DEFAULT_CATEGORIES;
  if (data && Array.isArray(data.categories) && data.categories.length > 0) {
    categories = data.categories;
  } else if (data && (data.goi_mong_percent !== undefined || data.mi_percent !== undefined)) {
    categories = [
      { key: "goi_mong", label: "Gội / Móng", percent: data.goi_mong_percent ?? 10 },
      { key: "mi", label: "Mi / Phun Xăm", percent: data.mi_percent ?? 30 },
      { key: "ngoai_gio", label: "Ngoài Giờ / Tăng Ca", percent: data.ngoai_gio_percent ?? 50 }
    ];
  }

  const gm = categories.find(c => c.key === "goi_mong")?.percent ?? 10;
  const mi = categories.find(c => c.key === "mi")?.percent ?? 30;
  const ng = categories.find(c => c.key === "ngoai_gio")?.percent ?? 50;

  return {
    categories,
    goi_mong_percent: gm,
    mi_percent: mi,
    ngoai_gio_percent: ng
  };
}

async function getCommissionConfig() {
  if (isSupabaseConnected()) {
    try {
      const { data, error } = await supabase.from("commission_config").select("*").eq("id", 1).maybeSingle();
      if (!error && data) {
        return normalizeConfig(data.raw_config || data);
      }
    } catch (err) {
      console.error("Lỗi lấy cấu hình hoa hồng từ Supabase:", err);
    }
  }

  ensureLocalFile();
  try {
    const raw = JSON.parse(fs.readFileSync(COMMISSION_FILE, "utf-8"));
    return normalizeConfig(raw);
  } catch (err) {
    return normalizeConfig(null);
  }
}

async function saveCommissionConfig(configInput) {
  let categoriesToSave = [];
  if (Array.isArray(configInput)) {
    categoriesToSave = configInput;
  } else if (Array.isArray(configInput?.categories)) {
    categoriesToSave = configInput.categories;
  } else {
    const current = await getCommissionConfig();
    categoriesToSave = [...current.categories];

    if (configInput.goi_mong_percent !== undefined) {
      const target = categoriesToSave.find(c => c.key === "goi_mong");
      if (target) target.percent = Number(configInput.goi_mong_percent);
    }
    if (configInput.mi_percent !== undefined) {
      const target = categoriesToSave.find(c => c.key === "mi");
      if (target) target.percent = Number(configInput.mi_percent);
    }
    if (configInput.ngoai_gio_percent !== undefined) {
      const target = categoriesToSave.find(c => c.key === "ngoai_gio");
      if (target) target.percent = Number(configInput.ngoai_gio_percent);
    }
  }

  const normalized = normalizeConfig({ categories: categoriesToSave });

  if (isSupabaseConnected()) {
    try {
      await supabase.from("commission_config").upsert({
        id: 1,
        goi_mong_percent: normalized.goi_mong_percent,
        mi_percent: normalized.mi_percent,
        ngoai_gio_percent: normalized.ngoai_gio_percent,
        raw_config: { categories: normalized.categories },
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error("Lỗi lưu cấu hình hoa hồng vào Supabase:", err);
    }
  }

  ensureLocalFile();
  fs.writeFileSync(COMMISSION_FILE, JSON.stringify({ categories: normalized.categories }, null, 2), "utf-8");
  return normalized;
}

async function addCategory(key, label, percent) {
  const current = await getCommissionConfig();
  const existing = current.categories.find(c => c.key.toLowerCase() === key.toLowerCase());
  if (existing) {
    existing.label = label || existing.label;
    existing.percent = Number(percent);
  } else {
    current.categories.push({
      key: key.toLowerCase().replace(/\s+/g, "_"),
      label: label || key,
      percent: Number(percent)
    });
  }
  return await saveCommissionConfig(current.categories);
}

async function removeCategory(key) {
  const current = await getCommissionConfig();
  const updatedCategories = current.categories.filter(c => c.key.toLowerCase() !== key.toLowerCase());
  return await saveCommissionConfig(updatedCategories);
}

async function setCategoryPercent(key, percent) {
  const current = await getCommissionConfig();
  const target = current.categories.find(c => c.key.toLowerCase() === key.toLowerCase());
  if (!target) {
    throw new Error(`Không tìm thấy dịch vụ có mã key: "${key}"`);
  }
  target.percent = Number(percent);
  return await saveCommissionConfig(current.categories);
}

module.exports = {
  getCommissionConfig,
  saveCommissionConfig,
  addCategory,
  removeCategory,
  setCategoryPercent,
  DEFAULT_CATEGORIES
};
