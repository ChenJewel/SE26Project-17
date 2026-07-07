import { useState } from "react";
import Home from "@/pages/Home";
import Profile from "@/pages/Profile";
import MatchSettings from "@/pages/MatchSettings";
import History from "@/pages/History";
import BottomNav from "@/components/BottomNav";

export default function App() {
  const [currentPage, setCurrentPage] = useState("home");

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return <Home />;
      case "profile":
        return <Profile />;
      case "match":
        return <MatchSettings />;
      case "history":
        return <History />;
      default:
        return <Home />;
    }
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen">
      {renderPage()}
      <BottomNav currentPage={currentPage} onNavigate={handleNavigate} />
    </div>
  );
}
