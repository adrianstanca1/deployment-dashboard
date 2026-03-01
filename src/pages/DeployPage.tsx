import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Rocket, CheckCircle, XCircle, Loader2, ChevronDown, RefreshCw, Terminal } from 'lucide-react';
import { githubAPI, serverAPI } from '@/api';

type StepStatus = 'pending' | 'running' | 'done' | 'error';

interface Step {
  id: string;
  label: string;
  status: StepStatus;
  command?: string;
}

const STEP_LABELS: Record<string, string> = {
  'clone': 'Clone repository',
  'git-pull': 'Git pull',
  'install': 'Install dependencies',
  'build': 'Build project',
  'pm2-start': 'Start in PM2',
  'pm2-restart': 'Restart in PM2',
  'pm2-save': 'Save PM2 list',
};

const STEP_ORDER = ['clone', 'git-pull', 'install', 'build', 'pm2-start', 'pm2-restart', 'pm2-save'];

function StepRow({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-3 text-sm py-2">
      <span className="w-5 shrink-0">
        {step.status === 'done' && <CheckCircle size={16} className="text-green-400" />}
        {step.status === 'error' && <XCircle size={16} className="text-red-400" />}
        {step.status === 'running' && <Loader2 size={16} className="text-blue-400 animate-spin" />}
        {step.status === 'pending' && <span className="w-4 h-4 rounded-full border border-dark-600 inline-block" />}
      </span>
      <span className={
        step.status === 'done' ? 'text-green-400' :
        step.status === 'error' ? 'text-red-400' :
        step.status === 'running' ? 'text-blue-400 font-medium' :
        'text-dark-500'
      }>
        {step.label}
      </span>
      {step.command && step.status === 'running' && (
        <span className="text-xs text-dark-600 font-mono truncate ml-auto">{step.command}</span>
      )}
    </div>
  );
}

export default function DeployPage() {
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [pm2Name, setPm2Name] = useState('');
  const [port, setPort] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [output, setOutput] = useState<Array<{ text: string; isErr?: boolean }>>([]);
  const [done, setDone] = useState<{ success: boolean; error?: string } | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const [customRepo, setCustomRepo] = useState('');

  const { data: reposData } = useQuery({
    queryKey: ['github-repos'],
    queryFn: githubAPI.getRepos,
    staleTime: 60000,
  });

  const { data: appsData } = useQuery({
    queryKey: ['server-apps'],
    queryFn: serverAPI.getApps,
  });

  const repos = reposData?.data ?? [];
  const existingApps = new Set(appsData?.data ?? []);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Auto-fill PM2 name from repo
  useEffect(() => {
    if (repo && !pm2Name) {
      setPm2Name(repo.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
    }
  }, [repo]);

  const startDeploy = async () => {
    const targetRepo = customRepo || repo;
    if (!targetRepo || !port) return;

    setDeploying(true);
    setSteps([]);
    setOutput([]);
    setDone(null);

    try {
      const response = await fetch('/api/deploy/pipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('dashboard_token') ?? ''}`,
        },
        body: JSON.stringify({
          repo: targetRepo,
          branch,
          port: parseInt(port),
          pm2Name: pm2Name || targetRepo,
        }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const eventText of events) {
          const lines = eventText.split('\n');
          const eventLine = lines.find(l => l.startsWith('event:'));
          const dataLine = lines.find(l => l.startsWith('data:'));
          if (!eventLine || !dataLine) continue;

          const event = eventLine.slice(7).trim();
          const data = JSON.parse(dataLine.slice(5).trim());

          if (event === 'step-start') {
            const label = STEP_LABELS[data.step] ?? data.step;
            setSteps(prev => {
              const exists = prev.find(s => s.id === data.step);
              if (exists) return prev.map(s => s.id === data.step ? { ...s, status: 'running', command: data.command } : s);
              return [...prev, { id: data.step, label, status: 'running', command: data.command }];
            });
          } else if (event === 'step-done') {
            setSteps(prev => prev.map(s => s.id === data.step ? { ...s, status: 'done' } : s));
          } else if (event === 'step-error') {
            setSteps(prev => prev.map(s => s.id === data.step ? { ...s, status: 'error' } : s));
          } else if (event === 'output') {
            setOutput(prev => [...prev, { text: data.text, isErr: data.isStderr }]);
          } else if (event === 'done') {
            setDone({ success: data.success, error: data.error });
            setDeploying(false);
          }
        }
      }
    } catch (err: unknown) {
      setDone({ success: false, error: err instanceof Error ? err.message : String(err) });
      setDeploying(false);
    }
  };

  const reset = () => {
    setSteps([]);
    setOutput([]);
    setDone(null);
    setDeploying(false);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-dark-100">Deploy Manager</h1>
        <p className="text-sm text-dark-400 mt-0.5">Clone, install, build, and register apps with the runtime manager</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Config form */}
        <div className="rounded-xl border border-dark-700 bg-dark-900 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-dark-200">Configuration</h2>

          {/* Repo select */}
          <div>
            <label className="block text-xs text-dark-400 mb-1.5">Repository</label>
            <div className="relative">
              <select
                value={repo}
                onChange={e => { setRepo(e.target.value); setCustomRepo(''); }}
                className="input-field text-sm appearance-none pr-8"
                disabled={deploying}
              >
                <option value="">Select from GitHub...</option>
                {repos.sort((a, b) => a.name.localeCompare(b.name)).map(r => (
                  <option key={r.id} value={r.name}>
                    {r.name} {existingApps.has(r.name) ? '(exists)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 pointer-events-none" />
            </div>
            <div className="mt-2">
              <input
                type="text"
                placeholder="or type a custom repo name..."
                value={customRepo}
                onChange={e => { setCustomRepo(e.target.value); setRepo(''); }}
                className="input-field text-sm"
                disabled={deploying}
              />
            </div>
          </div>

          {/* Branch */}
          <div>
            <label className="block text-xs text-dark-400 mb-1.5">Branch</label>
            <input
              type="text"
              value={branch}
              onChange={e => setBranch(e.target.value)}
              className="input-field text-sm"
              disabled={deploying}
              placeholder="main"
            />
          </div>

          {/* PM2 name */}
          <div>
            <label className="block text-xs text-dark-400 mb-1.5">PM2 Process Name</label>
            <input
              type="text"
              value={pm2Name}
              onChange={e => setPm2Name(e.target.value)}
              className="input-field text-sm font-mono"
              disabled={deploying}
              placeholder="my-app"
            />
          </div>

          {/* Port */}
          <div>
            <label className="block text-xs text-dark-400 mb-1.5">Port</label>
            <input
              type="number"
              value={port}
              onChange={e => setPort(e.target.value)}
              className="input-field text-sm font-mono"
              disabled={deploying}
              placeholder="3050"
              min={3000}
              max={9999}
            />
          </div>

          <button
            onClick={done ? reset : startDeploy}
            disabled={deploying || (!(customRepo || repo) || !port)}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all ${
              done?.success ? 'bg-green-600 hover:bg-green-500 text-white' :
              done?.error ? 'bg-red-600 hover:bg-red-500 text-white' :
              'btn-primary'
            } disabled:opacity-40`}
          >
            {deploying ? (
              <><Loader2 size={15} className="animate-spin" /> Deploying...</>
            ) : done?.success ? (
              <><CheckCircle size={15} /> Deployed! Deploy another</>
            ) : done?.error ? (
              <><XCircle size={15} /> Failed. Try again</>
            ) : (
              <><Rocket size={15} /> Deploy</>
            )}
          </button>
        </div>

        {/* Pipeline steps */}
        <div className="rounded-xl border border-dark-700 bg-dark-900 p-5 space-y-2">
          <h2 className="text-sm font-semibold text-dark-200">Pipeline</h2>

          {steps.length === 0 && !deploying && (
            <div className="py-8 text-center text-dark-600 text-sm">
              Configure and click Deploy to start
            </div>
          )}

          {steps.map(step => <StepRow key={step.id} step={step} />)}

          {done && (
            <div className={`mt-3 p-3 rounded-lg text-sm flex items-center gap-2 ${
              done.success ? 'bg-green-500/10 border border-green-500/20 text-green-400' :
                            'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}>
              {done.success ? <CheckCircle size={15} /> : <XCircle size={15} />}
              {done.success ? `Deployed successfully on port ${port}` : `Error: ${done.error}`}
            </div>
          )}
        </div>
      </div>

      {/* Output log */}
      {output.length > 0 && (
        <div className="rounded-xl border border-dark-700 bg-dark-950 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-dark-800">
            <Terminal size={13} className="text-dark-500" />
            <span className="text-xs text-dark-500">Deploy output</span>
            <span className="text-xs text-dark-600 ml-auto">{output.length} lines</span>
          </div>
          <div
            ref={outputRef}
            className="font-mono text-xs p-4 max-h-72 overflow-auto space-y-0.5"
          >
            {output.map((line, i) => (
              <div
                key={i}
                className={line.isErr ? 'text-yellow-400/80' : 'text-dark-300'}
              >
                {line.text.trimEnd()}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
