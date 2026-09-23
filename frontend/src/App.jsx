import { Routes, Route } from "react-router-dom";

import Navbar from "./landing_page/Navbar";
import Footer from "./landing_page/Footer";

import HomePage from "./landing_page/home/HomePage";
import ProductsPage from "./landing_page/products/ProductsPage";
import PricingPage from "./landing_page/pricing/PricingPage";
import AboutPage from "./landing_page/about/AboutPage";
import SupportPage from "./landing_page/support/SupportPage";
import Signup from "./landing_page/signup/Signup";
import NotFound from "./landing_page/NotFound";

function App() {
  return (
    <>
      <Navbar />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/product" element={<ProductsPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<NotFound />} />
      </Routes>

      <Footer />
    </>
  );
}

export default App;
