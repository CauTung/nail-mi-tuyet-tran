const { createClient } = require("@supabase/supabase-js");
const env = require("./env");

let supabase = null;

if (env.supabaseUrl && env.supabaseKey) {
  supabase = createClient(env.supabaseUrl, env.supabaseKey);
  console.log(`⚡ [SUPABASE] Đã khởi tạo Supabase Client (Target: ${env.supabaseUrl})`);
  // Thực hiện test ping thực tế qua HTTP
  supabase.from("staff").select("id", { count: "exact", head: true })
    .then(({ error }) => {
      if (error) {
        console.warn(`⚠️ [SUPABASE PING FAILED] Không thể truy vấn tới '${env.supabaseUrl}'. Chi tiết: ${error.message}`);
        console.warn(`💡 Vui lòng kiểm tra lại SUPABASE_URL trong biến môi trường Render (phải có https:// và đúng tên domain .supabase.co).`);
      } else {
        console.log("✅ [SUPABASE PING SUCCESS] Kết nối mạng và truy vấn CSDL Supabase hoàn toàn bình thường!");
      }
    })
    .catch(err => {
      console.error(`❌ [SUPABASE NETWORK ERROR] Lỗi kết nối mạng tới '${env.supabaseUrl}': ${err.message}`);
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
