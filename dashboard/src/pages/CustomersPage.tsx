import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, isAuthRedirect } from '../services/api';
import { Search, Users, ChevronRight, Building2, TrendingDown } from 'lucide-react';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'HIGH_RISK' | 'INDEPENDENT'>('ALL');

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async (q?: string) => {
    setLoading(true);
    try {
      const data = await api.getCustomers(q);
      setCustomers(data);
    } catch (err) {
      if (isAuthRedirect(err)) return;
    } finally { setLoading(false); }
  };

  const filtered = customers.filter(c => {
    if (filter === 'HIGH_RISK') return (c.customerInsights?.churnRisk || 0) > 0.7;
    if (filter === 'INDEPENDENT') return !c.chain;
    return true;
  });

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="text-xs text-muted mt-0.5">{customers.length} accounts</p>
        </div>
        <button className="btn-primary">
          <Users size={14} />
          Add Customer
        </button>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <form onSubmit={e => { e.preventDefault(); loadCustomers(search); }}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customers..."
              className="input h-9 pl-9 text-xs"
            />
          </form>
        </div>
        <div className="flex items-center gap-1 bg-dark-card border border-dark-border rounded-lg p-1">
          {(['ALL', 'HIGH_RISK', 'INDEPENDENT'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filter === f ? 'bg-primary text-dark-DEFAULT' : 'text-muted hover:text-white'
              }`}
            >
              {f === 'ALL' ? 'All' : f === 'HIGH_RISK' ? 'High Risk' : 'Independent'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border">
                <th className="th">Customer</th>
                <th className="th">Account</th>
                <th className="th">Chain</th>
                <th className="th">Terms</th>
                <th className="th">Churn Risk</th>
                <th className="th text-right">Lifetime Value</th>
                <th className="th text-right">Orders</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} cols={8} />)
                : filtered.map(c => {
                    const insight = c.customerInsights;
                    const risk = insight?.churnRisk ? Number(insight.churnRisk) : 0;
                    const riskColor = risk > 0.7 ? 'text-danger' : risk > 0.4 ? 'text-warning' : 'text-success';
                    const riskBg    = risk > 0.7 ? 'bg-danger/10' : risk > 0.4 ? 'bg-warning/10' : 'bg-success/10';
                    return (
                      <tr key={c.id} className="tr">
                        <td className="td">
                          <Link to={`/customers/${c.id}`} className="group flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-primary">{c.name?.[0] ?? '?'}</span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white group-hover:text-primary transition-colors">{c.name}</p>
                              {c.contactName && <p className="text-xs text-muted">{c.contactName}</p>}
                            </div>
                          </Link>
                        </td>
                        <td className="td text-muted">{c.accountNumber || '—'}</td>
                        <td className="td">
                          {c.chain ? (
                            <span className="inline-flex items-center gap-1 text-xs text-white">
                              <Building2 size={11} className="text-muted" />
                              {c.chain.name}
                            </span>
                          ) : (
                            <span className="text-xs text-muted">Independent</span>
                          )}
                        </td>
                        <td className="td text-xs text-muted">{c.paymentTerms}</td>
                        <td className="td">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${riskColor} ${riskBg}`}>
                            {risk > 0.4 && <TrendingDown size={10} />}
                            {(risk * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="td text-right font-semibold text-white">
                          ${insight?.totalLifetimeValue ? Number(insight.totalLifetimeValue).toFixed(0) : '0'}
                        </td>
                        <td className="td text-right text-muted">{insight?.orderCount || 0}</td>
                        <td className="td">
                          <Link to={`/customers/${c.id}`} className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-dark-border transition-colors inline-flex">
                            <ChevronRight size={14} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && (
          <EmptyState icon={Users} title="No customers found" description="Try adjusting your search or filters" />
        )}
      </div>
    </div>
  );
}
