import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle, XCircle, AlertCircle, Github, Container, HardDrive, Cpu, MemoryStick, Globe, ExternalLink } from 'lucide-react';
import { pm2API, systemAPI, githubAPI, dockerAPI } from '@/api';
import StatsCard from '@/components/StatsCard';
import StatusBadge from '@/components/StatusBadge';
import DeploymentLink from '@/components/DeploymentLink';
import { formatBytes, formatUptime, formatRelativeTime } from '@/utils';

export default function Overview() {
  const { data: pm2Data, error: pm2Error } = useQuery({
    queryKey: ['pm2-list'],
    queryFn: pm2API.getList,
    refetchInterval: 5000,
  });

  const { data: sysData, error: sysError } = useQuery({
    queryKey: ['system-stats'],
    queryFn: systemAPI.getStats,
    refetchInterval: 10000,
  });

  const { data: reposData, error: reposError } = useQuery({
    queryKey: ['github-repos'],
    queryFn: githubAPI.getRepos,
    refetchInterval: 60000,
  });

  const { data: dockerData, error: dockerError } = useQuery({
    queryKey: ['docker-containers'],
    queryFn: dockerAPI.getContainers,
    refetchInterval: 10000,
  });

  const processes = pm2Data?.data ?? [];
  const online = processes.filter(p => p.status === 'online').length;
  const errored = processes.filter(p => p.status === 'errored').length;
  const stopped = processes.filter(p => p.status === 'stopped').length;
  const sys = sysData?.data;
  const repos = reposData?.data ?? [];
  const containers = dockerData?.data ?? [];
  const runningContainers = containers.filter(c => c.status?.startsWith('Up')).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-dark-100">Overview</h1>
        <p className="text-sm text-dark-400 mt-0.5">Real-time server &amp; deployment status</p>
      </div>

      {/* PM2 Stats */}
      <section>
        <h2 className="text-xs font-semibold text-dark-500 uppercase tracking-wider mb-3">PM2 Processes</h2>
        {pm2Error && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-3">
            <AlertCircle size={14} />
            Failed to load PM2 processes
          </div>
        )}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatsCard label="Total" value={processes.length} icon={Activity} color="blue" />
          <StatsCard label="Online" value={online} icon={CheckCircle} color="green" />
          <StatsCard label="Errored" value={errored} icon={XCircle} color="red" />
          <StatsCard label="Stopped" value={stopped} icon={AlertCircle} color="yellow" />
        </div>
      </section>

      {/* Deployments Quick Access */}
      {processes.filter(p => p.url).length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-dark-500 uppercase tracking-wider mb-3">
            <span className="flex items-center gap-1.5">
              <Globe size={12} />
              Deployments
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {processes
              .filter(p => p.url)
              .map(p => (
                <a
                  key={p.pm_id}
                  href={p.status === 'online' ? p.url : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (p.status !== 'online') {
                      e.preventDefault();
                    }
                  }}
                  className={`
                    group flex items-center gap-3 p-3 rounded-xl border transition-all duration-200
                    ${p.status === 'online'
                      ? 'border-green-500/20 bg-green-500/5 hover:border-green-500/40 hover:bg-green-500/10'
                      : 'border-dark-700 bg-dark-900 cursor-not-allowed opacity-60'
                    }
                  `}
                >
                  <div className={`
                    flex items-center justify-center w-10 h-10 rounded-lg
                    ${p.status === 'online' ? 'bg-green-500/20' : 'bg-dark-800'}
                  `}>
                    <Globe
                      size={18}
                      className={p.status === 'online' ? 'text-green-400' : 'text-dark-500'}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dark-200 truncate">{p.name}</p>
                    <p className="text-xs text-dark-500 truncate font-mono">
                      {p.url?.replace(/^https?:\/\//, '')}
                    </p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink
                      size={14}
                      className={p.status === 'online' ? 'text-green-400' : 'text-dark-600'}
                    />
                  </div>
                </a>
              ))}
          </div>
        </section>
      )}

      {/* System Stats */}
      {sysError && (
        <section>
          <h2 className="text-xs font-semibold text-dark-500 uppercase tracking-wider mb-3">System Resources</h2>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-3">
            <AlertCircle size={14} />
            Failed to load system stats
          </div>
        </section>
      )}
      {sys && (
        <section>
          <h2 className="text-xs font-semibold text-dark-500 uppercase tracking-wider mb-3">System Resources</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatsCard
              label="CPU Usage"
              value={`${sys.cpu.usage}%`}
              icon={Cpu}
              color={sys.cpu.usage > 80 ? 'red' : sys.cpu.usage > 50 ? 'yellow' : 'green'}
              sub={`${sys.cpu.cores} cores`}
            />
            <StatsCard
              label="Memory"
              value={`${sys.memory.percentage}%`}
              icon={MemoryStick}
              color={sys.memory.percentage > 85 ? 'red' : sys.memory.percentage > 65 ? 'yellow' : 'green'}
              sub={`${formatBytes(sys.memory.used)} / ${formatBytes(sys.memory.total)}`}
            />
            <StatsCard
              label="Disk"
              value={`${sys.disk.percentage}%`}
              icon={HardDrive}
              color={sys.disk.percentage > 85 ? 'red' : sys.disk.percentage > 70 ? 'yellow' : 'default'}
              sub={`${formatBytes(sys.disk.used)} / ${formatBytes(sys.disk.total)}`}
            />
            <StatsCard
              label="Uptime"
              value={formatUptime(sys.uptime)}
              icon={Activity}
              color="default"
              sub={`Load: ${sys.load.join(', ')}`}
            />
          </div>
        </section>
      )}

      {/* GitHub + Docker summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-dark-700 bg-dark-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Github size={15} className="text-dark-400" />
            <span className="text-sm font-medium text-dark-300">GitHub Repositories</span>
            <span className="ml-auto text-xs text-dark-500">{repos.length} total</span>
          </div>
          {reposError && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-3">
              <AlertCircle size={14} />
              Failed to load GitHub repositories
            </div>
          )}
          <div className="space-y-2">
            {repos.slice(0, 6).map(repo => (
              <div key={repo.id} className="flex items-center justify-between text-sm">
                <span className="text-dark-200 truncate max-w-[200px]">{repo.name}</span>
                <span className="text-xs text-dark-500 ml-2 shrink-0">{formatRelativeTime(repo.pushed_at)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-dark-700 bg-dark-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Container size={15} className="text-dark-400" />
            <span className="text-sm font-medium text-dark-300">Docker Containers</span>
            <span className="ml-auto text-xs text-dark-500">{containers.length} total · {runningContainers} up</span>
          </div>
          {dockerError && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-3">
              <AlertCircle size={14} />
              Failed to load Docker containers
            </div>
          )}
          <div className="space-y-2">
            {containers.slice(0, 6).map(c => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-dark-200 truncate max-w-[200px]">{c.name}</span>
                <StatusBadge status={c.status?.startsWith('Up') ? 'running' : 'stopped'} />
              </div>
            ))}
            {containers.length === 0 && (
              <p className="text-dark-500 text-xs">No containers found</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent processes table */}
      <section>
        <h2 className="text-xs font-semibold text-dark-500 uppercase tracking-wider mb-3">All PM2 Processes</h2>
        <div className="rounded-xl border border-dark-700 bg-dark-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-700">
                <th className="text-left text-xs text-dark-500 font-medium px-4 py-2.5">Name</th>
                <th className="text-left text-xs text-dark-500 font-medium px-4 py-2.5">Status</th>
                <th className="text-left text-xs text-dark-500 font-medium px-4 py-2.5 hidden md:table-cell">CPU</th>
                <th className="text-left text-xs text-dark-500 font-medium px-4 py-2.5 hidden md:table-cell">Memory</th>
                <th className="text-left text-xs text-dark-500 font-medium px-4 py-2.5 hidden lg:table-cell">Uptime</th>
                <th className="text-left text-xs text-dark-500 font-medium px-4 py-2.5 hidden lg:table-cell">Port</th>
                <th className="text-left text-xs text-dark-500 font-medium px-4 py-2.5">
                  <span className="flex items-center gap-1.5">
                    <Globe size={12} />
                    Deployment
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {processes.map((p, i) => (
                <tr
                  key={p.pm_id}
                  className={`border-b border-dark-800 last:border-0 transition-colors duration-150 ${
                    i % 2 === 0 ? 'bg-dark-900' : 'bg-dark-800/20'
                  } hover:bg-dark-800/40 group`}
                >
                  <td className="px-4 py-2.5 text-dark-200 font-mono text-xs">{p.name}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-2.5 text-dark-400 hidden md:table-cell">{p.monit?.cpu ?? 0}%</td>
                  <td className="px-4 py-2.5 text-dark-400 hidden md:table-cell">{formatBytes(p.monit?.memory ?? 0)}</td>
                  <td className="px-4 py-2.5 text-dark-400 hidden lg:table-cell">{formatUptime((p.pm2_env?.pm_uptime ?? 0) / 1000)}</td>
                  <td className="px-4 py-2.5 text-dark-400 hidden lg:table-cell">{p.pm2_env?.env?.PORT ?? '—'}</td>
                  <td className="px-4 py-2">
                    <DeploymentLink
                      url={p.url}
                      status={p.status}
                      showIcon={false}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
