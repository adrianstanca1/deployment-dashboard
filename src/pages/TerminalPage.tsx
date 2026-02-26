import React, { useState, useEffect, useRef, useCallback } from 'react';
import { wsUrl } from '@/utils';
import { useSearchParams } from 'react-router-dom';
import { Terminal as TerminalIcon, Plus, X, Wifi, WifiOff, Maximize2, Minimize2, Container } from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

// ── Single Terminal Instance ────────────────────────────────────────────────

interface TerminalInstanceProps {
  sessionId: string;
  active: boolean;
  dockerContainer?: string; // If set, exec into this docker container
}

function TerminalInstance({ sessionId, active, dockerContainer }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const initRef = useRef(false);

  // Initialize xterm once
  useEffect(() => {
    if (initRef.current || !containerRef.current) return;
    initRef.current = true;

    const term = new Terminal({
      theme: {
        background: '#020617',
        foreground: '#e2e8f0',
        cursor: '#60a5fa',
        cursorAccent: '#020617',
        selectionBackground: '#1d4ed880',
        black: '#0f172a',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e2e8f0',
        brightBlack: '#334155',
        brightRed: '#fb923c',
        brightGreen: '#86efac',
        brightYellow: '#fde68a',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#f8fafc',
      },
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 13,
      lineHeight: 1.5,
      cursorBlink: true,
      cursorStyle: 'block',
      allowTransparency: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);

    termRef.current = term;
    fitRef.current = fitAddon;

    // Connect to server PTY
    connectWS(term, fitAddon);

    // Handle resize
    const ro = new ResizeObserver(() => {
      if (fitRef.current) {
        try { fitRef.current.fit(); } catch (e) { /* ignore */ }
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      wsRef.current?.close();
      term.dispose();
    };
  }, []);

  // Fit when tab becomes active
  useEffect(() => {
    if (active && fitRef.current) {
      setTimeout(() => {
        try { fitRef.current?.fit(); } catch (e) { /* ignore */ }
      }, 50);
    }
  }, [active]);

  const connectWS = useCallback((term: Terminal, fitAddon: FitAddon) => {
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.onclose = null; // prevent setConnected(false) flash
      wsRef.current.close();
    }
    const dockerParam = dockerContainer ? `&docker=${encodeURIComponent(dockerContainer)}` : '';
    const ws = new WebSocket(wsUrl(`/ws/terminal?id=${sessionId}${dockerParam}`));
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      try { fitAddon.fit(); } catch (e) { /* ignore */ }
      // Send initial resize
      sendResize(ws, term.cols, term.rows);
    };

    ws.onerror = () => {
      setConnected(false);
    };

    // PTY output → terminal
    ws.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      term.write(new Uint8Array(event.data));
    };

    // Terminal input → PTY (prefixed with 0x00)
    const onData = term.onData((data: string) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const bytes = new TextEncoder().encode(data);
      const msg = new Uint8Array(1 + bytes.length);
      msg[0] = 0x00;
      msg.set(bytes, 1);
      ws.send(msg);
    });

    // Resize → PTY (prefixed with 0x01)
    const onResize = term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
      if (ws.readyState === WebSocket.OPEN) sendResize(ws, cols, rows);
    });

    ws.onclose = () => {
      setConnected(false);
      onData.dispose();
      onResize.dispose();
    };
  }, [sessionId, dockerContainer]);

  const sendResize = (ws: WebSocket, cols: number, rows: number) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const json = JSON.stringify({ type: 'resize', cols, rows });
    const bytes = new TextEncoder().encode(json);
    const msg = new Uint8Array(1 + bytes.length);
    msg[0] = 0x01;
    msg.set(bytes, 1);
    ws.send(msg);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Connection indicator */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-dark-950 border-b border-dark-800 text-xs">
        {connected
          ? <><Wifi size={11} className="text-green-400"/><span className="text-green-400">Connected</span></>
          : <><WifiOff size={11} className="text-red-400"/><span className="text-red-400">Disconnected</span></>
        }
        {dockerContainer && (
          <span className="flex items-center gap-1 text-blue-400 ml-2">
            <Container size={11} />
            {dockerContainer}
          </span>
        )}
        <span className="text-dark-600 ml-2 font-mono">session: {sessionId.slice(0, 8)}</span>
      </div>
      {/* Terminal container */}
      <div
        ref={containerRef}
        className="flex-1 p-2 bg-dark-950"
        style={{ minHeight: 0 }}
      />
    </div>
  );
}

// ── Tab Bar ─────────────────────────────────────────────────────────────────

interface Tab {
  id: string;
  title: string;
  dockerContainer?: string;
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function TerminalPage() {
  const [searchParams] = useSearchParams();
  const rawDockerParam = searchParams.get('docker');
  const dockerParam = rawDockerParam && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(rawDockerParam)
    ? rawDockerParam
    : undefined;

  const initialTab: Tab = dockerParam
    ? { id: makeId(), title: dockerParam, dockerContainer: dockerParam }
    : { id: makeId(), title: 'Terminal 1' };

  const [tabs, setTabs] = useState<Tab[]>([initialTab]);
  const [activeId, setActiveId] = useState<string>(initialTab.id);
  const [fullscreen, setFullscreen] = useState(false);

  const addTab = () => {
    const id = makeId();
    const title = `Terminal ${tabs.length + 1}`;
    setTabs(t => [...t, { id, title }]);
    setActiveId(id);
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = tabs.filter(t => t.id !== id);
    if (remaining.length === 0) {
      const newId = makeId();
      setTabs([{ id: newId, title: 'Terminal 1' }]);
      setActiveId(newId);
    } else {
      setTabs(remaining);
      if (activeId === id) setActiveId(remaining[remaining.length - 1].id);
    }
  };

  return (
    <div className={`flex flex-col bg-dark-950 ${fullscreen ? 'fixed inset-0 z-40' : 'h-full'}`}>
      {/* Tab bar */}
      <div className="flex items-center bg-dark-900 border-b border-dark-700 shrink-0">
        <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto">
          <TerminalIcon size={14} className="text-primary-400 shrink-0 mr-1" />
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveId(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                tab.id === activeId
                  ? 'bg-dark-800 text-dark-100'
                  : 'text-dark-500 hover:text-dark-300 hover:bg-dark-800/50'
              }`}
            >
              {tab.dockerContainer ? <Container size={11} className="text-blue-400" /> : <TerminalIcon size={11} />}
              {tab.title}
              <span
                onClick={e => closeTab(tab.id, e)}
                className="ml-1 text-dark-600 hover:text-dark-300 rounded p-0.5 hover:bg-dark-700"
              >
                <X size={10} />
              </span>
            </button>
          ))}
          <button
            onClick={addTab}
            className="p-1.5 text-dark-500 hover:text-dark-100 hover:bg-dark-800 rounded transition-colors"
            title="New terminal tab"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="ml-auto px-2">
          <button
            onClick={() => setFullscreen(f => !f)}
            className="p-1.5 text-dark-500 hover:text-dark-100 hover:bg-dark-800 rounded transition-colors"
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Terminal instances — render all, show only active */}
      <div className="flex-1 overflow-hidden">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`h-full ${tab.id === activeId ? 'flex flex-col' : 'hidden'}`}
          >
            <TerminalInstance sessionId={tab.id} active={tab.id === activeId} dockerContainer={tab.dockerContainer} />
          </div>
        ))}
      </div>
    </div>
  );
}
