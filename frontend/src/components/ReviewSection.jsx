import { useEffect, useState, useCallback } from 'react';
import { AlertCircle, Loader2, PenLine, X } from 'lucide-react';
import StarRating from './StarRating';
import ReviewForm from './ReviewForm';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const formatDate = (d) =>
  new Date(d).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const RatingBar = ({ label, count, total }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-12 text-right text-gray-500 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#FF385C] rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-gray-400 text-xs">{count}</span>
    </div>
  );
};

const ReviewSection = ({ hotelId, hotelName = '' }) => {
  const { isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [eligibleBookings, setEligibleBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  const fetchReviews = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const res = await api.getHotelReviews(hotelId, { limit: 20 });
      setReviews(res.data || []);
      setAverageRating(res.averageRating || 0);
      setTotal(res.total || 0);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleWriteReview = async () => {
    setNotice(null);
    if (!isAuthenticated) {
      setNotice({
        type: 'warning',
        message: 'Vui lòng đăng nhập để đánh giá.',
      });
      return;
    }
    setEligibleLoading(true);
    try {
      const res = await api.getEligibleBookingsForReview(hotelId);
      const bookings = res.data || [];
      if (bookings.length === 0) {
        setNotice({
          type: 'info',
          message:
            'Bạn không có đặt phòng đã hoàn thành nào chưa được đánh giá tại khách sạn này.',
        });
        return;
      }
      setEligibleBookings(bookings);
      setSelectedBooking(bookings[0]);
      setShowForm(true);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err.message || 'Không thể kiểm tra điều kiện đánh giá.',
      });
    } finally {
      setEligibleLoading(false);
    }
  };

  const handleReviewSuccess = (newReview) => {
    fetchReviews();
  };

  // Distribution breakdown
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    label: `${star} sao`,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  return (
    <div className="py-8 border-t border-gray-200">
      {/* Section header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#FF385C" stroke="#FF385C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span className="text-2xl font-semibold text-gray-900">{averageRating > 0 ? averageRating : '—'}</span>
          <span className="text-gray-500">· {total} đánh giá</span>
        </div>

        {isAuthenticated && (
          <button
            onClick={handleWriteReview}
            disabled={eligibleLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF385C] text-white text-sm font-medium rounded-xl hover:bg-[#E31C5F] disabled:opacity-60 transition-colors cursor-pointer"
          >
            {eligibleLoading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <PenLine size={15} />
            )}
            Viết đánh giá
          </button>
        )}
      </div>

      {notice && (
        <div
          className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            notice.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : notice.type === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-blue-200 bg-blue-50 text-blue-800'
          }`}
          role="status"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p className="flex-1 leading-6">{notice.message}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rounded-md p-1 hover:bg-black/5 cursor-pointer"
            aria-label="Đóng thông báo"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Rating breakdown + average */}
      {total > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 p-5 bg-gray-50 rounded-2xl">
          {/* Big score */}
          <div className="flex flex-col items-center justify-center gap-2">
            <span className="text-6xl font-bold text-gray-900">{averageRating}</span>
            <StarRating value={Math.round(averageRating)} readonly size="sm" />
            <span className="text-sm text-gray-500">trên 5 sao</span>
          </div>
          {/* Bars */}
          <div className="flex flex-col justify-center gap-2">
            {distribution.map(({ label, count }) => (
              <RatingBar key={label} label={label} count={count} total={total} />
            ))}
          </div>
        </div>
      )}

      {/* Booking selector (if multiple eligible) */}
      {showForm && eligibleBookings.length > 1 && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm font-medium text-blue-800 mb-2">Chọn đặt phòng để đánh giá:</p>
          <div className="flex flex-wrap gap-2">
            {eligibleBookings.map((b) => (
              <button
                key={b._id}
                onClick={() => setSelectedBooking(b)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer ${
                  selectedBooking?._id === b._id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
                }`}
              >
                {formatDate(b.checkInDate)} – {formatDate(b.checkOutDate)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Review list */}
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Đang tải đánh giá...</span>
        </div>
      ) : reviews.length === 0 ? (
        <div className="py-10 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">Chưa có đánh giá nào. Hãy là người đầu tiên!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {reviews.map((review) => {
            const userName =
              review.userId?.name || review.user?.name || review.userName || 'Khách';
            const initials = userName
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <div key={review._id || review.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF385C] to-[#E31C5F] flex items-center justify-center text-white text-sm font-semibold shrink-0">
                    {initials}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm leading-tight">{userName}</p>
                    <p className="text-xs text-gray-400">{formatDate(review.createdAt)}</p>
                  </div>
                  <div className="ml-auto">
                    <StarRating value={review.rating} readonly size="sm" />
                  </div>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed pl-13">
                  {review.comment}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Review form modal */}
      {showForm && selectedBooking && (
        <ReviewForm
          hotelId={hotelId}
          hotelName={hotelName}
          booking={selectedBooking}
          onSuccess={(newReview) => {
            handleReviewSuccess(newReview);
            setShowForm(false);
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
};

export default ReviewSection;
