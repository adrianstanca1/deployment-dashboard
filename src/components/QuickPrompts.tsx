import React from 'react';
import { Zap } from 'lucide-react';

const QUICK_PROMPTS = [
  { label: '🔍 Code Review', prompt: 'Review this code for security and performance issues:' },
  { label: '🐛 Debug Help', prompt: 'Help me debug this issue:' },
  { label: '🏗️ Architecture', prompt: 'Design a scalable architecture for:' },
  { label: '🚀 DevOps', prompt: 'Create a CI/CD pipeline for:' },
  { label: '📝 Explain Code', prompt: 'Explain how this code works:' },
];

export function QuickPrompts({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {QUICK_PROMPTS.map((item, i) => (
        <button
          key={i}
          onClick={() => onSelect(item.prompt)}
          className="px-3 py-1.5 text-xs bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <Zap size={12} />
          {item.label}
        </button>
      ))}
    </div>
  );
}
