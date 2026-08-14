const { createClient } = require("@supabase/supabase-js");
const env = require("./env");

let supabase = null;

if (env.supabaseUrl && env.supabaseKey) {
  supabase = createClient(env.supabaseUrl, env.supabaseKey);
  console.log(`⚡ [SUPABASE] Đã khởi tạo Supabase Client URL: ${env.supabaseUrl}`);
  // Thực hiện test ping thực tế qua HTTP
  supabase.from("staff").select("id", { count: "exact", head: true })
    .then(({ error }) => {
      if (error) {
        console.warn(`⚠️ [SUPABASE PING FAILED] Không thể truy vấn Supabase (${error.message})`);
      } else {
        console.log("✅ [SUPABASE PING SUCCESS] Kết nối mạng và truy vấn CSDL Supabase hoàn toàn bình thường!");
      }
    })
    .catch(err => {
      console.error(`❌ [SUPABASE NETWORK ERROR] Lỗi kết nối mạng Supabase: ${err.message}`);
    });
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
