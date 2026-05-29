import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  MapPin,
  Calendar,
  Users,
  ChevronRight,
  X,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  ChevronDown,
  Loader2,
  ArrowLeft,
  PenLine,
  CreditCard,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ReviewForm from '../components/ReviewForm';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatVnd } from '../utils/currency';
import { formatBookingCode } from '../utils/booking';

const statusConfig = {
  pending: {
    label: 'Chờ xác nhận',
    color: 'bg-yellow-100 text-yellow-700',
    icon: Clock,
    iconColor: 'text-yellow-500',
  },
  confirmed: {
    label: 'Đã xác nhận',
    color: 'bg-blue-100 text-blue-700',
    icon: CheckCircle,
    iconColor: 'text-blue-500',
  },
  checked_in: {
    label: 'Đang ở',
    color: 'bg-purple-100 text-purple-700',
    icon: CheckCircle,
    iconColor: 'text-purple-500',
  },
  completed: {
    label: 'Hoàn thành',
    color: 'bg-green-100 text-green-700',
    icon: CheckCircle,
    iconColor: 'text-green-500',
  },
  cancelled: {
    label: 'Đã hủy',
    color: 'bg-red-100 text-red-700',
    icon: XCircle,
    iconColor: 'text-red-500',
  },
};

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const normalizeBooking = (b) => {
  const checkIn = b.checkInDate || b.checkIn;
  const checkOut = b.checkOutDate || b.checkOut;
  const nights = checkIn && checkOut
    ? Math.max(1, Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)))
    : b.nights || 1;

  return {
    id: b._id || b.id,
    rawId: b._id || b.id,
    hotelId: b.hotelId?._id || b.hotelId || '',
    hotel: b.hotelId?.name || b.hotel?.name || b.hotelName || 'Khách sạn',
    room: b.roomId?.title || b.room?.title || b.roomTitle || 'Phòng',
    city: b.hotelId?.city || b.hotel?.city || b.hotel?.location || b.city || '',
    checkIn,
    checkOut,
    nights,
    status: b.status || 'pending',
    amount: b.totalPrice || b.amount || 0,
    guests: b.numberOfGuests || b.guests || 1,
    paymentMethod: b.paymentMethod || 'cash',
    paymentStatus: b.paymentStatus || 'pending',
    image: b.hotelId?.images?.[0] || b.hotel?.images?.[0] || b.hotel?.image || b.image || '',
  };
};

const CANCELLABLE_STATUSES = ['pending', 'confirmed'];
const canCancelBooking = (booking) => CANCELLABLE_STATUSES.includes(booking?.status);

const MyBookings = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelError, setCancelError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null); // { booking, hotelId, hotelName }
  const [reviewedBookingIds, setReviewedBookingIds] = useState(new Set());

  useEffect(() => {
    const fetchBookings = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await api.getUserBookings(user._id || user.id);
        const data = res.data || res.bookings || res || [];
        const normalized = (Array.isArray(data) ? data : []).map(normalizeBooking);
        setBookings(normalized);

        // Fetch user's existing reviews to know which bookings are already reviewed
        try {
          const reviewRes = await api.getUserReviews(user._id || user.id);
          const userReviews = reviewRes.data || [];
          const ids = new Set(
            userReviews
              .map((r) => r.bookingId?._id || r.bookingId)
              .filter(Boolean)
              .map(String)
          );
          setReviewedBookingIds(ids);
        } catch {
          // non-critical
        }
      } catch (err) {
        setError(err.message || 'Không thể tải danh sách đặt phòng');
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [user]);

  const hasActiveFilters = statusFilter !== '';

  const filteredBookings = bookings.filter((b) => {
    const shortCode = formatBookingCode(b.id);
    const matchSearch =
      b.hotel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shortCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.room.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter ? b.status === statusFilter : true;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: bookings.length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    confirmed: bookings.filter((b) => ['confirmed', 'checked_in'].includes(b.status)).length,
    completed: bookings.filter((b) => b.status === 'completed').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled').length,
  };

  const openCancelConfirm = (booking) => {
    setCancelError('');
    setCancelTarget(booking);
  };

  const closeCancelConfirm = () => {
    if (cancellingId) return;
    setCancelError('');
    setCancelTarget(null);
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;

    const id = cancelTarget.id;
    setCancellingId(id);
    try {
      await api.cancelBooking(id);
      const wasPaid = bookings.find((b) => b.id === id)?.paymentStatus === 'paid';
      const updatedFields = {
        status: 'cancelled',
        ...(wasPaid ? { paymentStatus: 'refunded' } : {}),
      };
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...updatedFields } : b))
      );
      if (selectedBooking?.id === id) {
        setSelectedBooking((prev) => ({ ...prev, ...updatedFields }));
      }
      setCancelTarget(null);
    } catch (err) {
      setCancelError(err.message || 'Hủy đặt phòng thất bại');
    } finally {
      setCancellingId(null);
    }
  };

  const handlePayNow = async (id) => {
    setPayingId(id);
    try {
      const res = await api.createBookingPayment(id);
      const paymentUrl = res.payment?.paymentUrl || res.data?.paymentUrl;
      if (!paymentUrl) {
        throw new Error('Khong tao duoc duong dan thanh toan');
      }
      window.location.assign(paymentUrl);
    } catch (err) {
      alert(err.message || 'Tao phien thanh toan that bai');
      setPayingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-[#FF385C]" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/profile"
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">
              Đặt phòng của tôi
            </h1>
            <p className="text-gray-500 mt-0.5">Xem và quản lý tất cả đặt phòng</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-500 mt-0.5">Tổng đặt phòng</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            <p className="text-sm text-gray-500 mt-0.5">Chờ xác nhận</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.confirmed}</p>
            <p className="text-sm text-gray-500 mt-0.5">Đã xác nhận</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            <p className="text-sm text-gray-500 mt-0.5">Hoàn thành</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{stats.cancelled}</p>
            <p className="text-sm text-gray-500 mt-0.5">Đã hủy</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Tìm theo tên khách sạn, mã đặt phòng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-[#FF385C] focus:ring-2 focus:ring-[#FF385C]/20 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-gray-500">
                <Filter size={16} />
                <span className="text-sm font-medium">Lọc:</span>
              </div>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#FF385C] cursor-pointer bg-white"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="pending">Chờ xác nhận</option>
                  <option value="confirmed">Đã xác nhận</option>
                  <option value="checked_in">Đang ở</option>
                  <option value="completed">Hoàn thành</option>
                  <option value="cancelled">Đã hủy</option>
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
              {hasActiveFilters && (
                <button
                  onClick={() => setStatusFilter('')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-[#FF385C] border border-[#FF385C]/30 rounded-lg hover:bg-[#FF385C]/5 transition-colors cursor-pointer"
                >
                  <X size={14} />
                  Xóa lọc
                </button>
              )}
            </div>
          </div>
        </div>

        {filteredBookings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarCheck size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Không có đặt phòng nào
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm || statusFilter
                ? 'Không tìm thấy kết quả phù hợp.'
                : 'Bạn chưa có đặt phòng nào.'}
            </p>
            <Link
              to="/hotels"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF385C] text-white rounded-xl hover:bg-[#E31C5F] transition-colors cursor-pointer"
            >
              Tìm khách sạn
              <ChevronRight size={18} />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => {
              const cfg = statusConfig[booking.status] || statusConfig.pending;
              const StatusIcon = cfg.icon;
              return (
                <div
                  key={booking.id}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row">
                    <div className="sm:w-44 h-44 sm:h-auto shrink-0">
                      {booking.image ? (
                        <img
                          src={booking.image}
                          alt={booking.hotel}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <CalendarCheck size={32} className="text-gray-400" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900 text-lg leading-tight">
                            {booking.hotel}
                          </h3>
                          <p className="text-gray-500 text-sm mt-0.5">{booking.room}</p>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium shrink-0 ${cfg.color}`}
                        >
                          <StatusIcon size={13} />
                          {cfg.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        {booking.city && (
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            <MapPin size={15} className="text-gray-400 shrink-0" />
                            <span>{booking.city}</span>
                          </div>
                        )}
                        {booking.checkIn && (
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            <Calendar size={15} className="text-gray-400 shrink-0" />
                            <span>{formatDate(booking.checkIn)}</span>
                          </div>
                        )}
                        {booking.checkOut && (
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            <Calendar size={15} className="text-gray-400 shrink-0" />
                            <span>{formatDate(booking.checkOut)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Users size={15} className="text-gray-400 shrink-0" />
                          <span>{booking.guests} khách · {booking.nights} đêm</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div>
                          <span className="text-xs text-gray-400 uppercase tracking-wide">
                            Mã đặt phòng
                          </span>
                          <p className="font-mono font-semibold text-gray-900 text-sm">{formatBookingCode(booking.id)}</p>
                        </div>
                        <div className="text-right mr-4">
                          <span className="text-xs text-gray-400">Tổng tiền</span>
                          <p className="font-bold text-[#FF385C] text-lg">
                            {formatVnd(booking.amount)}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => setSelectedBooking(booking)}
                            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            Chi tiết
                          </button>
                          {['vnpay', 'momo'].includes(booking.paymentMethod) &&
                            ['pending', 'failed'].includes(booking.paymentStatus) &&
                            !['cancelled', 'completed'].includes(booking.status) && (
                              <button
                                onClick={() => handlePayNow(booking.id)}
                                disabled={payingId === booking.id}
                                className="px-4 py-2 text-sm text-green-700 border border-green-200 rounded-lg hover:bg-green-50 cursor-pointer disabled:opacity-50 transition-colors flex items-center gap-1.5"
                              >
                                {payingId === booking.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <CreditCard size={14} />
                                )}
                                Thanh toán
                              </button>
                            )}
                          {booking.status === 'completed' && !reviewedBookingIds.has(booking.rawId) && (
                            <button
                              onClick={() =>
                                setReviewTarget({
                                  booking: {
                                    _id: booking.rawId,
                                    checkInDate: booking.checkIn,
                                    checkOutDate: booking.checkOut,
                                    roomId: { title: booking.room },
                                  },
                                  hotelId: booking.hotelId,
                                  hotelName: booking.hotel,
                                })
                              }
                              className="px-4 py-2 text-sm text-[#FF385C] border border-[#FF385C]/40 rounded-lg hover:bg-[#FF385C]/5 cursor-pointer transition-colors flex items-center gap-1.5"
                            >
                              <PenLine size={14} />
                              Đánh giá
                            </button>
                          )}
                          {booking.status === 'completed' && reviewedBookingIds.has(booking.rawId) && (
                            <span className="px-4 py-2 text-sm text-green-600 border border-green-200 rounded-lg bg-green-50 flex items-center gap-1.5">
                              <CheckCircle size={14} />
                              Đã đánh giá
                            </span>
                          )}
                          {canCancelBooking(booking) && (
                            <button
                              onClick={() => openCancelConfirm(booking)}
                              disabled={cancellingId === booking.id}
                              className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer disabled:opacity-50 transition-colors flex items-center gap-1.5"
                            >
                              {cancellingId === booking.id ? (
                                <>
                                  <Loader2 size={14} className="animate-spin" />
                                  Đang hủy...
                                </>
                              ) : (
                                'Hủy đặt phòng'
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {selectedBooking && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden">
            <div className="relative h-48">
              {selectedBooking.image ? (
                <img
                  src={selectedBooking.image}
                  alt={selectedBooking.hotel}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-200" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <button
                onClick={() => setSelectedBooking(null)}
                className="absolute top-3 right-3 p-2 bg-white/90 rounded-full hover:bg-white cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
              <div className="absolute bottom-4 left-4">
                <h3 className="text-white font-semibold text-lg leading-tight">
                  {selectedBooking.hotel}
                </h3>
                <p className="text-white/80 text-sm">{selectedBooking.room}</p>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <span className="text-sm text-gray-500">Trạng thái đặt phòng</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                    (statusConfig[selectedBooking.status] || statusConfig.pending).color
                  }`}
                >
                  {(statusConfig[selectedBooking.status] || statusConfig.pending).label}
                </span>
              </div>

              <div className="space-y-3 text-sm">
                {[
                  { label: 'Mã đặt phòng', value: formatBookingCode(selectedBooking.id) },
                  selectedBooking.city && { label: 'Thành phố', value: selectedBooking.city },
                  selectedBooking.checkIn && {
                    label: 'Nhận phòng',
                    value: `${formatDate(selectedBooking.checkIn)} (sau 14:00)`,
                  },
                  selectedBooking.checkOut && {
                    label: 'Trả phòng',
                    value: `${formatDate(selectedBooking.checkOut)} (trước 12:00)`,
                  },
                  { label: 'Số đêm', value: `${selectedBooking.nights} đêm` },
                  { label: 'Số khách', value: `${selectedBooking.guests} người` },
                  {
                    label: 'Thanh toán',
                    value:
                      selectedBooking.paymentStatus === 'paid'
                        ? 'Đã thanh toán'
                        : selectedBooking.paymentStatus === 'refunded'
                        ? 'Đã hoàn tiền'
                        : selectedBooking.paymentStatus === 'failed'
                        ? 'Thanh toán thất bại'
                        : selectedBooking.paymentMethod === 'cash'
                        ? 'Thanh toán tại khách sạn'
                        : 'Chưa thanh toán',
                  },
                ]
                  .filter(Boolean)
                  .map(({ label, value }) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-medium text-gray-900">{value}</span>
                    </div>
                  ))}
              </div>

              <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-200">
                <span className="text-gray-600 font-medium">Tổng tiền</span>
                <span className="text-2xl font-bold text-[#FF385C]">
                  {formatVnd(selectedBooking.amount)}
                </span>
              </div>

              <div className="mt-5 flex gap-3 flex-wrap">
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl font-medium hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  Đóng
                </button>
                {selectedBooking.status === 'completed' && !reviewedBookingIds.has(selectedBooking.rawId) && (
                  <button
                    onClick={() => {
                      setReviewTarget({
                        booking: {
                          _id: selectedBooking.rawId,
                          checkInDate: selectedBooking.checkIn,
                          checkOutDate: selectedBooking.checkOut,
                          roomId: { title: selectedBooking.room },
                        },
                        hotelId: selectedBooking.hotelId,
                        hotelName: selectedBooking.hotel,
                      });
                      setSelectedBooking(null);
                    }}
                    className="flex-1 px-4 py-3 bg-[#FF385C] text-white rounded-xl font-medium hover:bg-[#E31C5F] cursor-pointer transition-colors flex items-center justify-center gap-2"
                  >
                    <PenLine size={16} />
                    Viết đánh giá
                  </button>
                )}
                {canCancelBooking(selectedBooking) && (
                  <button
                    onClick={() => openCancelConfirm(selectedBooking)}
                    disabled={cancellingId === selectedBooking.id}
                    className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 cursor-pointer disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                  >
                    {cancellingId === selectedBooking.id ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Đang hủy...
                      </>
                    ) : (
                      'Hủy đặt phòng'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Xác nhận hủy đặt phòng</h3>
                <p className="text-sm text-gray-500 mt-1">Thao tác này sẽ hủy đặt phòng của bạn.</p>
              </div>
              <button
                type="button"
                onClick={closeCancelConfirm}
                disabled={Boolean(cancellingId)}
                className="p-2 rounded-full hover:bg-gray-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">Khách sạn</span>
                  <span className="font-medium text-gray-900 text-right">{cancelTarget.hotel}</span>
                </div>
                <div className="flex justify-between gap-4 mt-2">
                  <span className="text-gray-500">Phòng</span>
                  <span className="font-medium text-gray-900 text-right">{cancelTarget.room}</span>
                </div>
                <div className="flex justify-between gap-4 mt-2">
                  <span className="text-gray-500">Mã đặt phòng</span>
                  <span className="font-mono font-semibold text-gray-900">
                    {formatBookingCode(cancelTarget.id)}
                  </span>
                </div>
              </div>

              {cancelError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {cancelError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeCancelConfirm}
                  disabled={Boolean(cancellingId)}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl font-medium hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Giữ đặt phòng
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={Boolean(cancellingId)}
                  className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {cancellingId === cancelTarget.id ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Đang hủy...
                    </>
                  ) : (
                    'Xác nhận hủy'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />

      {reviewTarget && (
        <ReviewForm
          hotelId={reviewTarget.hotelId}
          hotelName={reviewTarget.hotelName}
          booking={reviewTarget.booking}
          onSuccess={() => {
            setReviewedBookingIds((prev) => new Set([...prev, reviewTarget.booking._id]));
            setReviewTarget(null);
          }}
          onClose={() => setReviewTarget(null)}
        />
      )}
    </div>
  );
};

export default MyBookings;
