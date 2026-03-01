import { useState, useCallback } from 'react';

interface Preferences {
  disabledAgents: string[];
  muteAIAlerts: boolean;
  muteNotifications: boolean;
}

const STORAGE_KEY = 'dashboard_prefs';

function load(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { disabledAgents: [], muteAIAlerts: false, muteNotifications: false, ...JSON.parse(raw) };
  } catch {}
  return { disabledAgents: [], muteAIAlerts: false, muteNotifications: false };
}

function save(prefs: Preferences) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(load);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, []);

  const toggleAgent = useCallback((agentId: string) => {
    setPrefs(prev => {
      const disabled = prev.disabledAgents.includes(agentId)
        ? prev.disabledAgents.filter(id => id !== agentId)
        : [...prev.disabledAgents, agentId];
      const next = { ...prev, disabledAgents: disabled };
      save(next);
      return next;
    });
  }, []);

  return { prefs, update, toggleAgent };
}

export function getAIMuted(): boolean {
  try {
    return !!JSON.parse(localStorage.getItem('dashboard_prefs') || '{}').muteAIAlerts;
  } catch { return false; }
}
