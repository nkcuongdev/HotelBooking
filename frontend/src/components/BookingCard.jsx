import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatVnd } from "../utils/currency";

const BookingCard = ({ hotel, selectedRoom }) => {
  const navigate = useNavigate();
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);

  const basePrice = selectedRoom?.price ?? 0;
  const maxGuests = Math.max(
    1,
    Number(selectedRoom?.capacity || selectedRoom?.maxPeople || 6),
  );
  const nights =
    checkIn && checkOut
      ? Math.ceil(
          (new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24),
        )
      : 0;
  const totalPrice = basePrice * nights;
  const today = new Date().toISOString().split("T")[0];
  const hasSelectedDates = Boolean(checkIn && checkOut && nights > 0);
  const canReserve = Boolean(selectedRoom && checkIn && checkOut && nights > 0);

  useEffect(() => {
    if (guests > maxGuests) {
      setGuests(maxGuests);
    }
  }, [guests, maxGuests]);

  const handleReserve = () => {
    const resolvedHotelId = hotel?.id || hotel?._id || "";
    const resolvedRoomId = selectedRoom?.id || selectedRoom?._id || "";
    const resolvedRoomNumberId = selectedRoom?.roomNumberId || "";

    if (!resolvedHotelId || !resolvedRoomId) {
      alert("Thiếu thông tin khách sạn/phòng. Vui lòng chọn lại phòng.");
      return;
    }

    if (checkIn && checkIn < today) {
      alert("Ngày check-in không được ở quá khứ.");
      return;
    }
    if (checkOut && checkOut <= checkIn) {
      alert("Ngày check-out phải sau check-in.");
      return;
    }

    navigate(
      `/booking?hotelId=${encodeURIComponent(resolvedHotelId)}&roomId=${encodeURIComponent(
        resolvedRoomId,
      )}&roomNumberId=${encodeURIComponent(
        resolvedRoomNumberId,
      )}&checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(
        checkOut,
      )}&guests=${encodeURIComponent(guests)}`,
    );
  };

  return (
    <div className="sticky top-28 bg-white border border-gray-200 rounded-2xl shadow-lg p-6">
      {/* Price Header */}
      <div className="flex items-baseline gap-2 mb-6">
        {selectedRoom ? (
          <>
            <span className="text-2xl font-semibold">{formatVnd(basePrice)}</span>
            <span className="text-gray-500">/ đêm</span>
          </>
        ) : (
          <span className="text-base text-gray-400 italic">
            Chưa chọn phòng
          </span>
        )}
      </div>

      {/* Date & Guest Picker */}
      <div className="border border-gray-300 rounded-xl overflow-hidden mb-4">
        {/* Dates */}
        <div className="grid grid-cols-2 border-b border-gray-300">
          <div className="p-3 border-r border-gray-300">
            <label className="block text-xs font-semibold text-gray-800 uppercase mb-1">
              Nhận phòng
            </label>
            <input
              type="date"
              value={checkIn}
              min={today}
              onChange={(e) => {
                const nextCheckIn = e.target.value;
                setCheckIn(nextCheckIn);
                if (checkOut && nextCheckIn && checkOut <= nextCheckIn) {
                  setCheckOut("");
                }
              }}
              className="w-full text-sm outline-none cursor-pointer"
            />
          </div>
          <div className="p-3">
            <label className="block text-xs font-semibold text-gray-800 uppercase mb-1">
              Trả phòng
            </label>
            <input
              type="date"
              value={checkOut}
              min={checkIn || today}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full text-sm outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Guests */}
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-xs font-semibold text-gray-800 uppercase mb-1">
                Số khách
              </label>
              <span className="text-sm text-gray-600">Tối đa {maxGuests} khách</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setGuests(Math.max(1, guests - 1))}
                className="w-8 h-8 border border-gray-300 rounded-full flex items-center justify-center hover:border-gray-900 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                disabled={guests <= 1}
                type="button"
              >
                -
              </button>
              <span className="w-10 text-center text-sm font-medium">
                {guests} khách
              </span>
              <button
                onClick={() => setGuests(Math.min(maxGuests, guests + 1))}
                className="w-8 h-8 border border-gray-300 rounded-full flex items-center justify-center hover:border-gray-900 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                disabled={guests >= maxGuests}
                type="button"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reserve Button */}
      <button
        onClick={handleReserve}
        disabled={!canReserve}
        className={`w-full py-3 text-white font-semibold rounded-xl transition-opacity ${
          canReserve
            ? "bg-linear-to-r from-[#E61E4D] via-[#E31C5F] to-[#D70466] hover:opacity-90 cursor-pointer"
            : "bg-gray-300 cursor-not-allowed"
        }`}
      >
        Đặt phòng
      </button>

      {!hasSelectedDates && (
        <p className="text-center text-sm text-gray-500 mt-3">
          Vui lòng chọn ngày nhận và trả phòng
        </p>
      )}

      {/* Price Breakdown */}
      {selectedRoom && checkIn && checkOut && nights > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
          <div className="flex justify-between text-gray-700">
            <span>
              {formatVnd(basePrice)} x {nights} đêm
            </span>
            <span>{formatVnd(totalPrice)}</span>
          </div>
          <div className="flex justify-between text-gray-700">
            <span>Thuế và phí</span>
            <span className="text-green-600 font-medium text-sm">Đã bao gồm</span>
          </div>
          <div className="flex justify-between font-semibold pt-3 border-t border-gray-200">
            <span>Tổng cộng</span>
            <span className="text-[#FF385C]">{formatVnd(totalPrice)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingCard;
