const { createClient } = require("@supabase/supabase-js");
const env = require("./env");

let supabase = null;

if (env.supabaseUrl && env.supabaseKey) {
  supabase = createClient(env.supabaseUrl, env.supabaseKey);
  console.log("⚡ [SUPABASE] Kết nối Supabase Client thành công!");
} else {
  console.warn("⚠️ [SUPABASE] Chưa cấu hình SUPABASE_URL hoặc SUPABASE_KEY trong file .env!");
}

/**
 * Lấy instance Supabase client hiện tại
 */
function getSupabaseClient() {
  return supabase;
}

/**
 * Kiểm tra xem Supabase đã được kết nối hay chưa
 */
function isSupabaseConnected() {
  return Boolean(supabase);
}

module.exports = {
  supabase,
  getSupabaseClient,
  isSupabaseConnected
};
