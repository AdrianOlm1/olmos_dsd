import React from 'react';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  // Invoice statuses
  DRAFT:             { label: 'Draft',            cls: 'badge-neutral' },
  COMPLETED:         { label: 'Completed',        cls: 'badge-primary' },
  DELIVERED:         { label: 'Delivered',        cls: 'badge-success' },
  REFUSED:           { label: 'Refused',          cls: 'badge-danger' },
  PARTIALLY_REFUSED: { label: 'Partial Refusal',  cls: 'badge-warning' },
  VOIDED:            { label: 'Voided',           cls: 'badge-neutral' },
  // Route statuses
  PLANNED:           { label: 'Planned',          cls: 'badge-neutral' },
  IN_PROGRESS:       { label: 'In Progress',      cls: 'badge-primary' },
  // Credit statuses
  PENDING:           { label: 'Pending',          cls: 'badge-warning' },
  APPROVED:          { label: 'Approved',         cls: 'badge-success' },
  APPLIED:           { label: 'Applied',          cls: 'badge-success' },
  REJECTED:          { label: 'Rejected',         cls: 'badge-danger' },
  // Stop statuses
  NO_SERVICE:        { label: 'No Service',       cls: 'badge-danger' },
  SKIPPED:           { label: 'Skipped',          cls: 'badge-warning' },
  // Misc
  ACTIVE:            { label: 'Active',           cls: 'badge-success' },
  INACTIVE:          { label: 'Inactive',         cls: 'badge-neutral' },
  LOW:               { label: 'Low Stock',        cls: 'badge-danger' },
};

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const entry = STATUS_MAP[status] ?? { label: status.replace(/_/g, ' '), cls: 'badge-neutral' };
  return (
    <span className={`${entry.cls} ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
      {entry.label}
    </span>
  );
}
