import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, Search, CheckCircle, XCircle } from 'lucide-react';
import { serverAPI, pm2API } from '@/api';

export default function ServerPage() {
  const [search, setSearch] = useState('');

  const { data: appsData, isLoading } = useQuery({
    queryKey: ['server-apps'],
    queryFn: serverAPI.getApps,
    refetchInterval: 30000,
  });

  const { data: pm2Data } = useQuery({
    queryKey: ['pm2-list'],
    queryFn: pm2API.getList,
    refetchInterval: 10000,
  });

  const apps = appsData?.data ?? [];
  const processes = pm2Data?.data ?? [];

  const deployedNames = new Set(
    processes.map(p => p.pm2_env?.pm_cwd?.split('/').pop() ?? '')
  );

  const filtered = apps.filter(a => a.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-dark-100">Server Files</h1>
        <p className="text-sm text-dark-400 mt-0.5">
          {apps.length} apps in /var/www · {deployedNames.size} in PM2
        </p>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
        <input
          type="text"
          placeholder="Filter apps..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field pl-9 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-dark-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(name => {
            const deployed = deployedNames.has(name);
            const pm2Process = processes.find(p => p.pm2_env?.pm_cwd?.endsWith(`/${name}`));
            return (
              <div
                key={name}
                className={`rounded-xl border p-4 bg-dark-900 transition-colors ${
                  deployed ? 'border-green-500/20 hover:border-green-500/40' : 'border-dark-700 hover:border-dark-600'
                }`}
              >
                <div className="flex items-start gap-2 mb-2">
                  <FolderOpen size={15} className={deployed ? 'text-green-400 mt-0.5 shrink-0' : 'text-dark-500 mt-0.5 shrink-0'} />
                  <span className="font-mono text-xs text-dark-200 break-all leading-relaxed">{name}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {deployed ? (
                    <>
                      <CheckCircle size={12} className="text-green-400" />
                      <span className="text-xs text-green-400">In PM2</span>
                      {pm2Process?.pm2_env?.env?.PORT && (
                        <span className="text-xs text-dark-500 ml-auto font-mono">:{pm2Process.pm2_env.env.PORT}</span>
                      )}
                    </>
                  ) : (
                    <>
                      <XCircle size={12} className="text-dark-600" />
                      <span className="text-xs text-dark-500">Not deployed</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && !isLoading && (
        <div className="text-center py-12 text-dark-500">No apps found</div>
      )}
    </div>
  );
}
