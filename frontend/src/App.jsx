import { Routes, Route } from 'react-router-dom';
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

export default function App() {
  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <Routes>
        <Route path="/" element={<CatalogPage />} />
        <Route path="/produit/:id" element={<ProductPage />} />
        <Route path="/panier" element={<CartPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminProducts />} />
          <Route path="references" element={<AdminReferences />} />
          <Route path="familles" element={<AdminFamilies />} />
          <Route path="marges" element={<AdminMargins />} />
          <Route path="livraison" element={<AdminShipping />} />
          <Route path="import" element={<AdminImport />} />
        </Route>
      </Routes>
    </div>
  );
}
