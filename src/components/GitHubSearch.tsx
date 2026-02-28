import React, { useState, useMemo } from 'react';
import { Search, Filter } from 'lucide-react';

interface Repo {
  name: string;
  full_name: string;
  description?: string;
  language?: string;
  stargazers_count: number;
  updated_at: string;
}

export function GitHubSearch({ repos, onFilter }: { repos: Repo[]; onFilter: (filtered: Repo[]) => void }) {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'stars' | 'name'>('updated');

  const languages = useMemo(() => {
    const langs = new Set(repos.map(r => r.language).filter(Boolean));
    return Array.from(langs);
  }, [repos]);

  const filtered = useMemo(() => {
    let result = repos;
    
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(r => 
        r.name.toLowerCase().includes(q) ||
        r.full_name.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      );
    }
    
    if (language) {
      result = result.filter(r => r.language === language);
    }
    
    result = [...result].sort((a, b) => {
      if (sortBy === 'stars') return b.stargazers_count - a.stargazers_count;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    
    return result;
  }, [repos, query, language, sortBy]);

  React.useEffect(() => {
    onFilter(filtered);
  }, [filtered, onFilter]);

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <div className="flex-1 min-w-64">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search repositories..."
            className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-dark-200 focus:outline-none focus:border-primary-500"
          />
        </div>
      </div>
      
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-dark-200 focus:outline-none"
      >
        <option value="">All Languages</option>
        {languages.map(lang => (
          <option key={lang} value={lang}>{lang}</option>
        ))}
      </select>
      
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as any)}
        className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-dark-200 focus:outline-none"
      >
        <option value="updated">Recently Updated</option>
        <option value="stars">Most Stars</option>
        <option value="name">Name</option>
      </select>
    </div>
  );
}
