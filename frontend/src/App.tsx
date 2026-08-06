import { Routes, Route } from "react-router";
import { PublicLayout } from "./components/PublicLayout";
import { DashboardLayout } from "./components/DashboardLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";

import Shop from "./pages/Shop";
import ProductDetail from "./pages/ProductDetail";
import ShopsDirectory from "./pages/ShopsDirectory";
import ShopPage from "./pages/ShopPage";
import Cart from "./pages/Cart";
import OrderConfirmation from "./pages/OrderConfirmation";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentFailure from "./pages/PaymentFailure";
import TrackOrder from "./pages/TrackOrder";
import MyOrders from "./pages/MyOrders";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

import Overview from "./pages/dashboard/Overview";
import ProductsAdmin from "./pages/dashboard/ProductsAdmin";
import CategoriesAdmin from "./pages/dashboard/CategoriesAdmin";
import OrdersAdmin from "./pages/dashboard/OrdersAdmin";
import MyShop from "./pages/dashboard/MyShop";
import UsersAdmin from "./pages/dashboard/UsersAdmin";
import CouponsAdmin from "./pages/dashboard/CouponsAdmin";
import Analytics from "./pages/dashboard/Analytics";

export default function App() {
  return (
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

      <Route path="*" element={<div className="flex h-screen items-center justify-center text-gray-400">Page not found</div>} />
    </Routes>
  );
}
