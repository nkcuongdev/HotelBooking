import { useState, useEffect } from "react";
import {
  Search,
  MoreVertical,
  Eye,
  CheckCircle,
  XCircle,
  X,
  Loader2,
  CreditCard,
  LogIn,
  LogOut,
} from "lucide-react";
import api from "../../services/api";
import { formatVnd } from "../../utils/currency";

// ─── Normalize ────────────────────────────────────────────────────────────────
const normalizeBooking = (b) => ({
  ...b,
  id: b._id || b.id,
  guest: b.userId?.name || b.guestName || b.guest || "N/A",
  email: b.userId?.email || b.guestEmail || b.email || "",
  hotel: b.hotelId?.name || b.hotel?.name || b.hotelName || b.hotel || "",
  room: b.roomId?.title || b.room?.title || b.roomType || b.room || "",
  checkIn: b.checkInDate ? b.checkInDate.slice(0, 10) : b.checkIn || "",
  checkOut: b.checkOutDate ? b.checkOutDate.slice(0, 10) : b.checkOut || "",
  guests: b.numberOfGuests || b.guests || 1,
  status: b.status || "pending",
  amount: b.totalPrice || b.amount || 0,
  paymentMethod: b.paymentMethod || "cash",
  paymentStatus: b.paymentStatus || "pending",
});

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending: { label: "Chờ xác nhận", color: "bg-yellow-100 text-yellow-700" },
  confirmed: { label: "Đã xác nhận", color: "bg-blue-100 text-blue-700" },
  checked_in: { label: "Đang ở", color: "bg-purple-100 text-purple-700" },
  completed: { label: "Hoàn thành", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Đã hủy", color: "bg-red-100 text-red-700" },
};

const PAYMENT_CONFIG = {
  pending: { label: "Chưa thanh toán", color: "text-yellow-600" },
  paid: { label: "Đã thanh toán", color: "text-green-600" },
  failed: { label: "Thất bại", color: "text-red-600" },
  refunded: { label: "Đã hoàn tiền", color: "text-gray-500" },
};

const PAYMENT_METHOD_LABELS = {
  cash: "Thanh toán tại khách sạn",
  credit_card: "Thẻ tín dụng",
  debit_card: "Thẻ ghi nợ",
  paypal: "PayPal",
  vnpay: "VNPAY",
  momo: "MoMo",
  bank_transfer: "Chuyển khoản",
};

const canConfirmBooking = (booking) =>
  booking.paymentMethod === "cash" || booking.paymentStatus === "paid";

const CHECK_IN_HOUR = 14;
const CHECK_OUT_HOUR = 12;

const getStayDateTime = (date, hour) => {
  if (!date) return null;
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return null;
  value.setHours(hour, 0, 0, 0);
  return value;
};

const formatStayTime = (date) =>
  date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const getCheckInBlockReason = (booking) => {
  const earliestCheckIn = getStayDateTime(booking.checkIn, CHECK_IN_HOUR);
  if (earliestCheckIn && new Date() < earliestCheckIn) {
    return `Check-in từ ${formatStayTime(earliestCheckIn)}`;
  }
  return "";
};

const getCheckoutBlockReason = (booking) => {
  const earliestCheckOut = getStayDateTime(booking.checkOut, CHECK_OUT_HOUR);
  if (earliestCheckOut && new Date() < earliestCheckOut) {
    return `Checkout từ ${formatStayTime(earliestCheckOut)}`;
  }
  return "";
};

// ─── Component ────────────────────────────────────────────────────────────────
const BookingsManagement = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [hotelFilter, setHotelFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await api.getBookings({ limit: 500, sort: "-createdAt" });
      const data = res.data || res.bookings || res || [];
      setBookings((Array.isArray(data) ? data : []).map(normalizeBooking));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Actions ────────────────────────────────────────────────────────────────
  const handleAction = async (action, id, label) => {
    setActiveDropdown(null);
    if (
      action === "cancel" &&
      !window.confirm(`Bạn có chắc muốn hủy đặt phòng này?`)
    )
      return;

    setActionLoading(id);
    try {
      let res;
      let updatedFields = {};

      // Cancel validation: only PENDING or CONFIRMED (before check-in date)
      if (action === "cancel") {
        const booking = bookings.find((b) => b.id === id);
        if (booking && booking.status === "confirmed") {
          const checkInDate = new Date(booking.checkIn || booking.checkInDate);
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          if (checkInDate <= now) {
            alert(
              "Không thể hủy đặt phòng đã xác nhận khi đã qua ngày check-in.",
            );
            return;
          }
        }
      }

      switch (action) {
        case "confirm":
          res = await api.confirmBooking(id);
          updatedFields = { status: "confirmed" };
          break;
        case "checkin":
          res = await api.checkInBooking(id);
          updatedFields = { status: "checked_in" };
          break;
        case "checkout":
          res = await api.checkOutBooking(id);
          updatedFields = { status: "completed" };
          // If pay at hotel, mark as paid
          if (bookings.find((b) => b.id === id)?.paymentMethod === "cash") {
            updatedFields.paymentStatus = "paid";
          }
          break;
        case "cancel":
          res = await api.cancelBooking(id);
          updatedFields = { status: "cancelled" };
          // If was paid, mark as refunded
          if (
            ["paid"].includes(bookings.find((b) => b.id === id)?.paymentStatus)
          ) {
            updatedFields.paymentStatus = "refunded";
          }
          break;
        case "mark_paid":
          res = await api.updateBooking(id, { paymentStatus: "paid" });
          updatedFields = { paymentStatus: "paid" };
          break;
        default:
          return;
      }

      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...updatedFields } : b)),
      );
      if (selectedBooking?.id === id) {
        setSelectedBooking((prev) => ({ ...prev, ...updatedFields }));
      }
    } catch (err) {
      alert(err.message || `${label || "Thao tác"} thất bại`);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Filters ────────────────────────────────────────────────────────────────
  const hotelNames = [...new Set(bookings.map((b) => b.hotel).filter(Boolean))];

  const filteredBookings = bookings.filter((b) => {
    const shortCode = `BK-${b.id?.slice(-6).toUpperCase()}`;
    const matchSearch =
      b.guest.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shortCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.hotel.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter ? b.status === statusFilter : true;
    const matchPayment = paymentFilter
      ? b.paymentStatus === paymentFilter
      : true;
    const matchHotel = hotelFilter ? b.hotel === hotelFilter : true;
    const matchFrom = dateFrom ? b.checkIn >= dateFrom : true;
    const matchTo = dateTo ? b.checkOut <= dateTo : true;
    return (
      matchSearch &&
      matchStatus &&
      matchPayment &&
      matchHotel &&
      matchFrom &&
      matchTo
    );
  });

  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const paginatedBookings = filteredBookings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const hasActiveFilters =
    statusFilter || paymentFilter || hotelFilter || dateFrom || dateTo;

  const clearAllFilters = () => {
    setStatusFilter("");
    setPaymentFilter("");
    setHotelFilter("");
    setDateFrom("");
    setDateTo("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  // ─── Stats ───────────────────────────────────────────────────────────────────
  const stats = {
    total: bookings.length,
    pending: bookings.filter((b) => b.status === "pending").length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    checkedIn: bookings.filter((b) => b.status === "checked_in").length,
    completed: bookings.filter((b) => b.status === "completed").length,
    revenue: bookings
      .filter((b) => b.paymentStatus === "paid")
      .reduce((a, b) => a + b.amount, 0),
  };

  return (
    <div className="space-y-6" onClick={() => setActiveDropdown(null)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Quản lý đặt phòng
          </h1>
          <p className="text-gray-500 mt-1">
            Quản lý toàn bộ đơn đặt phòng theo quy trình
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Tổng đơn", value: stats.total, color: "text-gray-900" },
          {
            label: "Chờ xác nhận",
            value: stats.pending,
            color: "text-yellow-600",
          },
          {
            label: "Đã xác nhận",
            value: stats.confirmed,
            color: "text-blue-600",
          },
          {
            label: "Đang ở",
            value: stats.checkedIn,
            color: "text-purple-600",
          },
          {
            label: "Hoàn thành",
            value: stats.completed,
            color: "text-green-600",
          },
          {
            label: "Doanh thu",
            value: formatVnd(stats.revenue),
            color: "text-[#FF385C]",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl p-4 border border-gray-100"
          >
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Tìm theo khách, mã đặt phòng, khách sạn..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C] cursor-pointer"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ xác nhận</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="checked_in">Đang ở</option>
            <option value="completed">Hoàn thành</option>
            <option value="cancelled">Đã hủy</option>
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C] cursor-pointer"
          >
            <option value="">Tất cả thanh toán</option>
            <option value="pending">Chưa thanh toán</option>
            <option value="paid">Đã thanh toán</option>
            <option value="failed">Thất bại</option>
            <option value="refunded">Đã hoàn tiền</option>
          </select>
          <select
            value={hotelFilter}
            onChange={(e) => {
              setHotelFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C] cursor-pointer"
          >
            <option value="">Tất cả khách sạn</option>
            {hotelNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 whitespace-nowrap">
              Từ ngày:
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 whitespace-nowrap">
              Đến ngày:
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C]"
            />
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-[#FF385C] border border-[#FF385C] rounded-lg hover:bg-[#FF385C]/5 transition-colors cursor-pointer"
            >
              <X size={16} /> Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-[#FF385C]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-4 font-medium">Mã / Khách hàng</th>
                  <th className="px-5 py-4 font-medium hidden md:table-cell">
                    Khách sạn / Phòng
                  </th>
                  <th className="px-5 py-4 font-medium hidden lg:table-cell">
                    Ngày
                  </th>
                  <th className="px-5 py-4 font-medium">Trạng thái</th>
                  <th className="px-5 py-4 font-medium text-right">
                    Tiền / Thanh toán
                  </th>
                  <th className="px-5 py-4 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedBookings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-gray-400"
                    >
                      Không có đặt phòng nào
                    </td>
                  </tr>
                ) : (
                  paginatedBookings.map((booking) => {
                    const sc =
                      STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
                    const pc =
                      PAYMENT_CONFIG[booking.paymentStatus] ||
                      PAYMENT_CONFIG.pending;
                    const isLoading = actionLoading === booking.id;
                    const checkInBlockReason = getCheckInBlockReason(booking);
                    const checkoutBlockReason = getCheckoutBlockReason(booking);
                    return (
                      <tr
                        key={booking.id}
                        className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-5 py-4">
                          <p className="font-mono font-semibold text-gray-700 text-xs">
                            #BK-{booking.id?.slice(-6).toUpperCase()}
                          </p>
                          <p className="text-sm font-medium text-gray-800 mt-0.5">
                            {booking.guest}
                          </p>
                          <p className="text-xs text-gray-400">
                            {booking.email}
                          </p>
                        </td>
                        <td className="px-5 py-4 hidden md:table-cell">
                          <p className="text-sm text-gray-900">
                            {booking.hotel}
                          </p>
                          <p className="text-xs text-gray-500">
                            {booking.room}
                          </p>
                        </td>
                        <td className="px-5 py-4 hidden lg:table-cell text-sm">
                          <p className="text-gray-900">{booking.checkIn}</p>
                          <p className="text-gray-400 text-xs">
                            → {booking.checkOut}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {booking.guests} khách
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${sc.color}`}
                          >
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <p className="font-semibold text-gray-900">
                            {formatVnd(booking.amount)}
                          </p>
                          <p className={`text-xs mt-0.5 ${pc.color}`}>
                            {pc.label}
                          </p>
                          <p className="text-xs text-gray-400">
                            {PAYMENT_METHOD_LABELS[booking.paymentMethod] ||
                              booking.paymentMethod}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <div
                            className="flex items-center justify-end relative"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isLoading ? (
                              <Loader2
                                size={18}
                                className="animate-spin text-gray-400"
                              />
                            ) : (
                              <button
                                onClick={() =>
                                  setActiveDropdown(
                                    activeDropdown === booking.id
                                      ? null
                                      : booking.id,
                                  )
                                }
                                className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer"
                              >
                                <MoreVertical
                                  size={18}
                                  className="text-gray-500"
                                />
                              </button>
                            )}

                            {activeDropdown === booking.id && (
                              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                <button
                                  onClick={() => {
                                    setSelectedBooking(booking);
                                    setActiveDropdown(null);
                                  }}
                                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                                >
                                  <Eye size={15} /> Xem chi tiết
                                </button>

                                {/* Workflow actions */}
                                {booking.status === "pending" && canConfirmBooking(booking) && (
                                  <button
                                    onClick={() =>
                                      handleAction(
                                        "confirm",
                                        booking.id,
                                        "Xác nhận",
                                      )
                                    }
                                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 cursor-pointer"
                                  >
                                    <CheckCircle size={15} /> Xác nhận đặt phòng
                                  </button>
                                )}
                                {booking.status === "pending" && !canConfirmBooking(booking) && (
                                  <div className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-400">
                                    <CreditCard size={15} /> Chờ khách thanh toán
                                  </div>
                                )}
                                {booking.status === "confirmed" && !checkInBlockReason && (
                                  <button
                                    onClick={() =>
                                      handleAction(
                                        "checkin",
                                        booking.id,
                                        "Check-in",
                                      )
                                    }
                                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 cursor-pointer"
                                  >
                                    <LogIn size={15} /> Check-in
                                  </button>
                                )}
                                {booking.status === "confirmed" && checkInBlockReason && (
                                  <div className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-400">
                                    <LogIn size={15} /> {checkInBlockReason}
                                  </div>
                                )}
                                {booking.status === "checked_in" && !checkoutBlockReason && (
                                  <button
                                    onClick={() =>
                                      handleAction(
                                        "checkout",
                                        booking.id,
                                        "Hoàn thành",
                                      )
                                    }
                                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-green-600 hover:bg-green-50 cursor-pointer"
                                  >
                                    <LogOut size={15} /> Hoàn thành
                                  </button>
                                )}
                                {booking.status === "checked_in" && checkoutBlockReason && (
                                  <div className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-400">
                                    <LogOut size={15} /> {checkoutBlockReason}
                                  </div>
                                )}

                                {/* Mark paid (for cash pending) */}
                                {booking.paymentMethod === "cash" &&
                                  booking.paymentStatus === "pending" &&
                                  booking.status !== "cancelled" && (
                                    <button
                                      onClick={() =>
                                        handleAction(
                                          "mark_paid",
                                          booking.id,
                                          "Đánh dấu đã thanh toán",
                                        )
                                      }
                                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-green-700 hover:bg-green-50 cursor-pointer"
                                    >
                                      <CreditCard size={15} /> Đánh dấu đã thanh
                                      toán
                                    </button>
                                  )}

                                {/* Cancel – only for pending or confirmed (before check-in) */}
                                {["pending", "confirmed"].includes(
                                  booking.status,
                                ) && (
                                  <>
                                    <div className="border-t border-gray-100 my-1" />
                                    <button
                                      onClick={() =>
                                        handleAction(
                                          "cancel",
                                          booking.id,
                                          "Hủy",
                                        )
                                      }
                                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer"
                                    >
                                      <XCircle size={15} /> Hủy đặt phòng
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Hiển thị {paginatedBookings.length} / {filteredBookings.length}{" "}
              đặt phòng
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
              >
                Trước
              </button>
              {Array.from(
                { length: Math.min(totalPages, 7) },
                (_, i) => i + 1,
              ).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 text-sm rounded-lg cursor-pointer ${
                    currentPage === page
                      ? "bg-[#FF385C] text-white"
                      : "border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedBooking && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedBooking(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Chi tiết đặt phòng
              </h2>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-3 text-sm">
              {[
                { label: "Mã đặt phòng", value: `#BK-${selectedBooking.id?.slice(-6).toUpperCase()}` },
                { label: "Khách hàng", value: selectedBooking.guest },
                { label: "Email", value: selectedBooking.email },
                { label: "Khách sạn", value: selectedBooking.hotel },
                { label: "Loại phòng", value: selectedBooking.room },
                { label: "Ngày nhận phòng", value: selectedBooking.checkIn },
                { label: "Ngày trả phòng", value: selectedBooking.checkOut },
                { label: "Số khách", value: `${selectedBooking.guests} người` },
                {
                  label: "Phương thức TT",
                  value:
                    PAYMENT_METHOD_LABELS[selectedBooking.paymentMethod] ||
                    selectedBooking.paymentMethod,
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-900">{value}</span>
                </div>
              ))}

              <div className="flex justify-between">
                <span className="text-gray-500">Trạng thái đơn</span>
                <span
                  className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${(STATUS_CONFIG[selectedBooking.status] || STATUS_CONFIG.pending).color}`}
                >
                  {
                    (
                      STATUS_CONFIG[selectedBooking.status] ||
                      STATUS_CONFIG.pending
                    ).label
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Thanh toán</span>
                <span
                  className={`text-xs font-medium ${(PAYMENT_CONFIG[selectedBooking.paymentStatus] || PAYMENT_CONFIG.pending).color}`}
                >
                  {
                    (
                      PAYMENT_CONFIG[selectedBooking.paymentStatus] ||
                      PAYMENT_CONFIG.pending
                    ).label
                  }
                </span>
              </div>

              <div className="flex justify-between pt-4 border-t border-gray-200">
                <span className="font-medium text-gray-900">Tổng tiền</span>
                <span className="text-xl font-bold text-[#FF385C]">
                  {formatVnd(selectedBooking.amount)}
                </span>
              </div>
            </div>

            {/* Action buttons in modal */}
            <div className="p-6 border-t border-gray-200 space-y-2">
              {selectedBooking.status === "pending" && canConfirmBooking(selectedBooking) && (
                <button
                  onClick={() =>
                    handleAction("confirm", selectedBooking.id, "Xác nhận")
                  }
                  disabled={actionLoading === selectedBooking.id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 cursor-pointer disabled:opacity-60"
                >
                  {actionLoading === selectedBooking.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle size={16} />
                  )}
                  Xác nhận đặt phòng
                </button>
              )}
              {selectedBooking.status === "pending" && !canConfirmBooking(selectedBooking) && (
                <div className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-500 font-medium rounded-lg">
                  <CreditCard size={16} /> Chờ khách thanh toán
                </div>
              )}
              {selectedBooking.status === "confirmed" && !getCheckInBlockReason(selectedBooking) && (
                <button
                  onClick={() =>
                    handleAction("checkin", selectedBooking.id, "Check-in")
                  }
                  disabled={actionLoading === selectedBooking.id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 cursor-pointer disabled:opacity-60"
                >
                  {actionLoading === selectedBooking.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <LogIn size={16} />
                  )}
                  Check-in
                </button>
              )}
              {selectedBooking.status === "confirmed" && getCheckInBlockReason(selectedBooking) && (
                <div className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-500 font-medium rounded-lg">
                  <LogIn size={16} /> {getCheckInBlockReason(selectedBooking)}
                </div>
              )}
              {selectedBooking.status === "checked_in" && !getCheckoutBlockReason(selectedBooking) && (
                <button
                  onClick={() =>
                    handleAction("checkout", selectedBooking.id, "Hoàn thành")
                  }
                  disabled={actionLoading === selectedBooking.id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 cursor-pointer disabled:opacity-60"
                >
                  {actionLoading === selectedBooking.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <LogOut size={16} />
                  )}
                  Hoàn thành
                </button>
              )}
              {selectedBooking.status === "checked_in" && getCheckoutBlockReason(selectedBooking) && (
                <div className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-500 font-medium rounded-lg">
                  <LogOut size={16} /> {getCheckoutBlockReason(selectedBooking)}
                </div>
              )}
              {selectedBooking.paymentMethod === "cash" &&
                selectedBooking.paymentStatus === "pending" &&
                selectedBooking.status !== "cancelled" && (
                  <button
                    onClick={() =>
                      handleAction(
                        "mark_paid",
                        selectedBooking.id,
                        "Đánh dấu đã thanh toán",
                      )
                    }
                    disabled={actionLoading === selectedBooking.id}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 cursor-pointer disabled:opacity-60"
                  >
                    <CreditCard size={16} /> Đánh dấu đã thanh toán
                  </button>
                )}
              {["pending", "confirmed"].includes(selectedBooking.status) && (
                <button
                  onClick={() =>
                    handleAction("cancel", selectedBooking.id, "Hủy")
                  }
                  disabled={actionLoading === selectedBooking.id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 font-medium rounded-lg hover:bg-red-50 cursor-pointer disabled:opacity-60"
                >
                  <XCircle size={16} /> Hủy đặt phòng
                </button>
              )}
              <button
                onClick={() => setSelectedBooking(null)}
                className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingsManagement;
