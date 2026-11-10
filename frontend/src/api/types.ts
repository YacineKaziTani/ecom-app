export type UserRole = "super_admin" | "admin" | "customer";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  wilayaCode?: number | null;
  commune?: string | null;
  locale?: "en" | "fr" | "ar"; // language of this account's emails
  role: UserRole;
  emailVerifiedAt?: string | null;
  totpEnabledAt?: string | null; // two-factor sign-in on
  createdAt: string;
  updatedAt: string;
}

// A saved delivery address from the customer's address book.
export interface Address {
  id: string;
  label: string; // "Maison", "Travail"...
  phone: string;
  wilayaCode: number;
  commune: string;
  address: string;
  isDefault: boolean;
  createdAt: string;
}

export interface Shop {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// One purchasable option of a product ("M", "Bleu / L") with its own stock
// and, optionally, its own price (null = the product's price).
export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku?: string | null;
  price?: number | string | null; // decimal from the API
  stock: number;
  position: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  imageUrl?: string;
  galleryUrls?: string[];
  ratingAverage?: number | string; // decimal from the API
  ratingCount?: number;
  categoryId?: string;
  category?: Category;
  shopId: string;
  shop?: Shop;
  // Product page only; ordered for display.
  variants?: ProductVariant[];
  // Listings only: how many options must be chosen from.
  variantCount?: number;
  createdAt: string;
  updatedAt: string;
}

// The shape every paginated list endpoint returns.
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type ProductListResponse = Paginated<Product>;

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned"; // parcel came back (refused, unreachable…)

export type CallOutcome = "confirmed" | "no_answer" | "declined" | "wrong_number";

export interface OrderCall {
  id: string;
  outcome: CallOutcome;
  note?: string | null;
  createdAt: string;
}

// A phone number's delivery history across the platform (admin only).
export interface CustomerRisk {
  orders: number;
  delivered: number;
  returned: number;
  refused: number;
  blocked: boolean;
  level: "low" | "medium" | "high" | "blocked";
}

export interface BlockedPhone {
  phone: string;
  reason?: string | null;
  createdAt: string;
}
export type PaymentStatus = "unpaid" | "paid" | "failed";
// card = online via Chargily; cod = cash to the courier on delivery.
export type PaymentMethod = "card" | "cod";
// home = to the door; desk = pick-up at the carrier's office ("stop desk").
export type DeliveryType = "home" | "desk";

export interface ShippingZone {
  code: number; // wilaya code
  name: string;
  nameAr: string;
  homePrice: number;
  deskPrice: number | null; // null = stop desk not offered
  isActive: boolean;
}
export type CouponType = "percentage" | "fixed";

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  shopId?: string;
  minOrderAmount?: number;
  maxUses?: number;
  usedCount: number;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  productId?: string;
  shopId?: string;
  productName: string;
  variantId?: string | null;
  variantName?: string | null; // the option bought, e.g. "M"
  price: number;
  quantity: number;
}

// One shop's part of an order — each shop ships (and tracks) its own items.
export interface Shipment {
  id: string;
  orderId: string;
  shopId: string;
  status: OrderStatus;
  carrier?: string | null;
  trackingNumber?: string | null;
  shop?: Shop;
  updatedAt: string;
}

export interface ShopBalance {
  shopId: string;
  shopName: string;
  sales: number;
  commission: number;
  discounts: number;
  earned: number;
  paidOut: number;
  balance: number;
}

export interface Payout {
  id: string;
  shopId: string;
  shop?: Shop;
  amount: number;
  reference?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface Review {
  id: string;
  productId: string;
  rating: number;
  comment?: string | null;
  author?: string; // "Amina B."
  createdAt: string;
}

export interface ReviewList extends Paginated<Review> {
  mine: Review | null;
  canReview: boolean;
}

export interface WishlistItem {
  id: string;
  productId: string;
  product: Product;
  createdAt: string;
}

export type ApplicationStatus = "pending" | "approved" | "rejected";

export interface SellerApplication {
  id: string;
  userId: string;
  user?: User;
  shopName: string;
  description?: string | null;
  phone: string;
  wilayaCode?: number | null;
  message?: string | null;
  status: ApplicationStatus;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  ip?: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  userId?: string;
  guestEmail?: string;
  guestName?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paymentProvider?: string;
  subtotal: number;
  couponCode?: string;
  discountAmount: number;
  shippingFee: number;
  total: number;
  shippingAddress: string;
  phone?: string | null;
  wilayaCode?: number | null;
  wilayaName?: string | null;
  commune?: string | null;
  deliveryType?: DeliveryType | null;
  items: OrderItem[];
  shipments?: Shipment[];
  user?: User;
  // Unpaid orders hold their stock until this moment, then get cancelled.
  reservedUntil?: string | null;
  // Pay-on-delivery confirmation and returns (admin views).
  confirmedAt?: string | null;
  callAttempts?: number;
  calls?: OrderCall[];
  returnedAt?: string | null;
  returnReason?: string | null;
  returnCost?: number | string;
  customerRisk?: CustomerRisk | null;
  // "customer" when the customer cancelled it themselves.
  cancelledBy?: "customer" | null;
  createdAt: string;
  updatedAt: string;
}
