# Local LLM + Mute Polling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire Ollama (already running on VPS) as the primary AI provider with no API keys, add Google OAuth via existing CLIENT_ID/SECRET, and stop AI health polling when alerts are muted.

**Architecture:** Backend auto-detects Ollama on startup, sets it as active provider, exposes model list + pull endpoints. Frontend AISettings shows local models first with pull UI, Google gets an OAuth button. Every AI health/audit query reads `muteAIAlerts` from localStorage and sets `refetchInterval: false` when muted.

**Tech Stack:** Node/Express backend, React/Vite/TypeScript frontend, Ollama REST API (localhost:11434), Google OAuth2 PKCE flow, React Query v5 reactive `refetchInterval`

---

### Task 1: Backend — Auto-detect Ollama on startup and set as active provider

**Files:**
- Modify: `repo-backend/server.js` — near line 3833 (`let activeProvider = ...`) and startup init

**Step 1: Find the startup / init section**

```bash
grep -n "async function init\|server.listen\|app.listen\|initializeApp\|startup" repo-backend/server.js | tail -20
```

**Step 2: Add Ollama auto-detect function after line 3833**

Add this block immediately after `let activeProvider = process.env.DEFAULT_AI_PROVIDER || 'cloud';`:

```javascript
// Auto-detect Ollama on startup and promote to active provider
async function autoDetectOllama() {
  try {
    const ollamaUrl = getEnvValue(['OLLAMA_URL'], 'http://localhost:11434');
    const res = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return;
    const { models = [] } = await res.json();
    if (models.length === 0) return;
    // Prefer: qwen2.5 > codellama > gemma > first available
    const PREFERRED = ['qwen2.5:14b', 'qwen2.5:7b', 'codellama:7b', 'gemma3:4b', 'mistral'];
    const best = PREFERRED.find(p => models.some(m => m.name.startsWith(p.split(':')[0])))
      ?? models[0].name;
    // Update local provider config
    setEnvValue('OLLAMA_URL', ollamaUrl);
    setEnvValue('OLLAMA_MODEL', best);
    // Switch active provider to local if not already set by user
    if (!process.env.DEFAULT_AI_PROVIDER || process.env.DEFAULT_AI_PROVIDER === 'cloud') {
      activeProvider = 'local';
      setEnvValue('DEFAULT_AI_PROVIDER', 'local');
    }
    console.log(`[AI] Ollama detected — ${models.length} models, active: ${best}`);
  } catch {
    // Ollama not running — keep existing activeProvider
  }
}
```

**Step 3: Call autoDetectOllama() at server startup**

Find the server listen line:
```bash
grep -n "\.listen(" repo-backend/server.js | tail -5
```

Add the call before `.listen(...)`:
```javascript
autoDetectOllama().catch(() => {});
```

**Step 4: Test manually on VPS**
```bash
sshpass -p 'Cumparavinde1@' ssh root@72.62.132.43 \
  'cd /opt/docker/projects/deployment-dashboard && docker compose restart backend 2>&1 | tail -5; sleep 3; docker logs dashboard-backend 2>&1 | grep "\[AI\]" | tail -5'
```
Expected: `[AI] Ollama detected — 3 models, active: qwen2.5:14b`

**Step 5: Commit**
```bash
cd repo-backend && git add server.js && git commit -m "feat: auto-detect Ollama on startup and set as active provider"
```

---

### Task 2: Backend — Dynamic model list + pull endpoint

**Files:**
- Modify: `repo-backend/server.js` — add 2 new routes near the AI routes (around line 4314)

**Step 1: Add GET /api/ai/ollama/models route**

Add after the existing `app.get('/api/ai/providers', ...)` route:

```javascript
// List models installed in Ollama
app.get('/api/ai/ollama/models', requireAuth, async (req, res) => {
  try {
    const ollamaUrl = getEnvValue(['OLLAMA_URL'], 'http://localhost:11434');
    const response = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return res.json({ success: false, error: 'Ollama unreachable', data: [] });
    const { models = [] } = await response.json();
    res.json({
      success: true,
      data: models.map(m => ({
        name: m.name,
        size: m.size,
        sizeGB: (m.size / 1e9).toFixed(1),
        modified: m.modified_at,
      })),
    });
  } catch (err) {
    res.json({ success: false, error: err.message, data: [] });
  }
});
```

**Step 2: Add POST /api/ai/ollama/pull route**

```javascript
// Pull (download) a new model into Ollama
app.post('/api/ai/ollama/pull', requireAuth, async (req, res) => {
  const { model } = req.body;
  if (!model || typeof model !== 'string' || !/^[\w.:\-/]+$/.test(model)) {
    return res.status(400).json({ success: false, error: 'Invalid model name' });
  }
  try {
    const ollamaUrl = getEnvValue(['OLLAMA_URL'], 'http://localhost:11434');
    // Stream pull progress back to client as newline-delimited JSON
    res.setHeader('Content-Type', 'application/x-ndjson');
    const response = await fetch(`${ollamaUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: true }),
    });
    if (!response.ok) {
      res.write(JSON.stringify({ error: 'Pull request failed' }) + '\n');
      return res.end();
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value));
    }
    res.end();
  } catch (err) {
    res.write(JSON.stringify({ error: err.message }) + '\n');
    res.end();
  }
});
```

**Step 3: Also update getAIHealthSnapshot() to show dynamic Ollama models**

In `getAIHealthSnapshot()` (line 4249), find where `local` provider's `models` is set and replace with dynamic fetch:

```javascript
// In the providers map (line ~4251), change the local models to:
models: provider === 'local'
  ? (aiRuntimeState.ollamaModels ?? AI_PROVIDER_META.local.models)
  : config.models || [],
```

Add to `aiRuntimeState` initialization: `ollamaModels: null`

Refresh Ollama model list in `refreshAIHealth` when checking `local`:
```javascript
// After the existing local health check (line ~4185), on success:
try {
  const tagsRes = await fetch(`${config.baseURL}/api/tags`, { signal: AbortSignal.timeout(3000) });
  const { models = [] } = await tagsRes.json();
  aiRuntimeState.ollamaModels = models.map(m => m.name);
} catch { /* ignore */ }
```

**Step 4: Test the endpoints**
```bash
sshpass -p 'Cumparavinde1@' ssh root@72.62.132.43 \
  'TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"$(grep ADMIN_PASS /opt/docker/projects/deployment-dashboard/.env | cut -d= -f2)\"}" | jq -r .data.token); curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/ai/ollama/models | jq .'
```
Expected: JSON array of 3 models with sizes

**Step 5: Commit**
```bash
cd repo-backend && git add server.js && git commit -m "feat: add /api/ai/ollama/models and /api/ai/ollama/pull endpoints"
```

---

### Task 3: Backend — Google OAuth2 flow

**Files:**
- Modify: `repo-backend/server.js` — add 2 OAuth routes and update google health check

**Step 1: Add OAuth state store and constants near the top (after existing env reads ~line 50)**

```javascript
// Google OAuth for Gemini
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://dashboard.cortexbuildpro.com/api/auth/google/callback';
const googleOAuthStates = new Map(); // state -> { createdAt }
```

**Step 2: Add GET /api/auth/google/start route**

```javascript
app.get('/api/auth/google/start', requireAuth, (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(400).json({ success: false, error: 'Google OAuth not configured' });
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  googleOAuthStates.set(state, { createdAt: Date.now() });
  // Clean stale states (> 10 min)
  for (const [k, v] of googleOAuthStates) {
    if (Date.now() - v.createdAt > 600000) googleOAuthStates.delete(k);
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/generative-language',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  res.json({ success: true, url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});
```

**Step 3: Add GET /api/auth/google/callback route**

```javascript
app.get('/api/auth/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`/ai-settings?google_error=${encodeURIComponent(error)}`);
  if (!state || !googleOAuthStates.has(state)) return res.redirect('/ai-settings?google_error=invalid_state');
  googleOAuthStates.delete(state);
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI, grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) throw new Error(tokens.error_description || 'No access token');
    // Store as the google provider's API key
    applyProviderValues('google', { apiKey: tokens.access_token }, []);
    if (tokens.refresh_token) setEnvValue('GOOGLE_REFRESH_TOKEN', tokens.refresh_token);
    persistEnvChanges({ GOOGLE_API_KEY: tokens.access_token });
    pushAIAudit({ type: 'credential-update', provider: 'google', actor: 'oauth', message: 'Google access token obtained via OAuth' });
    res.redirect('/ai-settings?google_oauth=success');
  } catch (err) {
    res.redirect(`/ai-settings?google_error=${encodeURIComponent(err.message)}`);
  }
});
```

**Step 4: Commit**
```bash
cd repo-backend && git add server.js && git commit -m "feat: Google OAuth2 flow for Gemini credentials"
```

---

### Task 4: Frontend — Mute stops AI health polling

**Files:**
- Modify: `repo-frontend/src/pages/Overview.tsx` line 41-47
- Modify: `repo-frontend/src/pages/AISettings.tsx` lines 187-221
- Modify: `repo-frontend/src/pages/CommandCenter.tsx` lines 240-263
- Modify: `repo-frontend/src/App.tsx` — WebSocket AI alert handler

**Step 1: Add `isMuted` helper to usePreferences hook**

In `repo-frontend/src/hooks/usePreferences.ts`, add an exported helper:

```typescript
// Add after the load() function:
export function getAIMuted(): boolean {
  try {
    return !!JSON.parse(localStorage.getItem('dashboard_prefs') || '{}').muteAIAlerts;
  } catch { return false; }
}
```

**Step 2: Update Overview.tsx — make ai-health-overview refetch conditional**

Replace the ai-health query (line 41-47):
```typescript
// Add at top of component:
const { prefs } = usePreferences();

// Change the ai-health-overview query:
const { data: aiHealthData, error: aiHealthError } = useQuery({
  queryKey: ['ai-health-overview'],
  queryFn: async () => {
    const res = await fetch('/api/ai/health', { headers: authHeaders() as HeadersInit });
    return res.json();
  },
  refetchInterval: prefs.muteAIAlerts ? false : 10000,
});
```

Also add `import { usePreferences } from '@/hooks/usePreferences';` to Overview.tsx imports.

**Step 3: Update AISettings.tsx — ai-health and ai-audit queries**

The component already has `const { prefs, update, toggleAgent } = usePreferences();`.

Change the `ai-health` query (line 197-203):
```typescript
refetchInterval: prefs.muteAIAlerts ? false : 10000,
```

Change the `ai-audit` query (line 215-221):
```typescript
refetchInterval: prefs.muteAIAlerts ? false : 10000,
```

**Step 4: Update CommandCenter.tsx — ai-health and ai-audit queries**

Add `const { prefs } = usePreferences();` near the top of CommandCenter().
Add `import { usePreferences } from '@/hooks/usePreferences';`.

Change ai-health-command-center query (line 240-246):
```typescript
refetchInterval: prefs.muteAIAlerts ? false : 10000,
```

Change ai-audit-command-center query (line 258-264):
```typescript
refetchInterval: prefs.muteAIAlerts ? false : 10000,
```

**Step 5: Update App.tsx — suppress AI alert WebSocket notifications when muted**

In the WebSocket message handler (line 62-73), wrap AI alert notifications:
```typescript
if (msg.type === 'ai-alert' && Array.isArray(msg.data)) {
  if (getAIMuted()) return; // suppress when muted
  for (const alert of msg.data) {
    // ... existing code
  }
}
```

Add `import { getAIMuted } from '@/hooks/usePreferences';` to App.tsx imports.

**Step 6: Build and verify no errors**
```bash
cd repo-frontend && npm run build 2>&1 | tail -8
```

**Step 7: Commit**
```bash
cd repo-frontend && git add -A && git commit -m "feat: pause AI health/audit polling when AI alerts are muted"
```

---

### Task 5: Frontend — AISettings Providers tab: Local/Ollama first with model UI

**Files:**
- Modify: `repo-frontend/src/pages/AISettings.tsx` — providers tab section (around line 540-600)

**Step 1: Add Ollama models query to AISettings.tsx**

Add after the existing queries (after line 237):
```typescript
const { data: ollamaModelsResponse, refetch: refetchOllamaModels } = useQuery({
  queryKey: ['ollama-models'],
  queryFn: async () => {
    const res = await fetch('/api/ai/ollama/models', { headers: authHeaders() });
    return res.json();
  },
  staleTime: 30000,
});

const ollamaModels: Array<{ name: string; sizeGB: string; modified: string }> =
  ollamaModelsResponse?.data ?? [];
```

**Step 2: Add pull model state and mutation**

```typescript
const [pullModelName, setPullModelName] = useState('');
const [pullProgress, setPullProgress] = useState<string | null>(null);

const pullModel = async () => {
  if (!pullModelName.trim()) return;
  setPullProgress('Starting download...');
  try {
    const res = await fetch('/api/ai/ollama/pull', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ model: pullModelName.trim() }),
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          if (obj.status) setPullProgress(obj.status + (obj.completed ? ` ${Math.round(obj.completed / 1e6)}MB` : ''));
          if (obj.error) setPullProgress(`Error: ${obj.error}`);
        } catch { /* ignore partial json */ }
      }
    }
    setPullProgress('Done');
    refetchOllamaModels();
    setPullModelName('');
    setTimeout(() => setPullProgress(null), 3000);
  } catch (err: any) {
    setPullProgress(`Failed: ${err.message}`);
  }
};
```

**Step 3: In the providers list render, move the `local` provider card to the top**

In the providers map (line ~544), change to sort local first:
```typescript
{[...providers].sort((a, b) => a.id === 'local' ? -1 : b.id === 'local' ? 1 : 0).map((provider) => (
```

**Step 4: Add Ollama model list + pull UI inside the `local` provider card**

Inside the provider card, after the existing health/credentials section, add:
```tsx
{provider.id === 'local' && (
  <div className="mt-3 border-t border-dark-700 pt-3 space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-dark-400">Installed Models</span>
      <button onClick={() => refetchOllamaModels()}
        className="text-xs text-dark-500 hover:text-dark-300 flex items-center gap-1">
        <RefreshCw size={11} /> Refresh
      </button>
    </div>
    {ollamaModels.length === 0 ? (
      <p className="text-xs text-dark-600">No models found — Ollama may not be running</p>
    ) : (
      <div className="space-y-1">
        {ollamaModels.map(m => (
          <div key={m.name} className="flex items-center justify-between rounded-lg bg-dark-800 px-3 py-1.5 text-xs">
            <span className="font-mono text-dark-200">{m.name}</span>
            <span className="text-dark-500">{m.sizeGB} GB</span>
          </div>
        ))}
      </div>
    )}
    <div className="flex gap-2 pt-1">
      <input
        value={pullModelName}
        onChange={e => setPullModelName(e.target.value)}
        placeholder="e.g. llama3.2:3b"
        className="flex-1 rounded-lg border border-dark-700 bg-dark-800 px-3 py-1.5 text-xs text-dark-200 placeholder-dark-600 focus:border-cyan-500 focus:outline-none"
        onKeyDown={e => e.key === 'Enter' && pullModel()}
      />
      <button onClick={pullModel} disabled={!pullModelName.trim()}
        className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-40">
        Pull
      </button>
    </div>
    {pullProgress && (
      <p className="text-xs text-cyan-400 font-mono">{pullProgress}</p>
    )}
  </div>
)}
```

**Step 5: Commit**
```bash
cd repo-frontend && git add -A && git commit -m "feat: Ollama model list + pull UI in AISettings local provider card"
```

---

### Task 6: Frontend — Google OAuth button in AISettings

**Files:**
- Modify: `repo-frontend/src/pages/AISettings.tsx` — google provider card credentials section

**Step 1: Add Google OAuth state from URL params**

At the top of the AISettings component, add:
```typescript
const googleOAuthStatus = useMemo(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('google_oauth') === 'success') return 'success';
  if (params.get('google_error')) return params.get('google_error');
  return null;
}, []);
```

**Step 2: In the credentials tab, add an OAuth button for the Google provider**

In the provider key records map (around line 613), inside the Google provider card, add above/instead of the API key field:
```tsx
{providerId === 'google' && (
  <div className="mb-3">
    <button
      onClick={async () => {
        const res = await fetch('/api/auth/google/start', { headers: authHeaders() });
        const { url } = await res.json();
        if (url) window.location.href = url;
      }}
      className="flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-sm text-blue-300 hover:bg-blue-500/20 transition-colors"
    >
      <Globe size={14} />
      Sign in with Google (OAuth)
    </button>
    {googleOAuthStatus === 'success' && (
      <p className="mt-1.5 text-xs text-green-400">✓ Google OAuth connected</p>
    )}
    {googleOAuthStatus && googleOAuthStatus !== 'success' && (
      <p className="mt-1.5 text-xs text-red-400">OAuth error: {googleOAuthStatus}</p>
    )}
    <p className="mt-1 text-xs text-dark-500">Or enter API key manually below</p>
  </div>
)}
```

**Step 3: Commit**
```bash
cd repo-frontend && git add -A && git commit -m "feat: Google OAuth button in AISettings credentials tab"
```

---

### Task 7: Deploy backend to VPS and verify

**Step 1: Copy updated server.js to VPS**
```bash
sshpass -p 'Cumparavinde1@' scp repo-backend/server.js root@72.62.132.43:/opt/docker/projects/deployment-dashboard/repo-backend/server.js
```

**Step 2: Restart backend container**
```bash
sshpass -p 'Cumparavinde1@' ssh root@72.62.132.43 \
  'cd /opt/docker/projects/deployment-dashboard && docker compose restart backend && sleep 3 && docker logs dashboard-backend 2>&1 | tail -10'
```
Expected: `[AI] Ollama detected — 3 models, active: qwen2.5:14b`

**Step 3: Verify active provider switched to local**
```bash
sshpass -p 'Cumparavinde1@' ssh root@72.62.132.43 \
  'TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login ... ); curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/ai/providers | jq ".active"'
```
Expected: `"local"`

---

### Task 8: Build + deploy frontend, final commit, push to GitHub

**Step 1: Build**
```bash
cd repo-frontend && npm run build 2>&1 | tail -5
```
Expected: `✓ built in ~5s`

**Step 2: Deploy dist to VPS**
```bash
sshpass -p 'Cumparavinde1@' scp -r repo-frontend/dist/* root@72.62.132.43:/opt/docker/projects/deployment-dashboard/frontend-dist/
```

**Step 3: Push both repos**
```bash
cd repo-frontend && git push origin master
cd repo-backend && git push origin master
```

**Step 4: Smoke-test in browser**
- Open `https://dashboard.cortexbuildpro.com/ai-settings`
- Providers tab: Local/Ollama card should appear first with 3 models listed
- Mute AI alerts → verify polling stops (check Network tab, no ai/health requests after 10s)
- Google card in Credentials tab should show "Sign in with Google" button

---

## Summary of Files Changed

| File | Change |
|------|--------|
| `repo-backend/server.js` | autoDetectOllama(), /api/ai/ollama/models, /api/ai/ollama/pull, Google OAuth routes |
| `repo-frontend/src/hooks/usePreferences.ts` | Export `getAIMuted()` helper |
| `repo-frontend/src/App.tsx` | Suppress WS AI alerts when muted |
| `repo-frontend/src/pages/Overview.tsx` | Reactive refetchInterval for ai-health |
| `repo-frontend/src/pages/AISettings.tsx` | Reactive refetchInterval + Ollama model UI + Google OAuth button |
| `repo-frontend/src/pages/CommandCenter.tsx` | Reactive refetchInterval for ai-health/audit |
