import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BedDouble,
  Calendar,
  Users,
  CreditCard,
  Banknote,
  Wallet,
  CheckCircle2,
  User,
  Phone,
  Mail,
  ChevronRight,
  Shield,
} from "lucide-react";
import Navbar from "../components/Navbar";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { formatVnd } from "../utils/currency";
import { formatBookingCode } from "../utils/booking";

const PAYMENT_OPTIONS = [
  {
    id: "pay_at_hotel",
    label: "Thanh toán tại khách sạn",
    description: "Thanh toán khi nhận phòng",
    icon: Banknote,
  },
  {
    id: "vnpay",
    label: "VNPAY",
    description: "ATM, QR, Visa, Mastercard, JCB",
    icon: CreditCard,
  },
  {
    id: "momo",
    label: "MoMo",
    description: "Ví MoMo, QR hoặc ứng dụng MoMo",
    icon: Wallet,
  },
];

const PAYMENT_METHOD_MAP = {
  pay_at_hotel: "cash",
  vnpay: "vnpay",
  momo: "momo",
};

const formatDate = (dateStr) => {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const InputField = ({ label, icon: Icon, error, ...props }) => (
  <div className="space-y-2">
    <label className="block text-base font-medium text-gray-700">{label}</label>
    <div className="relative">
      {Icon && (
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Icon size={18} className="text-gray-400" />
        </div>
      )}
      <input
        {...props}
        className={`w-full ${Icon ? "pl-11" : "pl-4"} pr-4 py-3.5 bg-white border ${
          error
            ? "border-red-400 focus:ring-2 focus:ring-red-200"
            : "border-gray-300 focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C]"
        } rounded-xl text-gray-900 placeholder:text-gray-400 focus:placeholder:opacity-0 text-base outline-none transition-all duration-200`}
      />
    </div>
    {error && <p className="text-sm text-red-500">{error}</p>}
  </div>
);

const Booking = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const hotelId = searchParams.get("hotelId");
  const roomId = searchParams.get("roomId");
  const roomNumberId = searchParams.get("roomNumberId");
  const checkIn = searchParams.get("checkIn");
  const checkOut = searchParams.get("checkOut");
  const guests = Number(searchParams.get("guests") || 2);

  const [hotel, setHotel] = useState(null);
  const [room, setRoom] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const [formData, setFormData] = useState({
    fullName: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });

  const [paymentMethod, setPaymentMethod] = useState("pay_at_hotel");

  useEffect(() => {
    const invalidHotelId = !hotelId || hotelId === "undefined" || hotelId === "null";
    const invalidRoomId = !roomId || roomId === "undefined" || roomId === "null";

    if (invalidHotelId || invalidRoomId) {
      setDataError("Thiếu thông tin đặt phòng. Vui lòng quay lại và chọn phòng.");
      setLoadingData(false);
      return;
    }

    const fetchData = async () => {
      setLoadingData(true);
      try {
        const [hotelRes, roomRes] = await Promise.all([
          api.getHotel(hotelId),
          api.getRoom(roomId),
        ]);

        const hotelData = hotelRes.data || hotelRes;
        const roomData = roomRes.data || roomRes;

        setHotel({
          ...hotelData,
          id: hotelData._id || hotelData.id,
          image: hotelData.images?.[0] || hotelData.image || "",
          location: hotelData.address || hotelData.location || hotelData.city || "",
        });

        setRoom({
          ...roomData,
          id: roomData._id || roomData.id,
          title: roomData.title || roomData.name || "Phòng",
          price: roomData.pricePerNight || roomData.price || 0,
          beds: roomData.beds || `${roomData.maxPeople || 2} khách`,
        });
      } catch (err) {
        setDataError(err.message || "Không thể tải thông tin đặt phòng");
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [hotelId, roomId]);

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 1;
    const diff = new Date(checkOut) - new Date(checkIn);
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [checkIn, checkOut]);

  const totalPrice = room ? room.price * nights : 0;

  const validate = () => {
    const errors = {};
    if (!formData.fullName.trim()) errors.fullName = "Vui lòng nhập họ và tên";
    if (!formData.email.trim()) errors.email = "Vui lòng nhập email";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errors.email = "Email không hợp lệ";
    if (!formData.phone.trim()) errors.phone = "Vui lòng nhập số điện thoại";
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!checkIn || !checkOut) {
      setFieldErrors({
        _general: "Thiếu thông tin ngày lưu trú. Vui lòng quay lại và chọn ngày.",
      });
      return;
    }

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const nameParts = formData.fullName.trim().split(/\s+/);
      const firstName = nameParts.pop() || "";
      const lastName = nameParts.join(" ");
      const bookingPayload = {
        hotelId,
        roomId,
        roomNumberId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        numberOfGuests: guests,
        paymentMethod: PAYMENT_METHOD_MAP[paymentMethod] || "cash",
        guestInfo: {
          firstName,
          lastName,
          fullName: formData.fullName.trim(),
          email: formData.email,
          phone: formData.phone,
        },
        totalPrice,
      };

      const res = await api.createBooking(bookingPayload);
      const booking = res.data || res;
      const paymentUrl = res.payment?.paymentUrl || booking.paymentUrl;

      if (paymentUrl) {
        window.location.assign(paymentUrl);
        return;
      }

      setBookingResult({
        _id: booking._id || booking.id || `BK-${Date.now()}`,
        hotelName: hotel?.name || "Khách sạn",
        roomTitle: room?.title || "Phòng",
        checkInDate: checkIn,
        checkOutDate: checkOut,
        totalPrice,
        paymentMethod,
      });
    } catch (err) {
      setFieldErrors({ _general: err.message || "Đặt phòng thất bại. Vui lòng thử lại." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  if (loadingData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-5xl mx-auto px-4 py-8">
          <p className="text-gray-500">Đang tải thông tin...</p>
        </main>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
            {dataError}
          </div>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={18} /> Quay lại
          </button>
        </main>
      </div>
    );
  }

  if (bookingResult) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-xl mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-linear-to-br from-[#FF385C] to-[#E31C5F] px-8 py-10 text-center">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 size={44} className="text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">
                Đặt phòng thành công!
              </h1>
              <p className="text-white/80 text-base mt-2">
                Yêu cầu đặt phòng của bạn đã được tạo thành công
              </p>
            </div>

            <div className="p-7 space-y-5">
              <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Mã đặt phòng
                  </span>
                  <span className="text-base font-mono font-semibold text-gray-800">
                    {formatBookingCode(bookingResult._id)}
                  </span>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex justify-between">
                  <span className="text-base text-gray-500">Khách sạn</span>
                  <span className="text-base font-medium text-gray-800 text-right max-w-[60%]">
                    {bookingResult.hotelName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base text-gray-500">Phòng</span>
                  <span className="text-base font-medium text-gray-800">
                    {bookingResult.roomTitle}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base text-gray-500">Nhận phòng</span>
                  <span className="text-base font-medium text-gray-800">
                    {formatDate(bookingResult.checkInDate)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base text-gray-500">Trả phòng</span>
                  <span className="text-base font-medium text-gray-800">
                    {formatDate(bookingResult.checkOutDate)}
                  </span>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-gray-700">
                    Tổng thanh toán
                  </span>
                  <span className="text-2xl font-bold text-[#FF385C]">
                    {formatVnd(bookingResult.totalPrice)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate("/my-bookings")}
                  className="flex-1 py-3.5 bg-[#FF385C] text-white text-base font-semibold rounded-xl hover:bg-[#E31C5F] active:scale-[0.98] transition-all duration-150 cursor-pointer"
                >
                  Xem đặt phòng của tôi
                </button>
                <button
                  onClick={() => navigate("/")}
                  className="flex-1 py-3.5 border border-gray-300 text-gray-700 text-base font-semibold rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all duration-150 cursor-pointer"
                >
                  Về trang chủ
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 text-base text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
        >
          <ArrowLeft size={18} />
          <span>Quay lại</span>
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-7">
          Hoàn tất đặt phòng
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-6">
            {fieldErrors._general && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-base">
                {fieldErrors._general}
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-7 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FF385C]/10 rounded-xl flex items-center justify-center">
                  <User size={20} className="text-[#FF385C]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Thông tin khách
                  </h2>
                  <p className="text-sm text-gray-500">
                    Điền thông tin người nhận phòng chính
                  </p>
                </div>
              </div>

              <InputField
                label="Họ và tên"
                icon={User}
                type="text"
                placeholder="Nhập họ và tên"
                value={formData.fullName}
                onChange={(e) => handleFieldChange("fullName", e.target.value)}
                error={fieldErrors.fullName}
              />

              <InputField
                label="Email"
                icon={Mail}
                type="email"
                placeholder="Nhập email"
                value={formData.email}
                onChange={(e) => handleFieldChange("email", e.target.value)}
                error={fieldErrors.email}
              />

              <InputField
                label="Số điện thoại"
                icon={Phone}
                type="tel"
                placeholder="Nhập số điện thoại"
                value={formData.phone}
                onChange={(e) => handleFieldChange("phone", e.target.value)}
                error={fieldErrors.phone}
              />
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-7 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FF385C]/10 rounded-xl flex items-center justify-center">
                  <CreditCard size={20} className="text-[#FF385C]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Phương thức thanh toán
                  </h2>
                  <p className="text-sm text-gray-500">
                    Chọn cách bạn muốn thanh toán
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {PAYMENT_OPTIONS.map(
                  ({ id, label, description, icon: Icon }) => {
                    const selected = paymentMethod === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setPaymentMethod(id)}
                        className={`w-full flex items-center gap-4 p-5 rounded-xl border-2 text-left transition-all duration-150 cursor-pointer ${
                          selected
                            ? "border-[#FF385C] bg-[#FF385C]/5"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                            selected ? "bg-[#FF385C]/10" : "bg-gray-100"
                          }`}
                        >
                          <Icon
                            size={22}
                            className={
                              selected ? "text-[#FF385C]" : "text-gray-500"
                            }
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-base font-semibold ${selected ? "text-[#FF385C]" : "text-gray-800"}`}
                          >
                            {label}
                          </p>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {description}
                          </p>
                        </div>
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            selected
                              ? "border-[#FF385C] bg-[#FF385C]"
                              : "border-gray-300"
                          }`}
                        >
                          {selected && (
                            <div className="w-2.5 h-2.5 rounded-full bg-white" />
                          )}
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500 px-1">
              <Shield size={15} className="text-gray-400 shrink-0" />
              <span>Thông tin thanh toán của bạn được mã hóa và bảo mật.</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4.5 bg-[#FF385C] hover:bg-[#E31C5F] disabled:opacity-60 disabled:cursor-not-allowed text-white text-lg font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.99] cursor-pointer shadow-sm shadow-[#FF385C]/30"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Đang xử lý...
                </>
              ) : (
                <>
                  {paymentMethod === "pay_at_hotel" ? "Xác nhận đặt phòng" : "Tiếp tục thanh toán"}
                  <ChevronRight size={20} />
                </>
              )}
            </button>
          </form>

          <div className="lg:col-span-2 space-y-4 lg:sticky lg:top-24">
            {hotel && room && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="relative h-52 overflow-hidden">
                  {hotel.image ? (
                    <img
                      src={hotel.image}
                      alt={hotel.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200" />
                  )}
                  <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-5 right-5">
                    <p className="text-white font-semibold text-base leading-tight">
                      {hotel.name}
                    </p>
                    <p className="text-white/80 text-sm mt-1">{hotel.location}</p>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Tóm tắt đặt phòng
                  </h2>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                      <BedDouble size={18} className="text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Loại phòng</p>
                      <p className="text-base font-medium text-gray-800">
                        {room.title}
                      </p>
                      {room.beds && (
                        <p className="text-sm text-gray-400 mt-0.5">{room.beds}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                      <Calendar size={18} className="text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 mb-2">Ngày lưu trú</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-400">Nhận phòng</p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5">
                            {checkIn
                              ? new Date(checkIn).toLocaleDateString("vi-VN", {
                                  month: "short",
                                  day: "numeric",
                                })
                              : "N/A"}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-400">Trả phòng</p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5">
                            {checkOut
                              ? new Date(checkOut).toLocaleDateString("vi-VN", {
                                  month: "short",
                                  day: "numeric",
                                })
                              : "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                      <Users size={18} className="text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Số khách</p>
                      <p className="text-base font-medium text-gray-800">
                        {guests} khách
                      </p>
                    </div>
                  </div>

                  <div className="h-px bg-gray-100" />

                  <div className="space-y-2.5">
                    <div className="flex justify-between text-base">
                      <span className="text-gray-500">
                        {formatVnd(room.price)} &times; {nights}{" "}
                        {nights === 1 ? "đêm" : "đêm"}
                      </span>
                      <span className="text-gray-700 font-medium">
                        {formatVnd(room.price * nights)}
                      </span>
                    </div>
                    <div className="flex justify-between text-base">
                      <span className="text-gray-500">Thuế và phí</span>
                      <span className="text-green-600 font-medium text-sm">
                        Đã bao gồm
                      </span>
                    </div>
                  </div>

                  <div className="h-px bg-gray-100" />

                  <div className="flex justify-between items-center">
                    <span className="text-base font-semibold text-gray-900">
                      Tổng cộng
                    </span>
                    <div className="text-right">
                      <span className="text-3xl font-bold text-[#FF385C]">
                        {formatVnd(totalPrice)}
                      </span>
                      <p className="text-sm text-gray-400">VNĐ</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-[#FF385C]/5 border border-[#FF385C]/20 rounded-xl p-5 flex items-start gap-3">
              <CheckCircle2
                size={20}
                className="text-[#FF385C] shrink-0 mt-0.5"
              />
              <div>
                <p className="text-base font-medium text-[#FF385C]">
                  Hủy miễn phí
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Hủy trước ngày nhận phòng để được hoàn tiền đầy đủ.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Booking;
