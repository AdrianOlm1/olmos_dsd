import React, { useState, useEffect } from 'react';
import { api, isAuthRedirect } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { RotateCcw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

const CONDITION_MAP: Record<string, { label: string; cls: string }> = {
  RESALABLE:  { label: 'Resalable',  cls: 'badge-success' },
  DAMAGED:    { label: 'Damaged',    cls: 'badge-danger' },
  EXPIRED:    { label: 'Expired',    cls: 'badge-warning' },
  DISPOSAL:   { label: 'Disposal',   cls: 'badge-neutral' },
};

export default function CreditsPage() {
  const toast = useToast();
  const [credits, setCredits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => { loadCredits(); }, []);

  const loadCredits = async () => {
    try {
      const data = await api.getPendingCredits();
      setCredits(data);
    } catch (err) {
      if (isAuthRedirect(err)) return;
    } finally { setLoading(false); }
  };

  const handleApprove = async (id: string, creditNumber: string) => {
    setProcessing(id);
    try {
      await api.approveCredit(id);
      setCredits(prev => prev.filter(c => c.id !== id));
      toast.success('Credit approved', `${creditNumber} has been approved`);
    } catch (err) {
      if (isAuthRedirect(err)) return;
      toast.error('Failed to approve credit');
    } finally { setProcessing(null); }
  };

  const totalAmount = credits.reduce((sum, c) => sum + Number(c.totalAmount || 0), 0);

  return (
    <div className="p-6 space-y-5 max-w-[900px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Credits & Returns</h1>
          <p className="text-xs text-muted mt-0.5">Awaiting manager approval</p>
        </div>
        {credits.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="badge badge-warning">
              <AlertTriangle size={10} />
              {credits.length} pending
            </span>
            <span className="text-sm font-semibold text-white">${totalAmount.toFixed(2)} total</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} lines={6} />)}
        </div>
      ) : credits.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CheckCircle}
            title="All credits processed"
            description="There are no pending credits or returns to review"
          />
        </div>
      ) : (
        <div className="space-y-4">
          {credits.map(credit => (
            <div key={credit.id} className="card hover:border-warning/30 transition-colors">
              {/* Header */}
              <div className="flex items-start justify-between p-5 border-b border-dark-border/60">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <RotateCcw size={16} className="text-warning" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{credit.creditNumber}</p>
                    <p className="text-xs text-primary font-medium mt-0.5">{credit.customer?.name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {new Date(credit.createdAt).toLocaleString()} ·{' '}
                      <span className="capitalize">{credit.reason?.replace(/_/g, ' ').toLowerCase()}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-warning">${Number(credit.totalAmount).toFixed(2)}</p>
                  <span className="badge badge-warning mt-1">Pending</span>
                </div>
              </div>

              {/* Lines */}
              <div className="px-5 py-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-border/50">
                      <th className="text-left py-2 text-xs text-muted font-medium">Product</th>
                      <th className="text-center py-2 text-xs text-muted font-medium">Qty</th>
                      <th className="text-center py-2 text-xs text-muted font-medium">Condition</th>
                      <th className="text-right py-2 text-xs text-muted font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {credit.lines?.map((line: any) => {
                      const cond = CONDITION_MAP[line.condition] ?? { label: line.condition, cls: 'badge-neutral' };
                      return (
                        <tr key={line.id} className="border-b border-dark-border/30 last:border-0">
                          <td className="py-2.5 text-white">{line.product?.name}</td>
                          <td className="py-2.5 text-center text-muted">{Number(line.quantity)}</td>
                          <td className="py-2.5 text-center">
                            <span className={cond.cls}>{cond.label}</span>
                          </td>
                          <td className="py-2.5 text-right font-semibold text-white">${Number(line.lineTotal).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {credit.notes && (
                <p className="px-5 pb-3 text-xs text-muted italic">Note: {credit.notes}</p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 px-5 py-4 border-t border-dark-border/60 bg-dark-DEFAULT/30">
                <button
                  onClick={() => handleApprove(credit.id, credit.creditNumber)}
                  disabled={processing === credit.id}
                  className="btn-primary"
                >
                  <CheckCircle size={14} />
                  {processing === credit.id ? 'Approving...' : 'Approve Credit'}
                </button>
                <button className="btn-ghost">
                  <XCircle size={14} />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
