const fetch = require("node-fetch");

/**
 * Tạo URL hình ảnh biểu đồ thống kê tháng qua QuickChart API
 * @param {Object} monthlySummary Thống kê doanh thu tháng
 * @returns {string} URL của hình ảnh biểu đồ QuickChart
 */
function generateMonthlyChartUrl(monthlySummary) {
  if (!monthlySummary || !monthlySummary.staffStats) {
    return null;
  }

  const staffNames = Object.keys(monthlySummary.staffStats);
  if (staffNames.length === 0) return null;

  const categories = monthlySummary.categories || [
    { key: "goi_mong", label: "Gội/Móng" },
    { key: "mi", label: "Mi/Xăm" },
    { key: "ngoai_gio", label: "Ngoài giờ" }
  ];

  // Palette màu chuyên nghiệp cho salon
  const colorPalette = [
    "rgba(255, 99, 132, 0.85)",  // Hồng / Đo đỏ
    "rgba(54, 162, 235, 0.85)",  // Xanh dương
    "rgba(255, 206, 86, 0.85)",  // Vàng cam
    "rgba(75, 192, 192, 0.85)",  // Xanh ngọc
    "rgba(153, 102, 255, 0.85)", // Tím
    "rgba(255, 159, 64, 0.85)"   // Cam
  ];

  const datasets = categories.map((cat, idx) => {
    const data = staffNames.map(name => {
      const stats = monthlySummary.staffStats[name];
      if (stats.categoryTotals && stats.categoryTotals[cat.key] !== undefined) {
        return Math.round((stats.categoryTotals[cat.key] || 0) / 1000); // Đơn vị nghìn (k)
      }
      // Fallback cho thuộc tính flat cũ
      return Math.round((stats[cat.key] || 0) / 1000);
    });

    const color = colorPalette[idx % colorPalette.length];
    return {
      label: `${cat.label} (k)`,
      data,
      backgroundColor: color,
      borderColor: color.replace("0.85", "1.0"),
      borderWidth: 1
    };
  });

  const chartConfig = {
    type: "bar",
    data: {
      labels: staffNames,
      datasets: datasets
    },
    options: {
      title: {
        display: true,
        text: `📊 DOANH SỐ THỢ THÁNG ${monthlySummary.monthStr || ""} (Đơn vị: 1.000đ)`,
        fontSize: 18,
        fontColor: "#333333"
      },
      legend: {
        display: true,
        position: "bottom"
      },
      scales: {
        xAxes: [{
          stacked: true,
          gridLines: { display: false }
        }],
        yAxes: [{
          stacked: true,
          ticks: {
            beginAtZero: true,
            callback: (val) => val.toLocaleString() + "k"
          }
        }]
      },
      plugins: {
        datalabels: {
          display: true,
          color: "#ffffff",
          font: { weight: "bold" }
        }
      }
    }
  };

  const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
  return `https://quickchart.io/chart?c=${encodedConfig}&w=700&h=400&bkg=white`;
}

module.exports = {
  generateMonthlyChartUrl
};
