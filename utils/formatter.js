/**
 * Utility module for standardizing formatting of currency, dates, percentages
 */

function formatMoney(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat("vi-VN").format(num) + "đ";
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function formatPercent(value) {
  const num = Number(value) || 0;
  return `${num}%`;
}

module.exports = {
  formatMoney,
  formatDate,
  formatPercent
};
