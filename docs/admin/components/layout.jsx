import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import LogoutButton from './logoutButton';

const navItems = [
  { name: "Dashboard", path: "/" },
  { name: "Inventory", path: "/inventory" },
  { name: "Sales", path: "/sales" },
  { name: "Reports", path: "/reports" },
  { name: "Employee", path: "/employee" },
  { name: "Payment", path: "/payment" },
  { name: "Customer", path: "/customer" },
  { name: "Settings", path: "/settings" },
];

const Layout = ({ children, title = "Butchee Admin" }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Create breadcrumb parts from URL
  const breadcrumbs = location.pathname.split("/").filter(Boolean);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar - unchanged as requested */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex flex-col w-64 bg-white border-r shadow-md transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="p-6 pb-4 text-2xl font-bold border-b">Butchee Admin</div>
        
        <nav className="flex-1 px-6 py-4 space-y-4 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-4 py-3 rounded-lg hover:bg-gray-100 text-base transition-colors duration-200 ${
                location.pathname === item.path ? "bg-gray-200 font-semibold" : ""
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              {item.name}
            </Link>
          ))}
        </nav>
        
        <div className="p-6 pt-4 border-t">
          <LogoutButton className="w-full" />
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black opacity-30 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main content - FIXED: Proper margin handling */}
      <div className={`flex-1 flex flex-col transition-all duration-200 ${
        sidebarOpen ? "md:ml-64" : "md:ml-0"
      } ml-0 md:ml-64`}>
        {/* Mobile header */}
        <header className="flex items-center justify-between bg-white p-4 shadow-md md:hidden">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-700 focus:outline-none"
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            aria-expanded={sidebarOpen}
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
        <div className="p-4 text-sm text-gray-600 bg-gray-100 border-b whitespace-nowrap overflow-x-auto">
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
        <main className="p-6 flex-1 min-h-screen overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;