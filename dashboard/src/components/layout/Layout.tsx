import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { clearToken } from '../../services/api';
import {
  LayoutDashboard, Users, Truck, Package, RotateCcw,
  BookOpen, FileText, Map, Settings, LogOut, Menu, X,
  Bell, Search, ChevronDown, Zap,
} from 'lucide-react';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [{ path: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Operations',
    items: [
      { path: '/routes',  label: 'Routes',  icon: Map },
      { path: '/drivers', label: 'Drivers', icon: Truck },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { path: '/customers', label: 'Customers', icon: Users },
      { path: '/invoices',  label: 'Invoices',  icon: FileText },
      { path: '/credits',   label: 'Credits',   icon: RotateCcw },
    ],
  },
  {
    label: 'Warehouse',
    items: [{ path: '/inventory', label: 'Inventory', icon: Package }],
  },
  {
    label: 'Finance',
    items: [{ path: '/quickbooks', label: 'QuickBooks', icon: BookOpen }],
  },
];

const ROUTE_LABELS: Record<string, string> = {
  '/':           'Dashboard',
  '/routes':     'Routes',
  '/drivers':    'Drivers',
  '/customers':  'Customers',
  '/invoices':   'Invoices',
  '/credits':    'Credits',
  '/inventory':  'Inventory',
  '/quickbooks': 'QuickBooks',
  '/settings':   'Settings',
};

function Header({ onMenuToggle, sidebarOpen }: { onMenuToggle: () => void; sidebarOpen: boolean }) {
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const currentLabel = Object.entries(ROUTE_LABELS)
    .find(([path]) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path + '/')))
    ?.[1] ?? 'Olmos DSD';

  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  return (
    <header className="h-14 bg-dark-card border-b border-dark-border flex items-center px-4 gap-3 flex-shrink-0">
      <button
        onClick={onMenuToggle}
        className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-dark-border transition-colors"
      >
        {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      <span className="text-sm font-semibold text-white hidden sm:block">{currentLabel}</span>
      <div className="flex-1" />

      <div className="relative hidden md:block">
        {searchOpen ? (
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search anything..."
              onBlur={() => setSearchOpen(false)}
              className="h-8 pl-8 pr-3 w-64 bg-dark border border-dark-border rounded-lg text-xs text-white placeholder:text-muted focus:border-primary focus:outline-none transition-colors"
            />
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 h-8 bg-dark border border-dark-border rounded-lg text-xs text-muted hover:text-white hover:border-primary/40 transition-colors"
          >
            <Search size={13} />
            <span>Search...</span>
            <kbd className="ml-1 px-1 py-0.5 text-[10px] bg-dark-border rounded font-mono">⌘K</kbd>
          </button>
        )}
      </div>

      <button className="relative p-1.5 rounded-lg text-muted hover:text-white hover:bg-dark-border transition-colors">
        <Bell size={18} />
        <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full ring-2 ring-dark-card" />
      </button>

      <div className="flex items-center gap-2 pl-3 border-l border-dark-border cursor-pointer">
        <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
          <span className="text-xs font-bold text-primary">AD</span>
        </div>
        <div className="hidden sm:block">
          <p className="text-xs font-semibold text-white leading-tight">Admin</p>
          <p className="text-[10px] text-muted leading-tight">Manager</p>
        </div>
        <ChevronDown size={12} className="text-muted" />
      </div>
    </header>
  );
}

function Sidebar({ open }: { open: boolean }) {
  const navigate = useNavigate();

  return (
    <aside
      className="flex flex-col bg-dark-card border-r border-dark-border transition-all duration-200 ease-in-out flex-shrink-0"
      style={{ width: open ? '224px' : '56px' }}
    >
      <div className="flex items-center gap-2.5 px-3 h-14 border-b border-dark-border flex-shrink-0 overflow-hidden">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Zap size={14} className="text-dark" />
        </div>
        {open && (
          <div className="overflow-hidden whitespace-nowrap animate-fade-in">
            <span className="text-sm font-bold text-white">Olmos DSD</span>
            <p className="text-[10px] text-muted leading-none">Route Accounting</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_GROUPS.map(group => (
          <div key={group.label} className="mb-1">
            {open && (
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-subtle uppercase tracking-widest">
                {group.label}
              </p>
            )}
            {group.items.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 mx-2 px-2.5 py-2 rounded-lg transition-colors duration-100 ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
                    )}
                    <item.icon size={16} className="flex-shrink-0" />
                    {open && <span className="text-sm font-medium truncate animate-fade-in">{item.label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-dark-border py-2">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 mx-2 px-2.5 py-2 rounded-lg transition-colors duration-100 ${
              isActive ? 'bg-primary/10 text-primary' : 'text-muted hover:text-white hover:bg-white/5'
            }`
          }
        >
          <Settings size={16} className="flex-shrink-0" />
          {open && <span className="text-sm font-medium">Settings</span>}
        </NavLink>
        <button
          onClick={() => { clearToken(); navigate('/login'); }}
          className="flex items-center gap-3 mx-2 px-2.5 py-2 w-[calc(100%-16px)] rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors duration-100"
        >
          <LogOut size={16} className="flex-shrink-0" />
          {open && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </aside>
  );
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-dark overflow-hidden">
      <Sidebar open={sidebarOpen} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header sidebarOpen={sidebarOpen} onMenuToggle={() => setSidebarOpen(v => !v)} />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
