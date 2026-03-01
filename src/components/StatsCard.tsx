import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'default';
  sub?: string;
}

const colorMap = {
  green: { icon: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  red: { icon: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  yellow: { icon: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  blue: { icon: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  purple: { icon: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  default: { icon: 'text-dark-400', bg: 'bg-dark-800', border: 'border-dark-700' },
};

export default function StatsCard({ label, value, icon: Icon, color = 'default', sub }: StatsCardProps) {
  const c = colorMap[color];
  return (
    <div className={`rounded-xl border p-4 bg-dark-900 ${c.border}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-dark-400">{label}</span>
        <span className={`p-1.5 rounded-lg ${c.bg}`}>
          <Icon size={15} className={c.icon} />
        </span>
      </div>
      <div className="text-2xl font-bold text-dark-100">{value}</div>
      {sub && <div className="text-xs text-dark-500 mt-1">{sub}</div>}
    </div>
  );
}
