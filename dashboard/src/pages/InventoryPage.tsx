import React, { useState, useEffect } from 'react';
import { api, isAuthRedirect } from '../services/api';
import { Package, Search, AlertTriangle, Clock, TrendingDown } from 'lucide-react';
import { TableRowSkeleton, Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

function AlertCard({ title, icon, color, items, renderItem }: any) {
  return (
    <div className={`card p-4 border-l-4 ${color}`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold text-white">{title} ({items?.length ?? 0})</h3>
      </div>
      {(!items || items.length === 0) ? (
        <p className="text-xs text-muted">None</p>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 6).map((item: any, i: number) => renderItem(item, i))}
          {items.length > 6 && <p className="text-xs text-muted">+{items.length - 6} more</p>}
        </div>
      )}
    </div>
  );
}

export default function InventoryPage() {
  const [alerts, setAlerts] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'cost'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [a, p] = await Promise.all([api.getInventoryAlerts(), api.getProducts()]);
      setAlerts(a);
      setProducts(p);
    } catch (err) {
      if (isAuthRedirect(err)) return;
    } finally { setLoading(false); }
  };

  const handleSort = (col: 'name' | 'price' | 'cost') => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const filtered = products
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'name') return mul * a.name.localeCompare(b.name);
      if (sortBy === 'price') return mul * (Number(a.basePrice) - Number(b.basePrice));
      return mul * (Number(a.costPrice) - Number(b.costPrice));
    });

  const SortIcon = ({ col }: { col: string }) => (
    <span className="ml-1 text-muted">{sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
  );

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="text-xs text-muted mt-0.5">{products.length} products · warehouse + truck stock</p>
        </div>
        <button className="btn-primary">
          <Package size={14} />
          Add Product
        </button>
      </div>

      {/* Alert cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : alerts && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AlertCard
            title="Low Stock"
            icon={<TrendingDown size={14} className="text-danger" />}
            color="border-l-danger"
            items={alerts.lowStock}
            renderItem={(item: any, i: number) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs text-white truncate mr-2">{item.product?.name}</span>
                <span className="text-xs font-bold text-danger flex-shrink-0">{Number(item.quantity)} units</span>
              </div>
            )}
          />
          <AlertCard
            title="Expiring Soon"
            icon={<Clock size={14} className="text-warning" />}
            color="border-l-warning"
            items={alerts.expiringSoon}
            renderItem={(item: any, i: number) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs text-white truncate mr-2">{item.product?.name}</span>
                <span className="text-xs font-bold text-warning flex-shrink-0">
                  {item.expirationDate ? new Date(item.expirationDate).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            )}
          />
        </div>
      )}

      {/* Product catalog */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-dark-border">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products..."
              className="input h-9 pl-9 text-xs"
            />
          </div>
          <span className="text-xs text-muted">{filtered.length} items</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border">
                <th className="th cursor-pointer hover:text-white" onClick={() => handleSort('name')}>
                  Product <SortIcon col="name" />
                </th>
                <th className="th">SKU</th>
                <th className="th">UPC</th>
                <th className="th">Category</th>
                <th className="th cursor-pointer hover:text-white text-right" onClick={() => handleSort('price')}>
                  Base Price <SortIcon col="price" />
                </th>
                <th className="th cursor-pointer hover:text-white text-right" onClick={() => handleSort('cost')}>
                  Cost <SortIcon col="cost" />
                </th>
                <th className="th text-center">Unit</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 10 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
                : filtered.map(p => {
                    const margin = Number(p.basePrice) > 0
                      ? ((Number(p.basePrice) - Number(p.costPrice)) / Number(p.basePrice) * 100).toFixed(0)
                      : '—';
                    return (
                      <tr key={p.id} className="tr">
                        <td className="td font-medium text-white">{p.name}</td>
                        <td className="td text-muted font-mono text-xs">{p.sku}</td>
                        <td className="td text-muted text-xs">{p.upc || '—'}</td>
                        <td className="td">
                          {p.category ? (
                            <span className="badge badge-neutral">{p.category.name}</span>
                          ) : '—'}
                        </td>
                        <td className="td text-right font-semibold text-white">${Number(p.basePrice).toFixed(2)}</td>
                        <td className="td text-right text-muted">${Number(p.costPrice).toFixed(2)}</td>
                        <td className="td text-center">
                          <span className="badge badge-neutral text-[10px]">{p.unitOfMeasure}</span>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && (
          <EmptyState icon={Package} title="No products found" description="Try adjusting your search" />
        )}
      </div>
    </div>
  );
}
