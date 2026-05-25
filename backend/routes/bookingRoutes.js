const express = require('express');
const router = express.Router();
const {
  createBooking,
  createBookingPayment,
  confirmBooking,
  checkInBooking,
  checkOutBooking,
  getBookings,
  getUserBookings,
  getBooking,
  updateBooking,
  deleteBooking,
  checkAvailability,
  handleMomoIpn,
  handleMomoReturn,
  handleVnpayIpn,
  handleVnpayReturn,
} = require('../controllers/bookingController');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

// Public
router.get('/check-availability', checkAvailability);
router.get('/payments/vnpay-return', handleVnpayReturn);
router.get('/payments/vnpay-ipn', handleVnpayIpn);
router.get('/payments/momo-return', handleMomoReturn);
router.post('/payments/momo-ipn', handleMomoIpn);

// Authenticated
router.use(verifyToken);

// User routes
router.post('/', createBooking);
router.post('/:id/payments', createBookingPayment);
router.get('/user/:id', getUserBookings);
router.delete('/:id', deleteBooking);

// Admin workflow routes (must be before /:id to avoid conflict)
router.patch('/:id/confirm', verifyAdmin, confirmBooking);
router.patch('/:id/checkin', verifyAdmin, checkInBooking);
router.patch('/:id/checkout', verifyAdmin, checkOutBooking);

// Admin generic routes
router.get('/', verifyAdmin, getBookings);
router.patch('/:id', verifyAdmin, updateBooking);

// Single booking (after specific routes)
router.get('/:id', getBooking);

module.exports = router;
