import React, { useState, useEffect } from 'react';
import { api, isAuthRedirect } from '../services/api';
import { Truck, MapPin, CheckCircle, Circle, Clock, AlertOctagon } from 'lucide-react';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusBadge } from '../components/ui/StatusBadge';

function StopDot({ status }: { status: string }) {
  if (status === 'COMPLETED')  return <CheckCircle size={12} className="text-success flex-shrink-0" />;
  if (status === 'IN_PROGRESS') return <Clock size={12} className="text-primary flex-shrink-0 animate-pulse" />;
  if (status === 'NO_SERVICE' || status === 'SKIPPED') return <AlertOctagon size={12} className="text-danger flex-shrink-0" />;
  return <Circle size={12} className="text-dark-border flex-shrink-0" />;
}

export default function DriversPage() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getActiveRoutes();
        setRoutes(data);
      } catch (err) { if (!isAuthRedirect(err)) console.error(err); }
      finally { setLoading(false); }
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Active Routes</h1>
          <p className="text-xs text-muted mt-0.5">Live driver & delivery status · auto-refreshes every 30s</p>
        </div>
        <span className="badge badge-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          {routes.length} active
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} lines={5} />)}
        </div>
      ) : routes.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Truck}
            title="No active routes"
            description="Routes appear here when drivers start their daily deliveries"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {routes.map(route => {
            const stops = route.stops ?? [];
            const completed = stops.filter((s: any) => s.status === 'COMPLETED').length;
            const total = stops.length;
            const pct = total > 0 ? (completed / total) * 100 : 0;
            const driver = route.driver;
            const driverName = driver?.user ? `${driver.user.firstName} ${driver.user.lastName}` : 'Unknown Driver';

            return (
              <div key={route.id} className="card p-5 hover:border-primary/30 transition-colors">
                {/* Driver header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Truck size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{driverName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <MapPin size={10} className="text-muted" />
                        <p className="text-xs text-muted truncate max-w-[200px]">{route.name}</p>
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={route.status} />
                </div>

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted">Route Progress</span>
                    <span className="font-semibold text-white">{completed}/{total} stops</span>
                  </div>
                  <div className="h-2 bg-dark-DEFAULT rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: pct === 100 ? '#22c55e' : 'linear-gradient(90deg, #06b6d4, #3b82f6)',
                      }}
                    />
                  </div>
                  <p className="text-right text-[10px] text-muted mt-1">{pct.toFixed(0)}% complete</p>
                </div>

                {/* Stop list */}
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {stops.map((stop: any) => (
                    <div key={stop.id} className="flex items-center gap-2.5 py-1 group">
                      <StopDot status={stop.status} />
                      <span className="text-xs text-subtle w-5 text-right flex-shrink-0">#{stop.stopOrder}</span>
                      <span className={`text-xs flex-1 truncate ${stop.status === 'COMPLETED' ? 'text-muted line-through' : 'text-white'}`}>
                        {stop.location?.customer?.name ?? stop.location?.name ?? 'Unknown'}
                      </span>
                      {stop.actualArrival && (
                        <span className="text-[10px] text-muted flex-shrink-0">
                          {new Date(stop.actualArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {route.startedAt && (
                  <p className="text-[10px] text-muted mt-3 pt-3 border-t border-dark-border/60">
                    Started at {new Date(route.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
