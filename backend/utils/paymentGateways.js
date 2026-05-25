const crypto = require("crypto");

const DEFAULT_VNPAY_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
const DEFAULT_MOMO_ENDPOINT = "https://test-payment.momo.vn/v2/gateway/api/create";

const sortObject = (obj) =>
  Object.keys(obj)
    .sort()
    .reduce((result, key) => {
      const value = obj[key];
      if (value !== undefined && value !== null && value !== "") {
        result[key] = String(value);
      }
      return result;
    }, {});

const vnpayEncode = (value) =>
  encodeURIComponent(String(value)).replace(/%20/g, "+");

const sortVnpayParams = (obj) =>
  Object.keys(obj)
    .sort()
    .reduce((result, key) => {
      const value = obj[key];
      if (value !== undefined && value !== null && value !== "") {
        result[key] = vnpayEncode(value);
      }
      return result;
    }, {});

const stringifyVnpayParams = (params) =>
  Object.keys(params)
    .map((key) => `${key}=${params[key]}`)
    .join("&");

const formatDate = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, "0");
  return (
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
};

const getGatewayAmount = (amount) => {
  const multiplier = Number(process.env.PAYMENT_AMOUNT_MULTIPLIER || 1);
  return Math.round(Number(amount || 0) * multiplier);
};

const signVnpayParams = (params) => {
  const sortedParams = sortVnpayParams(params);
  const signData = stringifyVnpayParams(sortedParams);

  return crypto
    .createHmac("sha512", process.env.VNPAY_HASH_SECRET || "")
    .update(Buffer.from(signData, "utf-8"))
    .digest("hex");
};

const createVnpayPaymentUrl = ({ booking, ipAddr, returnUrl }) => {
  if (!process.env.VNPAY_TMN_CODE || !process.env.VNPAY_HASH_SECRET) {
    throw new Error("Missing VNPAY_TMN_CODE or VNPAY_HASH_SECRET");
  }

  const params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: process.env.VNPAY_TMN_CODE,
    vnp_Locale: "vn",
    vnp_CurrCode: "VND",
    vnp_TxnRef: booking._id.toString(),
    vnp_OrderInfo: `Thanh toan booking ${booking._id}`,
    vnp_OrderType: "billpayment",
    vnp_Amount: getGatewayAmount(booking.totalPrice) * 100,
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr || "127.0.0.1",
    vnp_CreateDate: formatDate(),
  };

  const sortedParams = sortVnpayParams(params);
  const secureHash = signVnpayParams(params);
  const paymentUrl = `${
    process.env.VNPAY_PAYMENT_URL || DEFAULT_VNPAY_URL
  }?${stringifyVnpayParams(sortedParams)}&vnp_SecureHash=${secureHash}`;

  return {
    gateway: "vnpay",
    paymentUrl,
    orderId: booking._id.toString(),
    amount: getGatewayAmount(booking.totalPrice),
  };
};

const verifyVnpayParams = (params) => {
  const receivedHash = params.vnp_SecureHash;
  const data = { ...params };
  delete data.vnp_SecureHash;
  delete data.vnp_SecureHashType;

  const secureHash = signVnpayParams(data);
  return secureHash === receivedHash;
};

const signMomoRaw = (rawSignature) =>
  crypto
    .createHmac("sha256", process.env.MOMO_SECRET_KEY || "")
    .update(rawSignature)
    .digest("hex");

const createMomoPayment = async ({ booking, redirectUrl, ipnUrl, guestInfo }) => {
  if (
    !process.env.MOMO_PARTNER_CODE ||
    !process.env.MOMO_ACCESS_KEY ||
    !process.env.MOMO_SECRET_KEY
  ) {
    throw new Error("Missing MOMO_PARTNER_CODE, MOMO_ACCESS_KEY or MOMO_SECRET_KEY");
  }

  const partnerCode = process.env.MOMO_PARTNER_CODE;
  const accessKey = process.env.MOMO_ACCESS_KEY;
  const orderId = booking._id.toString();
  const requestId = `REQ${orderId}${Date.now()}`;
  const requestType = "captureWallet";
  const amount = getGatewayAmount(booking.totalPrice);
  const orderInfo = `Thanh toan booking ${orderId}`;
  const extraData = Buffer.from(JSON.stringify({ bookingId: orderId })).toString("base64");

  const rawSignature =
    `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}` +
    `&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}` +
    `&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}` +
    `&requestId=${requestId}&requestType=${requestType}`;

  const body = {
    partnerCode,
    requestType,
    ipnUrl,
    redirectUrl,
    orderId,
    amount,
    orderInfo,
    requestId,
    extraData,
    signature: signMomoRaw(rawSignature),
    lang: "vi",
    userInfo: guestInfo
      ? {
          name: `${guestInfo.firstName || ""} ${guestInfo.lastName || ""}`.trim(),
          phoneNumber: guestInfo.phone || "",
          email: guestInfo.email || "",
        }
      : undefined,
  };

  const response = await fetch(process.env.MOMO_ENDPOINT || DEFAULT_MOMO_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok || Number(data.resultCode) !== 0 || !data.payUrl) {
    throw new Error(data.message || "MoMo payment session failed");
  }

  return {
    gateway: "momo",
    paymentUrl: data.payUrl,
    orderId,
    requestId,
    amount,
    rawResponse: data,
  };
};

const verifyMomoParams = (params) => {
  const receivedSignature = params.signature;
  const accessKey = process.env.MOMO_ACCESS_KEY || "";
  const rawSignature =
    `accessKey=${accessKey}&amount=${params.amount || ""}` +
    `&extraData=${params.extraData || ""}&message=${params.message || ""}` +
    `&orderId=${params.orderId || ""}&orderInfo=${params.orderInfo || ""}` +
    `&orderType=${params.orderType || ""}&partnerCode=${params.partnerCode || ""}` +
    `&payType=${params.payType || ""}&requestId=${params.requestId || ""}` +
    `&responseTime=${params.responseTime || ""}&resultCode=${params.resultCode || ""}` +
    `&transId=${params.transId || ""}`;

  return signMomoRaw(rawSignature) === receivedSignature;
};

module.exports = {
  createMomoPayment,
  createVnpayPaymentUrl,
  getGatewayAmount,
  verifyMomoParams,
  verifyVnpayParams,
};
