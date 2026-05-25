import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { WishlistProvider } from "./context/WishlistContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/Home";
import Hotels from "./pages/Hotels";
import HotelDetail from "./pages/HotelDetail";
import Booking from "./pages/Booking";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import MyBookings from "./pages/MyBookings";
import PaymentResult from "./pages/PaymentResult";
import Wishlist from "./pages/Wishlist";
import Blog from "./pages/Blog";
import BlogDetail from "./pages/BlogDetail";
import Partnership from "./pages/Partnership";

import AdminLayout from "./components/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import HotelsManagement from "./pages/admin/HotelsManagement";
import RoomsManagement from "./pages/admin/RoomsManagement";
import BookingsManagement from "./pages/admin/BookingsManagement";
import UsersManagement from "./pages/admin/UsersManagement";
import AmenitiesManagement from "./pages/admin/AmenitiesManagement";
import BlogManagement from "./pages/admin/BlogManagement";
import CustomerSupport from "./pages/admin/CustomerSupport";
import ChatWidget from "./components/ChatWidget";

function App() {
  return (
    <AuthProvider>
      <WishlistProvider>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/hotels" element={<Hotels />} />
            <Route path="/hotels/:id" element={<HotelDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/payment-result" element={<PaymentResult />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:id" element={<BlogDetail />} />
            <Route path="/partnership" element={<Partnership />} />

            {/* Protected Routes - Require Login */}
            <Route
              path="/booking"
              element={
                <ProtectedRoute>
                  <Booking />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-bookings"
              element={
                <ProtectedRoute>
                  <MyBookings />
                </ProtectedRoute>
              }
            />

            {/* Admin Routes - Require Admin Role */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="hotels" element={<HotelsManagement />} />
              <Route path="rooms" element={<RoomsManagement />} />
              <Route path="bookings" element={<BookingsManagement />} />
              <Route path="users" element={<UsersManagement />} />
              <Route path="amenities" element={<AmenitiesManagement />} />
              <Route path="blog" element={<BlogManagement />} />
              <Route path="support" element={<CustomerSupport />} />
            </Route>
          </Routes>
          <ChatWidget />
        </Router>
      </WishlistProvider>
    </AuthProvider>
  );
}

export default App;
