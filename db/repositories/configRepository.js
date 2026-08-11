const fs = require("fs");
const path = require("path");
const { supabase, isSupabaseConnected } = require("../../config/supabase");

const DATA_DIR = path.join(__dirname, "../../data");
const COMMISSION_FILE = path.join(DATA_DIR, "commission_config.json");
const DEFAULT_COMMISSION = {
  goi_mong_percent: 10,
  mi_percent: 30,
  ngoai_gio_percent: 50
};

function ensureLocalFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(COMMISSION_FILE)) {
    fs.writeFileSync(COMMISSION_FILE, JSON.stringify(DEFAULT_COMMISSION, null, 2), "utf-8");
  }
}

async function getCommissionConfig() {
  if (isSupabaseConnected()) {
    try {
      const { data, error } = await supabase.from("commission_config").select("*").eq("id", 1).single();
      if (!error && data) {
        return {
          goi_mong_percent: data.goi_mong_percent,
          mi_percent: data.mi_percent,
          ngoai_gio_percent: data.ngoai_gio_percent
        };
      }
    } catch (err) {
      console.error("Lỗi lấy cấu hình hoa hồng từ Supabase:", err);
    }
  }

  ensureLocalFile();
  try {
    const data = fs.readFileSync(COMMISSION_FILE, "utf-8");
    return { ...DEFAULT_COMMISSION, ...JSON.parse(data) };
  } catch (err) {
    return DEFAULT_COMMISSION;
  }
}

async function saveCommissionConfig(config) {
  const current = await getCommissionConfig();
  const updated = {
    goi_mong_percent: config.goi_mong_percent !== undefined ? Number(config.goi_mong_percent) : current.goi_mong_percent,
    mi_percent: config.mi_percent !== undefined ? Number(config.mi_percent) : current.mi_percent,
    ngoai_gio_percent: config.ngoai_gio_percent !== undefined ? Number(config.ngoai_gio_percent) : current.ngoai_gio_percent
  };

  if (isSupabaseConnected()) {
    try {
      await supabase.from("commission_config").upsert({
        id: 1,
        ...updated,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error("Lỗi lưu cấu hình hoa hồng vào Supabase:", err);
    }
  }

  ensureLocalFile();
  fs.writeFileSync(COMMISSION_FILE, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}

module.exports = {
  getCommissionConfig,
  saveCommissionConfig
};
