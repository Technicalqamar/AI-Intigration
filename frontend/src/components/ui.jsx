import React from 'react';
import { AlertCircle, Check, CircleDashed, LoaderCircle } from 'lucide-react';

export function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  );
}

export function StatusBadge({ status }) {
  const labels = {
    pending: 'Pending',
    'in-progress': 'In progress',
    completed: 'Completed',
  };

  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" aria-hidden="true" />
      {labels[status] || status}
    </span>
  );
}

export function LoadingState({ label = 'Loading' }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <LoaderCircle size={18} className="spin" aria-hidden="true" />
      <span>{label}…</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state-panel error-panel" role="alert">
      <span className="state-icon error-icon"><AlertCircle size={20} aria-hidden="true" /></span>
      <div>
        <h3>We couldn’t load this right now</h3>
        <p>{message}</p>
      </div>
      {onRetry && <button className="button button-secondary button-small" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function EmptyState({ icon: Icon = CircleDashed, title, description, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon size={24} strokeWidth={1.8} aria-hidden="true" /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  const Icon = toast.type === 'error' ? AlertCircle : Check;

  return (
    <div className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
      <Icon size={18} aria-hidden="true" />
      <span>{toast.message}</span>
      <button type="button" aria-label="Dismiss notification" onClick={onDismiss}>×</button>
    </div>
  );
}

export const formatDate = (value, options = { month: 'short', day: 'numeric', year: 'numeric' }) => {
  if (!value) return 'No due date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Invalid date' : new Intl.DateTimeFormat(undefined, options).format(date);
};

export const isOverdue = (task) =>
  Boolean(task.dueDate && task.status !== 'completed' && new Date(task.dueDate).getTime() < Date.now());
