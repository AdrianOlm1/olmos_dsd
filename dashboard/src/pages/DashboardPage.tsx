import React, { useState, useEffect } from 'react';
import { api, isAuthRedirect } from '../services/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, CartesianGrid } from 'recharts';
import { MetricCardSkeleton } from '../components/ui/Skeleton';
import {
  DollarSign, FileText, TrendingUp, CreditCard,
  Users, Truck, AlertCircle, Clock,
  TrendingDown, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  change?: number;
  sub?: string;
}

function MetricCard({ label, value, icon, iconBg, change, sub }: MetricCardProps) {
  return (
    <div className="card p-5 hover:border-dark-border/80 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">{label}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      <div className="flex items-center gap-2 mt-2">
        {change !== undefined && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
            change >= 0 ? 'text-success' : 'text-danger'
          }`}>
            {change >= 0
              ? <ArrowUpRight size={12} />
              : <ArrowDownRight size={12} />
            }
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
        {sub && <span className="text-xs text-muted">{sub}</span>}
      </div>
    </div>
  );
}

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#94a3b8' },
};

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [days]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, t] = await Promise.all([api.getDashboardMetrics(days), api.getRevenueTrend(days)]);
      setMetrics(m);
      setTrend(t);
    } catch (err) {
      if (isAuthRedirect(err)) return;
      console.error('Dashboard load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const fmtCurrency = (v: number) =>
    '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="p-6 space-y-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Operations Overview</h1>
          <p className="text-xs text-muted mt-0.5">Real-time view of your DSD routes and revenue</p>
        </div>
        <div className="flex items-center gap-1 bg-dark-card border border-dark-border rounded-lg p-1">
          {[7, 14, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                days === d
                  ? 'bg-primary text-dark-DEFAULT shadow-sm'
                  : 'text-muted hover:text-white'
              }`}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <MetricCardSkeleton key={i} />)}
        </div>
      ) : metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total Revenue"
            value={fmtCurrency(metrics.revenue)}
            icon={<DollarSign size={16} className="text-primary" />}
            iconBg="bg-primary/15"
            sub={`last ${days} days`}
          />
          <MetricCard
            label="Invoices"
            value={metrics.invoiceCount.toLocaleString()}
            icon={<FileText size={16} className="text-info" />}
            iconBg="bg-info/15"
            sub="invoices created"
          />
          <MetricCard
            label="Avg Order Value"
            value={fmtCurrency(metrics.avgOrderValue)}
            icon={<TrendingUp size={16} className="text-success" />}
            iconBg="bg-success/15"
          />
          <MetricCard
            label="Total Collected"
            value={fmtCurrency(metrics.totalCollected)}
            icon={<CreditCard size={16} className="text-success" />}
            iconBg="bg-success/15"
          />
          <MetricCard
            label="Active Drivers"
            value={String(metrics.activeDriverCount)}
            icon={<Truck size={16} className="text-warning" />}
            iconBg="bg-warning/15"
            sub="on routes today"
          />
          <MetricCard
            label="Active Customers"
            value={String(metrics.activeCustomerCount)}
            icon={<Users size={16} className="text-primary" />}
            iconBg="bg-primary/15"
          />
          <MetricCard
            label="Pending Credits"
            value={`${metrics.pendingCredits.count} ($${Number(metrics.pendingCredits.amount || 0).toFixed(0)})`}
            icon={<AlertCircle size={16} className="text-warning" />}
            iconBg="bg-warning/15"
            sub="awaiting approval"
          />
          <MetricCard
            label="Outstanding"
            value={fmtCurrency(metrics.revenue - metrics.totalCollected)}
            icon={<Clock size={16} className="text-danger" />}
            iconBg="bg-danger/15"
            sub="balance due"
          />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue trend — takes 2 cols */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-white">Revenue Trend</h2>
              <p className="text-xs text-muted mt-0.5">Daily revenue over the last {days} days</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => v.slice(5)} />
              <YAxis stroke="#475569" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="#06b6d4" strokeWidth={2} fill="url(#revenueGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top products — 1 col */}
        {metrics?.topProducts && (
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Top Products</h2>
            <div className="space-y-3">
              {metrics.topProducts.slice(0, 6).map((p: any, i: number) => {
                const maxRev = metrics.topProducts[0]?.revenue || 1;
                const pct = (p.revenue / maxRev) * 100;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-white truncate max-w-[140px]">{p.name}</span>
                      <span className="text-xs font-semibold text-primary ml-2">${Number(p.revenue).toFixed(0)}</span>
                    </div>
                    <div className="h-1.5 bg-dark-border rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Daily revenue bar */}
      {trend.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-white mb-5">Daily Revenue Breakdown</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={trend.slice(-14)} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => v.slice(5)} />
              <YAxis stroke="#475569" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#06b6d4" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
