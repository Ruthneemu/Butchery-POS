// docs/admin/components/Layout.jsx
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import LogoutButton from './logoutButton';


const navItems = [
  { name: "Dashboard", path: "/" },
  { name: "Inventory", path: "/inventory" },
  { name: "Sales", path: "/sales" },
  { name: "Reports", path: "/reports" },
  { name: "Settings", path: "/settings" },
];

const Layout = ({ children, title = "Butchee Admin" }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Create breadcrumb parts from URL
  const breadcrumbs = location.pathname.split("/").filter(Boolean);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 z-30 w-64 h-full bg-white border-r shadow-md transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 text-2xl font-bold border-b">Butchee Admin</div>
        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-4 py-2 rounded hover:bg-gray-100 text-base md:text-sm ${
                location.pathname === item.path ? "bg-gray-200 font-semibold" : ""
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              {item.name}
            </Link>
          ))}
          <div className="mt-6 px-4">
            <LogoutButton />
          </div>
        </nav>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black opacity-30 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)} aria-hidden="true"
        ></div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile header */}
        <header className="flex items-center justify-between bg-white p-4 shadow-md md:hidden">
          <button
  onClick={() => setSidebarOpen(!sidebarOpen)}
  className="text-gray-700 focus:outline-none"
  aria-label={sidebarOpen ? "Close menu" : "Open menu"} aria-expanded={sidebarOpen}
>
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              {sidebarOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M3 12h18M3 6h18M3 18h18" />
              )}
            </svg>
          </button>
          <h1 className="text-xl font-bold">{title}</h1>
        
        </header>

        {/* Breadcrumb */}
        <div className="p-4 text-sm text-gray-600 bg-gray-100 border-b">
          <nav className="flex space-x-2">
            <Link to="/" className="hover:underline text-blue-600">
              Dashboard
            </Link>
            {breadcrumbs.map((crumb, idx) => {
              const path = "/" + breadcrumbs.slice(0, idx + 1).join("/");
              return (
                <React.Fragment key={path}>
                  <span>/</span>
                  <Link to={path} className="hover:underline text-blue-600 capitalize">
                    {crumb}
                  </Link>
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* Page content */}
        <main className="p-6 flex-1 min-h-[calc(100vh-4rem)] overflow-auto">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
