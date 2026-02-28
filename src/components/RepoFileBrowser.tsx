import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Folder, FileCode, ChevronRight, Download } from 'lucide-react';

interface RepoFileBrowserProps {
  owner: string;
  repo: string;
  branch: string;
}

export function RepoFileBrowser({ owner, repo, branch }: RepoFileBrowserProps) {
  const [path, setPath] = useState('');
  
  const { data: contents } = useQuery({
    queryKey: ['github-content', owner, repo, branch, path],
    queryFn: async () => {
      const res = await fetch(`/api/github/content/${owner}/${repo}?path=${path}&ref=${branch}`);
      return res.json();
    },
  });

  return (
    <div className="border border-dark-700 rounded-lg overflow-hidden">
      <div className="p-3 border-b border-dark-700 bg-dark-800">
        <div className="flex items-center gap-2 text-sm">
          <Folder size={14} className="text-blue-400" />
          <span className="text-dark-300">{path || 'root'}</span>
        </div>
      </div>
      
      <div className="divide-y divide-dark-800">
        {contents?.data?.map((item: any) => (
          <div
            key={item.name}
            className="flex items-center justify-between p-3 hover:bg-dark-800/50 cursor-pointer"
            onClick={() => item.type === 'dir' ? setPath(item.path) : null}
          >
            <div className="flex items-center gap-3">
              {item.type === 'dir' ? (
                <Folder size={16} className="text-blue-400" />
              ) : (
                <FileCode size={16} className="text-yellow-400" />
              )}
              <span className="text-dark-200">{item.name}</span>
            </div>
            
            {item.type === 'file' && (
              <button className="p-1.5 hover:bg-dark-700 rounded text-dark-500 hover:text-dark-300">
                <Download size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
