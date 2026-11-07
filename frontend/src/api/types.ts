export type UserRole = "super_admin" | "admin" | "customer";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
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

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  imageUrl?: string;
  categoryId?: string;
  category?: Category;
  shopId: string;
  shop?: Shop;
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

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";
export type PaymentStatus = "unpaid" | "paid" | "failed";
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
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  userId?: string;
  guestEmail?: string;
  guestName?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentProvider?: string;
  subtotal: number;
  couponCode?: string;
  discountAmount: number;
  total: number;
  shippingAddress: string;
  items: OrderItem[];
  user?: User;
  // Unpaid orders hold their stock until this moment, then get cancelled.
  reservedUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}
