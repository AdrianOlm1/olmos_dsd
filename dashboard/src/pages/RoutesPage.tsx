import React, { useState, useEffect } from 'react';
import { api, isAuthRedirect } from '../services/api';
import { Map, Truck, CheckCircle, Clock, Circle, AlertOctagon, Calendar, RefreshCw } from 'lucide-react';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusBadge } from '../components/ui/StatusBadge';

export default function RoutesPage() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'board' | 'list'>('board');

  useEffect(() => {
    const load = async () => {
      try { setRoutes(await api.getActiveRoutes()); }
      catch (err) { if (!isAuthRedirect(err)) console.error(err); }
      finally { setLoading(false); }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const planned    = routes.filter(r => r.status === 'PLANNED');
  const inProgress = routes.filter(r => r.status === 'IN_PROGRESS');
  const completed  = routes.filter(r => r.status === 'COMPLETED');

  const stats = {
    totalStops: routes.reduce((s, r) => s + (r.stops?.length ?? 0), 0),
    completedStops: routes.reduce((s, r) => s + (r.stops?.filter((st: any) => st.status === 'COMPLETED').length ?? 0), 0),
  };

  const RouteCard = ({ route }: { route: any }) => {
    const stops = route.stops ?? [];
    const done  = stops.filter((s: any) => s.status === 'COMPLETED').length;
    const pct   = stops.length > 0 ? (done / stops.length) * 100 : 0;
    const driver = route.driver?.user;

    return (
      <div className="card p-4 hover:border-primary/30 transition-colors">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Truck size={14} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{route.name}</p>
            <p className="text-xs text-muted">
              {driver ? `${driver.firstName} ${driver.lastName}` : 'Unassigned'}
            </p>
          </div>
          <StatusBadge status={route.status} />
        </div>

        {stops.length > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted">{done}/{stops.length} stops</span>
              <span className="text-white font-medium">{pct.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-dark-DEFAULT rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: pct === 100 ? '#22c55e' : 'linear-gradient(90deg, #06b6d4, #3b82f6)',
                }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 mt-2">
          {stops.slice(0, 5).map((s: any, i: number) => {
            let color = 'bg-dark-border';
            if (s.status === 'COMPLETED') color = 'bg-success';
            else if (s.status === 'IN_PROGRESS') color = 'bg-primary animate-pulse';
            else if (s.status === 'NO_SERVICE' || s.status === 'SKIPPED') color = 'bg-danger';
            return (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full ${color}`}
                title={s.location?.customer?.name ?? `Stop ${i + 1}`}
              />
            );
          })}
          {stops.length > 5 && (
            <span className="text-[10px] text-muted">+{stops.length - 5}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dispatch Board</h1>
          <p className="text-xs text-muted mt-0.5">
            {routes.length} routes · {stats.completedStops}/{stats.totalStops} stops done · auto-refreshes 30s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setLoading(true)} className="btn-ghost text-xs">
            <RefreshCw size={13} />
          </button>
          <div className="flex items-center gap-1 bg-dark-card border border-dark-border rounded-lg p-1">
            {(['board', 'list'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                  view === v ? 'bg-primary text-dark-DEFAULT' : 'text-muted hover:text-white'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <button className="btn-primary text-xs">
            <Calendar size={13} />
            Plan Route
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} lines={4} />)}
        </div>
      ) : routes.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Map}
            title="No active routes"
            description="Create a route or wait for drivers to start their daily deliveries"
            action={<button className="btn-primary text-xs">Plan a Route</button>}
          />
        </div>
      ) : view === 'board' ? (
        /* Kanban-style board */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Planned */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Circle size={12} className="text-muted" />
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Planned</h3>
              <span className="ml-auto badge badge-neutral">{planned.length}</span>
            </div>
            <div className="space-y-3">
              {planned.length === 0
                ? <p className="text-xs text-muted text-center py-6">No planned routes</p>
                : planned.map(r => <RouteCard key={r.id} route={r} />)
              }
            </div>
          </div>

          {/* In Progress */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={12} className="text-primary animate-pulse" />
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">In Progress</h3>
              <span className="ml-auto badge badge-primary">{inProgress.length}</span>
            </div>
            <div className="space-y-3">
              {inProgress.length === 0
                ? <p className="text-xs text-muted text-center py-6">No active routes</p>
                : inProgress.map(r => <RouteCard key={r.id} route={r} />)
              }
            </div>
          </div>

          {/* Completed */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={12} className="text-success" />
              <h3 className="text-xs font-semibold text-success uppercase tracking-wider">Completed</h3>
              <span className="ml-auto badge badge-success">{completed.length}</span>
            </div>
            <div className="space-y-3">
              {completed.length === 0
                ? <p className="text-xs text-muted text-center py-6">No completed routes</p>
                : completed.map(r => <RouteCard key={r.id} route={r} />)
              }
            </div>
          </div>
        </div>
      ) : (
        /* List view */
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border">
                <th className="th">Route</th>
                <th className="th">Driver</th>
                <th className="th">Status</th>
                <th className="th text-center">Stops</th>
                <th className="th text-center">Done</th>
                <th className="th">Started</th>
              </tr>
            </thead>
            <tbody>
              {routes.map(route => {
                const stops = route.stops ?? [];
                const done = stops.filter((s: any) => s.status === 'COMPLETED').length;
                const driver = route.driver?.user;
                return (
                  <tr key={route.id} className="tr">
                    <td className="td font-semibold text-white">{route.name}</td>
                    <td className="td text-muted text-xs">
                      {driver ? `${driver.firstName} ${driver.lastName}` : '—'}
                    </td>
                    <td className="td"><StatusBadge status={route.status} /></td>
                    <td className="td text-center text-muted">{stops.length}</td>
                    <td className="td text-center">
                      <span className={`font-semibold ${done === stops.length && stops.length > 0 ? 'text-success' : 'text-white'}`}>
                        {done}
                      </span>
                    </td>
                    <td className="td text-xs text-muted">
                      {route.startedAt ? new Date(route.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
