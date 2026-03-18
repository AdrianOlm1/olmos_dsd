import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, isAuthRedirect } from '../services/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ArrowLeft, Building2, User, DollarSign, TrendingUp, Package, Zap, MapPin } from 'lucide-react';
import { MetricCardSkeleton, Skeleton } from '../components/ui/Skeleton';
import { StatusBadge } from '../components/ui/StatusBadge';

function StatCard({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#94a3b8' },
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      api.getCustomerAnalytics(id)
        .then(setData)
        .catch(err => { if (!isAuthRedirect(err)) console.error(err); })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 space-y-5 max-w-[1200px]">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <MetricCardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-muted">Customer not found</div>;
  }

  const { customer, stats, topProducts, recentInvoices, suggestedProducts, monthlyTrend } = data;
  const churnColor = stats.churnRisk > 0.7 ? 'text-danger' : stats.churnRisk > 0.4 ? 'text-warning' : 'text-success';

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link to="/customers" className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors">
          <ArrowLeft size={13} />
          Customers
        </Link>
        <span className="text-muted">/</span>
        <span className="text-xs text-white font-medium">{customer.name}</span>
      </div>

      {/* Customer header */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-primary">{customer.name?.[0] ?? '?'}</span>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">{customer.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              {customer.chain && (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Building2 size={11} />
                  {customer.chain.name}
                </span>
              )}
              {customer.accountNumber && (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <User size={11} />
                  #{customer.accountNumber}
                </span>
              )}
              <span className="text-xs badge badge-neutral">{customer.paymentTerms}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Lifetime Value"    value={`$${stats.lifetimeValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} />
        <StatCard label="Avg Order Value"   value={`$${stats.avgOrderValue.toFixed(2)}`} color="text-primary" />
        <StatCard label="Total Orders"      value={String(stats.totalOrders)} />
        <StatCard label="Order Frequency"   value={stats.avgDaysBetweenOrders ? `${stats.avgDaysBetweenOrders.toFixed(0)}d` : 'N/A'} />
        <StatCard label="Churn Risk"        value={`${(stats.churnRisk * 100).toFixed(0)}%`} color={churnColor} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Order history trend */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Order History</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="orderDate" stroke="#475569" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => v.slice(5, 10)} />
              <YAxis stroke="#475569" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `$${v}`} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Order']} />
              <Line type="monotone" dataKey="totalAmount" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3, fill: '#06b6d4' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top products */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Top Products</h2>
          <div className="space-y-3">
            {topProducts?.slice(0, 7).map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-subtle w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-white truncate">{p.name}</span>
                    <span className="text-xs font-semibold text-primary ml-2">${p.revenue.toFixed(0)}</span>
                  </div>
                  <div className="h-1 bg-dark-DEFAULT rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded-full"
                      style={{ width: `${(p.revenue / topProducts[0].revenue) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Suggestions */}
      {suggestedProducts?.length > 0 && (
        <div className="card p-5 border-success/25">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-success" />
            <h2 className="text-sm font-semibold text-success">AI-Suggested Products</h2>
          </div>
          <p className="text-xs text-muted mb-4">Popular with similar stores — not yet ordered by this customer</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {suggestedProducts.map((p: any, i: number) => (
              <div key={i} className="bg-dark-DEFAULT rounded-lg p-3 border border-dark-border/60">
                <p className="text-sm font-medium text-white">{p.name}</p>
                <p className="text-xs text-muted mt-1">{p.reason}</p>
                <div className="flex items-center gap-2 mt-2.5">
                  <div className="h-1.5 flex-1 bg-dark-border rounded-full overflow-hidden">
                    <div className="h-full bg-success rounded-full" style={{ width: `${(p.confidence || 0) * 100}%` }} />
                  </div>
                  <span className="text-xs text-muted">{((p.confidence || 0) * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent invoices */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-dark-border">
          <h2 className="text-sm font-semibold text-white">Recent Invoices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border">
                <th className="th">Invoice</th>
                <th className="th">Date</th>
                <th className="th">Status</th>
                <th className="th text-center">Items</th>
                <th className="th text-right">Total</th>
                <th className="th text-right">Paid</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices?.map((inv: any) => (
                <tr key={inv.id} className="tr">
                  <td className="td font-mono text-xs font-semibold text-primary">{inv.invoiceNumber}</td>
                  <td className="td text-xs text-muted">{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td className="td"><StatusBadge status={inv.status} /></td>
                  <td className="td text-center text-muted">{inv.lines?.length || 0}</td>
                  <td className="td text-right font-semibold text-white">${Number(inv.totalAmount).toFixed(2)}</td>
                  <td className="td text-right text-success">${Number(inv.amountPaid).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Locations */}
      {customer.locations?.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Locations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {customer.locations.map((loc: any) => (
              <div key={loc.id} className="bg-dark-DEFAULT rounded-lg p-4 border border-dark-border/60">
                <div className="flex items-start gap-2">
                  <MapPin size={13} className="text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-white">{loc.name}</p>
                    <p className="text-xs text-muted mt-0.5">{loc.addressLine1}</p>
                    <p className="text-xs text-muted">{loc.city}, {loc.state} {loc.zip}</p>
                    {loc.receivingHoursStart && (
                      <p className="text-xs text-primary mt-1.5">
                        Receiving: {loc.receivingHoursStart}–{loc.receivingHoursEnd}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
