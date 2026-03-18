import React, { useState, useEffect, useCallback } from 'react';
import { api, isAuthRedirect } from '../services/api';
import { FileText, Search, Filter, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';

const STATUSES = ['ALL', 'COMPLETED', 'DELIVERED', 'REFUSED', 'PARTIALLY_REFUSED', 'VOIDED'] as const;

export default function InvoicesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('ALL');
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getInvoices({ status, days, search: search || undefined, page });
      setData(result);
    } catch (err) {
      if (isAuthRedirect(err)) return;
      console.error(err);
    } finally { setLoading(false); }
  }, [status, days, search, page]);

  useEffect(() => { setPage(1); }, [status, days, search]);
  useEffect(() => { load(); }, [load]);

  const invoices = data?.items ?? [];
  const total    = data?.total ?? 0;
  const pages    = data?.pages ?? 1;

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="text-xs text-muted mt-0.5">{total.toLocaleString()} invoices · last {days} days</p>
        </div>
        <button onClick={load} className="btn-ghost text-xs">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search invoice # or customer..."
            className="input h-9 pl-9 text-xs"
          />
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-dark-card border border-dark-border rounded-lg p-1 flex-wrap">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                status === s ? 'bg-primary text-dark-DEFAULT' : 'text-muted hover:text-white'
              }`}
            >
              {s === 'ALL' ? 'All' : s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Days */}
        <div className="flex items-center gap-1 bg-dark-card border border-dark-border rounded-lg p-1">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                days === d ? 'bg-dark-border text-white' : 'text-muted hover:text-white'
              }`}
            >
              {d}D
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
                <th className="th">Invoice #</th>
                <th className="th">Customer</th>
                <th className="th">Driver</th>
                <th className="th">Date</th>
                <th className="th">Status</th>
                <th className="th text-center">Items</th>
                <th className="th text-right">Total</th>
                <th className="th text-right">Paid</th>
                <th className="th text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 12 }).map((_, i) => <TableRowSkeleton key={i} cols={9} />)
                : invoices.map((inv: any) => {
                    const paid = inv.payments?.reduce((s: number, p: any) => s + Number(p.amount || 0), 0) ?? 0;
                    const balance = Number(inv.totalAmount) - paid;
                    const driverUser = inv.driver?.user;
                    return (
                      <tr key={inv.id} className="tr cursor-pointer">
                        <td className="td">
                          <span className="font-mono text-xs font-semibold text-primary">{inv.invoiceNumber}</span>
                        </td>
                        <td className="td">
                          <p className="text-sm text-white font-medium">{inv.customer?.name ?? '—'}</p>
                          <p className="text-xs text-muted">{inv.customer?.accountNumber ?? ''}</p>
                        </td>
                        <td className="td text-xs text-muted">
                          {driverUser ? `${driverUser.firstName} ${driverUser.lastName}` : '—'}
                        </td>
                        <td className="td text-xs text-muted">{fmtDate(inv.createdAt)}</td>
                        <td className="td"><StatusBadge status={inv.status} /></td>
                        <td className="td text-center text-muted">{inv.lines?.length ?? 0}</td>
                        <td className="td text-right font-semibold text-white">${Number(inv.totalAmount).toFixed(2)}</td>
                        <td className="td text-right text-success">{paid > 0 ? `$${paid.toFixed(2)}` : '—'}</td>
                        <td className="td text-right">
                          {balance > 0
                            ? <span className="text-warning font-semibold">${balance.toFixed(2)}</span>
                            : <span className="text-success">Paid</span>
                          }
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
        {!loading && invoices.length === 0 && (
          <EmptyState icon={FileText} title="No invoices found" description="Try adjusting your filters or date range" />
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            Page {page} of {pages} · {total} total invoices
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-ghost py-1.5 px-2 disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const pg = page <= 3 ? i + 1 : page - 2 + i;
              if (pg < 1 || pg > pages) return null;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    pg === page ? 'bg-primary text-dark-DEFAULT' : 'text-muted hover:text-white hover:bg-dark-border'
                  }`}
                >
                  {pg}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="btn-ghost py-1.5 px-2 disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
