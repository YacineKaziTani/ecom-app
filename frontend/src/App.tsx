import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router";
import { PublicLayout } from "./components/PublicLayout";
import { DashboardLayout } from "./components/DashboardLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PageLoader } from "./components/ui/PageLoader";
import Shop from "./pages/Shop";

// The storefront home stays in the main bundle; every other page (and the
// whole dashboard, including the charting library) is downloaded on demand.
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const ShopsDirectory = lazy(() => import("./pages/ShopsDirectory"));
const ShopPage = lazy(() => import("./pages/ShopPage"));
const Cart = lazy(() => import("./pages/Cart"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentFailure = lazy(() => import("./pages/PaymentFailure"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));
const MyOrders = lazy(() => import("./pages/MyOrders"));
const Profile = lazy(() => import("./pages/Profile"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

const Overview = lazy(() => import("./pages/dashboard/Overview"));
const ProductsAdmin = lazy(() => import("./pages/dashboard/ProductsAdmin"));
const CategoriesAdmin = lazy(() => import("./pages/dashboard/CategoriesAdmin"));
const OrdersAdmin = lazy(() => import("./pages/dashboard/OrdersAdmin"));
const MyShop = lazy(() => import("./pages/dashboard/MyShop"));
const UsersAdmin = lazy(() => import("./pages/dashboard/UsersAdmin"));
const CouponsAdmin = lazy(() => import("./pages/dashboard/CouponsAdmin"));
const Analytics = lazy(() => import("./pages/dashboard/Analytics"));

export default function App() {
  return (
    // Pages inside the layouts suspend within the layout (navbar/sidebar stay
    // put); this outer boundary covers the standalone auth pages.
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<PublicLayout />}>
          <Route path="/" element={<Shop />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/shops" element={<ShopsDirectory />} />
          <Route path="/shops/:slug" element={<ShopPage />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/order-confirmation/:id" element={<OrderConfirmation />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/failure" element={<PaymentFailure />} />
          <Route path="/track-order" element={<TrackOrder />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/orders" element={<MyOrders />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute adminOnly />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Overview />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="products" element={<ProductsAdmin />} />
            <Route path="categories" element={<CategoriesAdmin />} />
            <Route path="orders" element={<OrdersAdmin />} />
            <Route path="coupons" element={<CouponsAdmin />} />
            <Route path="my-shop" element={<MyShop />} />
            <Route path="users" element={<UsersAdmin />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
