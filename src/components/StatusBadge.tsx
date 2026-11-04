import React from 'react';
import { TripStatus } from '../types';
import { Clock, CheckCircle2, RefreshCw } from 'lucide-react';

export const StatusBadge: React.FC<{ status: TripStatus; closedAutomatically?: boolean; size?: 'sm' | 'md' }> = ({
  status,
  closedAutomatically,
  size = 'md',
}) => {
  const isAutoClosed = status === 'auto_closed' || closedAutomatically;

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';

  if (status === 'open') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 text-amber-800 ${sizeClasses}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        <Clock className="w-3 h-3 text-amber-600" />
        Open
      </span>
    );
  }

  if (isAutoClosed) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-800 ${sizeClasses}`}
      >
        <RefreshCw className="w-3 h-3 text-blue-600" />
        Automatisch afgesloten
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 ${sizeClasses}`}
    >
      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
      Afgesloten
    </span>
  );
};
