import { useState } from "react";
import Layout        from "./components/layout/Layout";
import Login         from "./pages/Login";
import Dashboard     from "./pages/Dashboard";
import SLAUpload     from "./pages/SLAUpload";
import InventoryRisk from "./pages/InventoryRisk";
import Suppliers     from "./pages/Suppliers";
import SLAViolations from "./pages/SLAViolations";
import ChatAssistant from "./pages/ChatAssistant";
import Alerts        from "./pages/Alerts";
import { ROLE_HOME, ROLE_PAGES } from "./auth/roles";
import "./styles/dashboard.css";

export default function App() {
  const [user,       setUser]       = useState(null);
  const [activePage, setActivePage] = useState("dashboard");

  const handleLogin = (u) => { setUser(u); setActivePage(ROLE_HOME[u.role] || "dashboard"); };
  const handleLogout = ()  => { setUser(null); setActivePage("dashboard"); };
  const handleNavigate = (page) => {
    if ((ROLE_PAGES[user?.role] || []).includes(page)) setActivePage(page);
  };

  if (!user) return <Login onLogin={handleLogin} />;

  const props = { user, onNavigate: handleNavigate };

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":  return <Dashboard      {...props} />;
      case "sla":        return <SLAUpload      {...props} />;
      case "inventory":  return <InventoryRisk  {...props} />;
      case "suppliers":  return <Suppliers      {...props} />;
      case "violations": return <SLAViolations  {...props} />;
      case "ai":         return <ChatAssistant  {...props} />;
      case "alerts":     return <Alerts         {...props} />;
      default:           return <Dashboard      {...props} />;
    }
  };

  return (
    <Layout activePage={activePage} onNavigate={handleNavigate} user={user} onLogout={handleLogout}>
      {renderPage()}
    </Layout>
  );
}
