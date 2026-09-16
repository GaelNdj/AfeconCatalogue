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
import AccountPage from './pages/AccountPage.jsx';
import QuoteCheckoutPage from './pages/QuoteCheckoutPage.jsx';
import QuoteDetailPage from './pages/QuoteDetailPage.jsx';
import OrderDetailPage from './pages/OrderDetailPage.jsx';
import AdminOrders from './pages/admin/AdminOrders.jsx';
import RequireAuth from './components/RequireAuth.jsx';

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
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/inscription" element={<RegisterPage />} />
        <Route
          path="/compte"
          element={
            <RequireAuth>
              <AccountPage />
            </RequireAuth>
          }
        />
        <Route path="/compte/devis/:id" element={<QuoteDetailPage />} />
        <Route path="/compte/commande/:id" element={<OrderDetailPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/admin" element={<AdminLayout />}>
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
