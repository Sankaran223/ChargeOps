import mongoose from "mongoose";

export const PAYMENT_STATUSES = ["pending", "success", "failed"];
export const PAYMENT_METHODS = ["card", "upi", "wallet", "netbanking"];

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      required: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "pending"
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true
    },
    provider: {
      type: String,
      default: "stripe"
    },
    currency: {
      type: String,
      default: "usd"
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    stripeSessionId: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    stripePaymentIntentId: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

paymentSchema.methods.toSanitizedJSON = function toSanitizedJSON() {
  return {
    id: this._id,
    bookingId: this.bookingId,
    userId: this.userId,
    amount: this.amount,
    status: this.status,
    paymentMethod: this.paymentMethod,
    provider: this.provider,
    currency: this.currency,
    transactionId: this.transactionId,
    stripeSessionId: this.stripeSessionId,
    stripePaymentIntentId: this.stripePaymentIntentId,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
