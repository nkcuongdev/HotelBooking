import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Clock, ArrowRight } from "lucide-react";
import Navbar from "../components/Navbar";
import { formatBookingCode } from "../utils/booking";

const gatewayLabels = {
  vnpay: "VNPAY",
  momo: "MoMo",
};

const PaymentResult = () => {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status") || "pending";
  const gateway = searchParams.get("gateway") || "";
  const bookingId = searchParams.get("bookingId") || "";
  const message = searchParams.get("message") || "";

  const isSuccess = status === "success";
  const isPending = status === "pending";
  const Icon = isSuccess ? CheckCircle2 : isPending ? Clock : XCircle;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-14">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div
            className={`px-8 py-10 text-center ${
              isSuccess ? "bg-green-600" : isPending ? "bg-yellow-500" : "bg-red-600"
            }`}
          >
            <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-white/20 flex items-center justify-center">
              <Icon size={44} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">
              {isSuccess
                ? "Thanh toán thành công"
                : isPending
                ? "Đang xử lý thanh toán"
                : "Thanh toán không thành công"}
            </h1>
            <p className="text-white/85 mt-2">
              {gatewayLabels[gateway] || gateway || "Cổng thanh toán"}
            </p>
          </div>

          <div className="p-7 space-y-5">
            <div className="bg-gray-50 rounded-xl p-5 space-y-3">
              {bookingId && (
                <div className="flex justify-between gap-4">
                  <span className="text-sm text-gray-500">Mã đặt phòng</span>
                  <span className="font-mono font-semibold text-gray-900">
                    {formatBookingCode(bookingId)}
                  </span>
                </div>
              )}
              {message && (
                <div className="flex justify-between gap-4">
                  <span className="text-sm text-gray-500">Phản hồi</span>
                  <span className="text-sm font-medium text-gray-900 text-right">
                    {message}
                  </span>
                </div>
              )}
            </div>

            <p className="text-sm text-gray-600">
              {isSuccess
                ? "Đặt phòng đã được ghi nhận là đã thanh toán. Admin sẽ tiếp tục xác nhận đơn."
                : "Thanh toán không thành công nên đơn online sẽ không được giữ phòng. Vui lòng đặt lại nếu bạn vẫn muốn giữ phòng này."}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/my-bookings"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#FF385C] text-white rounded-xl font-semibold hover:bg-[#E31C5F] transition-colors"
              >
                Xem đặt phòng
                <ArrowRight size={18} />
              </Link>
              <Link
                to="/hotels"
                className="flex-1 inline-flex items-center justify-center px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                Tìm phòng khác
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PaymentResult;
