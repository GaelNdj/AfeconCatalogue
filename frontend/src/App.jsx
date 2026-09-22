import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { loadCurrencyConfig } from './api.js';
import Header from './components/Header.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import ProductPage from './pages/ProductPage.jsx';
import CartPage from './pages/CartPage.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminProducts from './pages/admin/AdminProducts.jsx';
import AdminReferences from './pages/admin/AdminReferences.jsx';
import AdminFamilies from './pages/admin/AdminFamilies.jsx';
import AdminImport from './pages/admin/AdminImport.jsx';
import AdminMargins from './pages/admin/AdminMargins.jsx';
import AdminShipping from './pages/admin/AdminShipping.jsx';
import ContactPage from './pages/ContactPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import QuoteCheckoutPage, { OrderCheckoutPage } from './pages/QuoteCheckoutPage.jsx';
import QuoteDetailPage from './pages/QuoteDetailPage.jsx';
import OrderDetailPage from './pages/OrderDetailPage.jsx';
import OrderPaymentPage from './pages/OrderPaymentPage.jsx';
import AdminOrders from './pages/admin/AdminOrders.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import { ADMIN_BASE_PATH } from './adminPaths.js';

export default function App() {
  useEffect(() => {
    loadCurrencyConfig().catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <Routes>
        <Route path="/" element={<CatalogPage />} />
        <Route path="/produit/:id" element={<ProductPage />} />
        <Route path="/panier" element={<CartPage />} />
        <Route path="/panier/devis" element={<QuoteCheckoutPage />} />
        <Route path="/panier/commande" element={<OrderCheckoutPage />} />
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/inscription" element={<RegisterPage />} />
        <Route path="/mot-de-passe/oublie" element={<ForgotPasswordPage />} />
        <Route path="/mot-de-passe/reinitialiser" element={<ResetPasswordPage />} />
        <Route
          path="/compte"
          element={
            <RequireAuth>
              <AccountPage />
            </RequireAuth>
          }
        />
        <Route path="/compte/devis/:id" element={<QuoteDetailPage />} />
        <Route path="/compte/commande/:id/paiement" element={<OrderPaymentPage />} />
        <Route path="/compte/commande/:id" element={<OrderDetailPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path={ADMIN_BASE_PATH} element={<AdminLayout />}>
          <Route index element={<AdminProducts />} />
          <Route path="references" element={<AdminReferences />} />
          <Route path="familles" element={<AdminFamilies />} />
          <Route path="marges" element={<AdminMargins />} />
          <Route path="livraison" element={<AdminShipping />} />
          <Route path="import" element={<AdminImport />} />
          <Route path="commandes" element={<AdminOrders />} />
        </Route>
      </Routes>
    </div>
  );
}
