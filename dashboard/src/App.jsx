import { Route, Routes } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import Authentication from "./pages/Authentication";
import Home from "./pages/Home";
import withAuth from "./utils/withAuth";

const ProtectedHome = withAuth(Home);

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Authentication mode="login" />} />
        <Route path="/signup" element={<Authentication mode="signup" />} />
        <Route path="/*" element={<ProtectedHome />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
