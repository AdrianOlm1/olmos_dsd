import React, { useState, useEffect } from 'react';
import { api, isAuthRedirect } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { BookOpen, CheckCircle, XCircle, RefreshCw, ArrowRight, AlertTriangle, FileText, CreditCard, RotateCcw } from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';

interface SyncCardProps {
  label: string;
  icon: React.ReactNode;
  pending: number;
  errors: number;
}

function SyncCard({ label, icon, pending, errors }: SyncCardProps) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg bg-dark-border flex items-center justify-center">{icon}</div>
        <span className="text-sm font-semibold text-white">{label}</span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted">Pending Sync</span>
          <span className={`text-sm font-bold ${pending > 0 ? 'text-warning' : 'text-success'}`}>{pending}</span>
        </div>
        {errors > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted">Sync Errors</span>
            <span className="text-sm font-bold text-danger">{errors}</span>
          </div>
        )}
      </div>
      {(pending > 0 || errors > 0) && (
        <div className={`h-1 rounded-full mt-3 ${pending > 0 ? 'bg-warning/30' : 'bg-success/30'}`}>
          <div className={`h-full rounded-full ${pending > 0 ? 'bg-warning' : 'bg-success'} w-full`} />
        </div>
      )}
    </div>
  );
}

export default function QBOPage() {
  const toast = useToast();
  const [connection, setConnection] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    loadStatus();
    const onMessage = (e: MessageEvent) => {
      if (e.data === 'qbo-connected') {
        loadStatus();
        toast.success('QuickBooks connected!', 'Your account has been linked successfully');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const loadStatus = async () => {
    try {
      const [conn, sync] = await Promise.all([api.getQBOStatus(), api.getQBOSyncStatus()]);
      setConnection(conn);
      setSyncStatus(sync);
    } catch (err) {
      if (isAuthRedirect(err)) return;
    } finally { setLoading(false); }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { authUri } = await api.connectQBO();
      window.open(authUri, '_blank', 'width=600,height=700');
      toast.info('QuickBooks window opened', 'Complete the authorization in the popup window');
    } catch (err) {
      if (isAuthRedirect(err)) return;
      toast.error('Failed to initiate QuickBooks connection');
    } finally { setConnecting(false); }
  };

  const totalPending = syncStatus ? (syncStatus.invoices?.pending ?? 0) + (syncStatus.payments?.pending ?? 0) + (syncStatus.credits?.pending ?? 0) : 0;

  if (loading) {
    return (
      <div className="p-6 space-y-5 max-w-[900px]">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-[900px]">
      <div>
        <h1 className="page-title">QuickBooks Online</h1>
        <p className="text-xs text-muted mt-0.5">Sync invoices, payments, and credits to your accounting system</p>
      </div>

      {/* Connection status */}
      <div className="card p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#2CA01C]/15 flex items-center justify-center">
              <BookOpen size={22} className="text-[#2CA01C]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">QuickBooks Online</h2>
              <div className="flex items-center gap-2 mt-1">
                {connection?.connected ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    <span className="text-xs text-success font-semibold">Connected</span>
                    {connection.realmId && <span className="text-xs text-muted">· Realm {connection.realmId}</span>}
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-danger" />
                    <span className="text-xs text-danger font-semibold">Not Connected</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {connection?.connected ? (
            <div className="text-right">
              <p className="text-xs text-muted">Token expires</p>
              <p className={`text-xs font-semibold mt-0.5 ${connection.isExpired ? 'text-danger' : 'text-white'}`}>
                {connection.tokenExpiresAt
                  ? new Date(connection.tokenExpiresAt).toLocaleDateString()
                  : '—'}
                {connection.isExpired && ' (EXPIRED)'}
              </p>
              <button onClick={loadStatus} className="btn-ghost mt-2 text-xs py-1">
                <RefreshCw size={12} />
                Refresh status
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#2CA01C] text-white font-semibold text-sm rounded-lg hover:bg-[#248a17] transition-colors disabled:opacity-50"
            >
              {connecting ? <RefreshCw size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              {connecting ? 'Opening...' : 'Connect QuickBooks'}
            </button>
          )}
        </div>

        {connection?.connected && !connection.isExpired && (
          <div className="mt-4 pt-4 border-t border-dark-border/60 flex items-center gap-2">
            <CheckCircle size={14} className="text-success" />
            <span className="text-xs text-muted">Auto-sync runs every 5 minutes · {totalPending} items in queue</span>
          </div>
        )}
      </div>

      {/* Sync status cards */}
      {syncStatus && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SyncCard
            label="Invoices"
            icon={<FileText size={16} className="text-primary" />}
            pending={syncStatus.invoices?.pending ?? 0}
            errors={syncStatus.invoices?.errors ?? 0}
          />
          <SyncCard
            label="Payments"
            icon={<CreditCard size={16} className="text-success" />}
            pending={syncStatus.payments?.pending ?? 0}
            errors={syncStatus.payments?.errors ?? 0}
          />
          <SyncCard
            label="Credits"
            icon={<RotateCcw size={16} className="text-warning" />}
            pending={syncStatus.credits?.pending ?? 0}
            errors={0}
          />
        </div>
      )}

      {/* How it works */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-white mb-4">How Sync Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { step: '1', text: 'Drivers create invoices and collect payments in the field — works fully offline' },
            { step: '2', text: 'When drivers sync, data flows to our database (source of truth for operations)' },
            { step: '3', text: 'A background job syncs invoices, payments, and credits to QuickBooks every 5 minutes' },
            { step: '4', text: 'Decoupled approach handles QBO rate limits gracefully and prevents data loss' },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3 p-3 rounded-lg bg-dark-DEFAULT/50">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {step}
              </span>
              <p className="text-xs text-muted leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
