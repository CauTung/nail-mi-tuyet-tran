/**
 * Master Application Constants & Timeouts
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

module.exports = {
  TIME_MS: {
    SECOND,
    MINUTE,
    HOUR
  },
  TIMEOUTS: {
    // Thời gian hết hạn bản nháp báo cáo trong bộ nhớ (30 phút)
    DRAFT_EXPIRATION_MS: 30 * MINUTE,
    // Thời gian chờ đính chính/Sửa nhanh (15 phút)
    PENDING_EDIT_TTL_MS: 15 * MINUTE,
    // Thời gian tự động chốt lưu bản nháp nếu người dùng quên bấm nút (15 phút)
    AUTO_CONFIRM_DELAY_MS: 15 * MINUTE,
    // Thời gian gửi tin nhắn nhắc nhở chốt sổ (10 phút)
    AUTO_REMINDER_DELAY_MS: 10 * MINUTE,
    // Timeout gọi API AI Gemini đối với 1 ảnh (30 giây)
    AI_API_SINGLE_IMAGE_MS: 30 * SECOND,
    // Timeout gọi API AI Gemini đối với nhiều ảnh (60 giây)
    AI_API_MULTI_IMAGE_MS: 60 * SECOND
  },
  SCHEDULES: {
    // Giờ nhắc nhở báo cáo thu chi hàng ngày (20:00 Giờ Việt Nam)
    DAILY_REMINDER_HOUR: 20,
    DAILY_REMINDER_MINUTE: 0
  }
};
