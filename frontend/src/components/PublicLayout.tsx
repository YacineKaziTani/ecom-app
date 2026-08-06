import { Outlet } from "react-router";
import { Navbar } from "./Navbar";

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
