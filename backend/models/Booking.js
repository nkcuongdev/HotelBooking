const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please provide user ID"],
    },
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: [true, "Please provide hotel ID"],
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: [true, "Please provide room ID"],
    },
    roomNumberId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    roomNumber: {
      type: Number,
      default: 1,
    },
    checkInDate: {
      type: Date,
      required: [true, "Please provide check-in date"],
    },
    checkOutDate: {
      type: Date,
      required: [true, "Please provide check-out date"],
    },
    numberOfGuests: {
      type: Number,
      default: 1,
      min: [1, "Number of guests must be at least 1"],
    },
    totalPrice: {
      type: Number,
      required: [true, "Please provide total price"],
      min: [0, "Total price cannot be negative"],
    },
    paymentMethod: {
      type: String,
      enum: [
        "credit_card",
        "debit_card",
        "paypal",
        "cash",
        "bank_transfer",
        "vnpay",
        "momo",
      ],
      default: "cash",
    },
    paymentGateway: {
      type: String,
      enum: ["vnpay", "momo", null],
      default: null,
    },
    paymentTransaction: {
      type: Object,
      default: {},
    },
    inventoryReleased: {
      type: Boolean,
      default: false,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "checked_in", "completed", "cancelled"],
      default: "pending",
    },
    guestInfo: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Validate check-out date is after check-in date
bookingSchema.pre("save", function (next) {
  if (this.checkOutDate <= this.checkInDate) {
    return next(new Error("Check-out date must be after check-in date"));
  }
  next();
});

// Indexes for faster queries
bookingSchema.index({ userId: 1 });
bookingSchema.index({ hotelId: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ checkInDate: 1, checkOutDate: 1 });

module.exports = mongoose.model("Booking", bookingSchema);

