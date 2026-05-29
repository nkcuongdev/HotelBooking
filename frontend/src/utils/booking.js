export const formatBookingCode = (id) => {
  if (!id) return "#BK------";
  return `#BK-${String(id).slice(-6).toUpperCase()}`;
};
