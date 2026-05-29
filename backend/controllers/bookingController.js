const Booking = require("../models/Booking");
const Room = require("../models/Room");
const asyncHandler = require("../utils/asyncHandler");
const {
  createMomoPayment,
  createVnpayPaymentUrl,
  getGatewayAmount,
  verifyMomoParams,
  verifyVnpayParams,
} = require("../utils/paymentGateways");

// ─── Helpers ────────────────────────────────────────────────────────────────

const getDatesInRange = (startDate, endDate) => {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  while (start < end) {
    dates.push(new Date(start).getTime());
    start.setDate(start.getDate() + 1);
  }
  return dates;
};

const ONLINE_PAYMENT_METHODS = ["vnpay", "momo"];
const CHECK_IN_HOUR = 14;
const CHECK_OUT_HOUR = 12;

const isOnlinePaymentMethod = (method) => ONLINE_PAYMENT_METHODS.includes(method);

const releaseRoomIfReserved = async (booking) => {
  if (booking.inventoryReleased) return;
  await Room.findByIdAndUpdate(booking.roomId, { $inc: { availableRooms: 1 } });
  booking.inventoryReleased = true;
};

const getStayDateTime = (date, hour) => {
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

const getClientUrl = () =>
  (process.env.CLIENT_URL || process.env.FRONTEND_URL || "http://localhost:5173").replace(
    /\/$/,
    ""
  );

const getApiUrl = () =>
  (
    process.env.API_PUBLIC_URL ||
    process.env.SERVER_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${process.env.PORT || 5000}`
  ).replace(/\/$/, "");

const getIpAddress = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.socket?.remoteAddress || req.ip || "127.0.0.1";
};

const buildPaymentResultUrl = ({ gateway, bookingId, status, message }) => {
  const params = new URLSearchParams({
    gateway,
    bookingId: bookingId || "",
    status,
    message: message || "",
  });
  return `${getClientUrl()}/payment-result?${params.toString()}`;
};

const createPaymentSession = async ({ booking, req }) => {
  const gateway = booking.paymentMethod;
  const apiUrl = getApiUrl();

  if (gateway === "vnpay") {
    return createVnpayPaymentUrl({
      booking,
      ipAddr: getIpAddress(req),
      returnUrl: `${apiUrl}/api/v1/bookings/payments/vnpay-return`,
    });
  }

  if (gateway === "momo") {
    return createMomoPayment({
      booking,
      guestInfo: booking.guestInfo,
      redirectUrl: `${apiUrl}/api/v1/bookings/payments/momo-return`,
      ipnUrl: `${apiUrl}/api/v1/bookings/payments/momo-ipn`,
    });
  }

  return null;
};

const persistPaymentSession = async (booking, payment) => {
  if (!payment) return;

  booking.paymentGateway = payment.gateway;
  booking.paymentTransaction = {
    ...(booking.paymentTransaction || {}),
    orderId: payment.orderId,
    requestId: payment.requestId,
    amount: payment.amount,
    rawResponse: payment.rawResponse,
    createdAt: new Date(),
  };
  await booking.save();
};

const updateGatewayPayment = async ({ bookingId, gateway, amount, success, payload }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return { ok: false, code: "not_found", message: "Không tìm thấy đặt phòng" };
  }

  const expectedAmount = getGatewayAmount(booking.totalPrice);
  if (Number(amount) !== Number(expectedAmount)) {
    return { ok: false, code: "invalid_amount", message: "Số tiền không hợp lệ", booking };
  }

  const alreadyPaid = booking.paymentStatus === "paid";
  if (success && booking.status === "cancelled") {
    return {
      ok: false,
      code: "invalid_state",
      message: "Đặt phòng đã bị hủy, không thể ghi nhận thanh toán",
      booking,
    };
  }

  if (!alreadyPaid) {
    booking.paymentGateway = gateway;
    booking.paymentStatus = success ? "paid" : "failed";
    if (!success && booking.status !== "cancelled") {
      booking.status = "cancelled";
      await releaseRoomIfReserved(booking);
    }
    booking.paymentTransaction = {
      ...(booking.paymentTransaction || {}),
      gateway,
      amount: Number(amount),
      transactionNo: payload.vnp_TransactionNo || payload.transId,
      bankCode: payload.vnp_BankCode,
      responseCode: payload.vnp_ResponseCode || payload.resultCode,
      transactionStatus: payload.vnp_TransactionStatus,
      requestId: payload.requestId || booking.paymentTransaction?.requestId,
      rawResponse: payload,
      ...(success ? { paidAt: new Date() } : {}),
      ...(!success ? { failedAt: new Date() } : {}),
    };
    await booking.save();
  }

  return { ok: true, code: alreadyPaid ? "already_paid" : "updated", booking };
};

// ─── Workflow ────────────────────────────────────────────────────────────────
//
//  User creates booking  → status: pending,    paymentStatus: pending
//  Admin confirms        → status: confirmed,  paymentStatus: unchanged
//  Guest checks in       → status: checked_in, paymentStatus: unchanged
//  Guest checks out      → status: completed,  paymentStatus: paid (if pay_at_hotel)
//  User/Admin cancels before check-in → status: cancelled, paymentStatus: refunded (if was paid)
//
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Create booking
// @route   POST /api/v1/bookings
// @access  Private
const createBooking = asyncHandler(async (req, res) => {
  const {
    hotelId,
    roomId,
    roomNumberId,
    checkInDate,
    checkOutDate,
    numberOfGuests,
    paymentMethod,
    guestInfo,
  } = req.body;

  const userId = req.user.userId;

  if (!hotelId || !roomId) {
    return res.status(400).json({
      success: false,
      error: "hotelId và roomId là bắt buộc",
    });
  }

  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);

  if (isNaN(checkIn) || isNaN(checkOut)) {
    return res.status(400).json({
      success: false,
      error: "Ngày check-in hoặc check-out không hợp lệ",
    });
  }

  if (checkOut <= checkIn) {
    return res.status(400).json({
      success: false,
      error: "Ngày check-out phải sau ngày check-in",
    });
  }

  const room = await Room.findById(roomId);
  if (!room) {
    return res.status(404).json({ success: false, error: "Không tìm thấy phòng" });
  }

  if (room.availableRooms <= 0) {
    return res.status(400).json({
      success: false,
      error: "Phòng đã hết chỗ trống",
    });
  }

  if (numberOfGuests && numberOfGuests > room.maxPeople) {
    return res.status(400).json({
      success: false,
      error: `Phòng chỉ chứa tối đa ${room.maxPeople} khách`,
    });
  }

  const nights = getDatesInRange(checkIn, checkOut).length;
  const totalPrice = room.price * nights;

  const resolvedPaymentMethod = paymentMethod || "cash";
  const isOnlinePayment = ONLINE_PAYMENT_METHODS.includes(resolvedPaymentMethod);

  const booking = await Booking.create({
    userId,
    hotelId,
    roomId,
    roomNumberId: roomNumberId || roomId,
    roomNumber: 1,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    numberOfGuests: numberOfGuests || 1,
    totalPrice,
    paymentMethod: resolvedPaymentMethod,
    paymentGateway: isOnlinePayment ? resolvedPaymentMethod : null,
    paymentStatus: "pending",
    status: "pending",
    inventoryReleased: false,
    guestInfo: guestInfo || {},
  });

  // Decrease available rooms
  await Room.findByIdAndUpdate(roomId, { $inc: { availableRooms: -1 } });

  let payment = null;
  if (isOnlinePayment) {
    try {
      payment = await createPaymentSession({ booking, req });
      await persistPaymentSession(booking, payment);
    } catch (error) {
      booking.paymentStatus = "failed";
      booking.status = "cancelled";
      booking.inventoryReleased = true;
      booking.paymentTransaction = {
        ...(booking.paymentTransaction || {}),
        error: error.message,
        failedAt: new Date(),
      };
      await booking.save();
      await Room.findByIdAndUpdate(roomId, { $inc: { availableRooms: 1 } });

      return res.status(502).json({
        success: false,
        error: `Khong the tao phien thanh toan ${resolvedPaymentMethod.toUpperCase()}: ${error.message}`,
      });
    }
  }

  res.status(201).json({
    success: true,
    message: "Đặt phòng thành công. Vui lòng chờ admin xác nhận.",
    data: booking,
    payment,
  });
});

// @desc    Create a new online payment session for an existing booking
// @route   POST /api/v1/bookings/:id/payments
// @access  Private
const createBookingPayment = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return res.status(404).json({ success: false, error: "Khong tim thay dat phong" });
  }

  const isOwner = booking.userId.toString() === req.user.userId;
  const isAdmin = req.user.role === "admin";

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ success: false, error: "Khong co quyen truy cap" });
  }

  if (!isOnlinePaymentMethod(booking.paymentMethod)) {
    return res.status(400).json({ success: false, error: "Dat phong nay khong dung thanh toan online" });
  }

  if (booking.paymentStatus === "paid") {
    return res.status(400).json({ success: false, error: "Dat phong da duoc thanh toan" });
  }

  if (["cancelled", "completed"].includes(booking.status)) {
    return res.status(400).json({ success: false, error: "Khong the thanh toan dat phong da ket thuc" });
  }

  const payment = await createPaymentSession({ booking, req });
  await persistPaymentSession(booking, payment);

  res.status(200).json({
    success: true,
    data: booking,
    payment,
  });
});

// @desc    VNPAY browser return
// @route   GET /api/v1/bookings/payments/vnpay-return
// @access  Public
const handleVnpayReturn = asyncHandler(async (req, res) => {
  const params = req.query;
  const bookingId = params.vnp_TxnRef;

  if (!verifyVnpayParams(params)) {
    return res.redirect(
      buildPaymentResultUrl({
        gateway: "vnpay",
        bookingId,
        status: "failed",
        message: "Chu ky VNPAY khong hop le",
      })
    );
  }

  const success = params.vnp_ResponseCode === "00" && params.vnp_TransactionStatus === "00";
  const result = await updateGatewayPayment({
    bookingId,
    gateway: "vnpay",
    amount: Number(params.vnp_Amount || 0) / 100,
    success,
    payload: params,
  });

  res.redirect(
    buildPaymentResultUrl({
      gateway: "vnpay",
      bookingId,
      status: result.ok && success ? "success" : "failed",
      message: result.ok ? params.vnp_ResponseCode || "" : result.message,
    })
  );
});

// @desc    VNPAY server callback
// @route   GET /api/v1/bookings/payments/vnpay-ipn
// @access  Public
const handleVnpayIpn = asyncHandler(async (req, res) => {
  const params = req.query;
  const bookingId = params.vnp_TxnRef;

  if (!verifyVnpayParams(params)) {
    return res.status(200).json({ RspCode: "97", Message: "Invalid signature" });
  }

  const success = params.vnp_ResponseCode === "00" && params.vnp_TransactionStatus === "00";
  const result = await updateGatewayPayment({
    bookingId,
    gateway: "vnpay",
    amount: Number(params.vnp_Amount || 0) / 100,
    success,
    payload: params,
  });

  if (result.code === "not_found") {
    return res.status(200).json({ RspCode: "01", Message: "Order not found" });
  }

  if (result.code === "invalid_amount") {
    return res.status(200).json({ RspCode: "04", Message: "Invalid amount" });
  }

  if (result.code === "already_paid") {
    return res.status(200).json({ RspCode: "02", Message: "Order already confirmed" });
  }

  if (!result.ok) {
    return res.status(200).json({ RspCode: "99", Message: result.message || "Invalid state" });
  }

  res.status(200).json({ RspCode: "00", Message: "Confirm Success" });
});

// @desc    MoMo browser return
// @route   GET /api/v1/bookings/payments/momo-return
// @access  Public
const handleMomoReturn = asyncHandler(async (req, res) => {
  const params = req.query;
  const bookingId = params.orderId;

  if (!verifyMomoParams(params)) {
    return res.redirect(
      buildPaymentResultUrl({
        gateway: "momo",
        bookingId,
        status: "failed",
        message: "Chu ky MoMo khong hop le",
      })
    );
  }

  const success = Number(params.resultCode) === 0;
  const result = await updateGatewayPayment({
    bookingId,
    gateway: "momo",
    amount: params.amount,
    success,
    payload: params,
  });

  res.redirect(
    buildPaymentResultUrl({
      gateway: "momo",
      bookingId,
      status: result.ok && success ? "success" : "failed",
      message: result.ok ? params.message || "" : result.message,
    })
  );
});

// @desc    MoMo server callback
// @route   POST /api/v1/bookings/payments/momo-ipn
// @access  Public
const handleMomoIpn = asyncHandler(async (req, res) => {
  const params = req.body;

  if (!verifyMomoParams(params)) {
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }

  const result = await updateGatewayPayment({
    bookingId: params.orderId,
    gateway: "momo",
    amount: params.amount,
    success: Number(params.resultCode) === 0,
    payload: params,
  });

  if (!result.ok) {
    return res.status(400).json({ success: false, message: result.message });
  }

  res.status(200).json({ success: true, message: "Received" });
});

// @desc    Confirm booking (admin)
// @route   PATCH /api/v1/bookings/:id/confirm
// @access  Private/Admin
const confirmBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return res.status(404).json({ success: false, error: "Không tìm thấy đặt phòng" });
  }

  if (booking.status !== "pending") {
    return res.status(400).json({
      success: false,
      error: `Không thể xác nhận đặt phòng có trạng thái '${booking.status}'`,
    });
  }

  if (isOnlinePaymentMethod(booking.paymentMethod) && booking.paymentStatus !== "paid") {
    return res.status(400).json({
      success: false,
      error: "Chỉ có thể xác nhận đơn VNPAY/MoMo sau khi khách thanh toán thành công",
    });
  }

  booking.status = "confirmed";
  await booking.save();

  res.status(200).json({
    success: true,
    message: "Đã xác nhận đặt phòng",
    data: booking,
  });
});

// @desc    Check-in booking (admin)
// @route   PATCH /api/v1/bookings/:id/checkin
// @access  Private/Admin
const checkInBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return res.status(404).json({ success: false, error: "Không tìm thấy đặt phòng" });
  }

  if (booking.status !== "confirmed") {
    return res.status(400).json({
      success: false,
      error: `Chỉ có thể check-in đặt phòng đã xác nhận. Trạng thái hiện tại: '${booking.status}'`,
    });
  }

  if (isOnlinePaymentMethod(booking.paymentMethod) && booking.paymentStatus !== "paid") {
    return res.status(400).json({
      success: false,
      error: "Không thể check-in đơn thanh toán online chưa thành công",
    });
  }

  const earliestCheckIn = getStayDateTime(booking.checkInDate, CHECK_IN_HOUR);
  if (earliestCheckIn && new Date() < earliestCheckIn) {
    return res.status(400).json({
      success: false,
      error: `Chỉ có thể check-in từ ${formatStayTime(earliestCheckIn)}`,
    });
  }

  booking.status = "checked_in";
  await booking.save();

  res.status(200).json({
    success: true,
    message: "Đã check-in thành công",
    data: booking,
  });
});

// @desc    Check-out / Complete booking (admin)
// @route   PATCH /api/v1/bookings/:id/checkout
// @access  Private/Admin
const checkOutBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return res.status(404).json({ success: false, error: "Không tìm thấy đặt phòng" });
  }

  if (booking.status !== "checked_in") {
    return res.status(400).json({
      success: false,
      error: `Chỉ có thể check-out đặt phòng đang check-in. Trạng thái hiện tại: '${booking.status}'`,
    });
  }

  if (isOnlinePaymentMethod(booking.paymentMethod) && booking.paymentStatus !== "paid") {
    return res.status(400).json({
      success: false,
      error: "Không thể hoàn thành đơn thanh toán online chưa thành công",
    });
  }

  const earliestCheckOut = getStayDateTime(booking.checkOutDate, CHECK_OUT_HOUR);
  if (earliestCheckOut && new Date() < earliestCheckOut) {
    return res.status(400).json({
      success: false,
      error: `Chỉ có thể checkout từ ${formatStayTime(earliestCheckOut)}`,
    });
  }

  booking.status = "completed";
  // If pay at hotel, mark as paid on checkout
  if (booking.paymentMethod === "cash" && booking.paymentStatus === "pending") {
    booking.paymentStatus = "paid";
  }

  // Release room back to inventory after checkout
  await releaseRoomIfReserved(booking);
  await booking.save();

  res.status(200).json({
    success: true,
    message: "Đã check-out và hoàn thành đặt phòng",
    data: booking,
  });
});

// @desc    Cancel booking (user or admin)
// @route   DELETE /api/v1/bookings/:id
// @access  Private
const deleteBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return res.status(404).json({ success: false, error: "Không tìm thấy đặt phòng" });
  }

  const isOwner = booking.userId.toString() === req.user.userId;
  const isAdmin = req.user.role === "admin";

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ success: false, error: "Không có quyền truy cập" });
  }

  if (booking.status === "cancelled") {
    return res.status(400).json({ success: false, error: "Đặt phòng đã bị hủy trước đó" });
  }

  if (booking.status === "completed") {
    return res.status(400).json({ success: false, error: "Không thể hủy đặt phòng đã hoàn thành" });
  }

  if (booking.status === "checked_in") {
    return res.status(400).json({
      success: false,
      error: "Không thể hủy đặt phòng đã check-in. Vui lòng xử lý trả phòng sớm.",
    });
  }

  const cancellableStatuses = ["pending", "confirmed"];
  if (!cancellableStatuses.includes(booking.status)) {
    return res.status(400).json({
      success: false,
      error: "Chỉ có thể hủy đặt phòng đang chờ xác nhận hoặc đã xác nhận",
    });
  }

  booking.status = "cancelled";
  // Refund if already paid
  if (booking.paymentStatus === "paid") {
    booking.paymentStatus = "refunded";
  }

  // Release room back to inventory
  await releaseRoomIfReserved(booking);
  await booking.save();

  res.status(200).json({
    success: true,
    message: "Đã hủy đặt phòng thành công",
    data: booking,
  });
});

// @desc    Update booking payment status (admin)
// @route   PATCH /api/v1/bookings/:id
// @access  Private/Admin
const updateBooking = asyncHandler(async (req, res) => {
  const { paymentStatus } = req.body;

  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, error: "Không tìm thấy đặt phòng" });
  }

  const validPaymentStatuses = ["pending", "paid", "failed", "refunded"];
  if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
    return res.status(400).json({
      success: false,
      error: `Trạng thái thanh toán không hợp lệ: ${paymentStatus}`,
    });
  }

  if (paymentStatus) booking.paymentStatus = paymentStatus;

  await booking.save();

  res.status(200).json({
    success: true,
    message: "Đã cập nhật đặt phòng",
    data: booking,
  });
});

// @desc    Get all bookings (admin)
// @route   GET /api/v1/bookings
// @access  Private/Admin
const getBookings = asyncHandler(async (req, res) => {
  const { status, paymentStatus, page = 1, limit = 10, sort = "-createdAt" } = req.query;

  const query = {};
  if (status) query.status = status;
  if (paymentStatus) query.paymentStatus = paymentStatus;

  const skip = (Number(page) - 1) * Number(limit);

  const bookings = await Booking.find(query)
    .populate("userId", "name email phone")
    .populate("hotelId", "name city")
    .populate("roomId", "title price")
    .skip(skip)
    .limit(Number(limit))
    .sort(sort);

  const total = await Booking.countDocuments(query);

  res.status(200).json({
    success: true,
    count: bookings.length,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    data: bookings,
  });
});

// @desc    Get user bookings
// @route   GET /api/v1/bookings/user/:id
// @access  Private
const getUserBookings = asyncHandler(async (req, res) => {
  const userId = req.params.id;

  if (req.user.userId !== userId && req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      error: "Chỉ có thể xem đặt phòng của chính mình",
    });
  }

  const bookings = await Booking.find({ userId })
    .populate("hotelId", "name city address images")
    .populate("roomId", "title price images")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: bookings.length,
    data: bookings,
  });
});

// @desc    Get single booking
// @route   GET /api/v1/bookings/:id
// @access  Private
const getBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate("userId", "name email phone")
    .populate("hotelId", "name city address")
    .populate("roomId", "title price");

  if (!booking) {
    return res.status(404).json({ success: false, error: "Không tìm thấy đặt phòng" });
  }

  if (
    booking.userId._id.toString() !== req.user.userId &&
    req.user.role !== "admin"
  ) {
    return res.status(403).json({ success: false, error: "Không có quyền truy cập" });
  }

  res.status(200).json({ success: true, data: booking });
});

// @desc    Check room availability
// @route   GET /api/v1/bookings/check-availability
// @access  Public
const checkAvailability = asyncHandler(async (req, res) => {
  const { roomId } = req.query;

  if (!roomId) {
    return res.status(400).json({ success: false, error: "roomId là bắt buộc" });
  }

  const room = await Room.findById(roomId).select("availableRooms totalRooms");
  if (!room) {
    return res.status(404).json({ success: false, error: "Không tìm thấy phòng" });
  }

  res.status(200).json({
    success: true,
    data: {
      roomId,
      available: room.availableRooms > 0,
      availableRooms: room.availableRooms,
      totalRooms: room.totalRooms,
    },
  });
});

module.exports = {
  createBooking,
  createBookingPayment,
  confirmBooking,
  checkInBooking,
  checkOutBooking,
  deleteBooking,
  updateBooking,
  getBookings,
  getUserBookings,
  getBooking,
  checkAvailability,
  handleMomoIpn,
  handleMomoReturn,
  handleVnpayIpn,
  handleVnpayReturn,
};
