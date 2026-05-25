export const formatVnd = (value) => {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("vi-VN")} VNĐ`;
};

export const formatCompactVnd = (value) => {
  const amount = Number(value || 0);
  if (amount === 0) return "0 VNĐ";
  if (amount >= 1000000000) return `${(amount / 1000000000).toFixed(1)} tỷ`;
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)} triệu`;
  return formatVnd(amount);
};
