import { useEffect, useCallback } from 'react';

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
  scope?: 'global' | 'local';
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Only allow escape to close modals even when in input
        if (event.key !== 'Escape') return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl
          ? event.ctrlKey || event.metaKey
          : !event.ctrlKey && !event.metaKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;

        if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
          event.preventDefault();
          event.stopPropagation();
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return shortcuts;
}

export const COMMON_SHORTCUTS = {
  commandPalette: { key: 'k', ctrl: true, description: 'Open command palette' },
  sidebarToggle: { key: 'b', ctrl: true, description: 'Toggle sidebar' },
  search: { key: 'f', ctrl: true, description: 'Search' },
  refresh: { key: 'r', ctrl: true, description: 'Refresh data' },
  escape: { key: 'Escape', description: 'Close modal / Cancel' },
  help: { key: '?', description: 'Show keyboard shortcuts' },
};
