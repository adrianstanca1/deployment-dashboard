import React, { useState, useCallback } from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';

interface DeploymentLinkProps {
  url: string | null | undefined;
  status?: string;
  showIcon?: boolean;
  className?: string;
}

export default function DeploymentLink({
  url,
  status = 'unknown',
  showIcon = true,
  className = '',
}: DeploymentLinkProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  }, [url]);

  // Don't render if no URL
  if (!url) {
    return (
      <span className={`text-dark-500 text-xs ${className}`}>
        —
      </span>
    );
  }

  const isOnline = status === 'online';
  const isClickable = isOnline;

  // Extract hostname and path for display
  const displayUrl = url.replace(/^https?:\/\//, '');
  const shortUrl = displayUrl.length > 35
    ? displayUrl.slice(0, 32) + '...'
    : displayUrl;

  return (
    <div className={`flex items-center gap-2 group ${className}`}>
      {/* URL Link */}
      <a
        href={isClickable ? url : undefined}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (!isClickable) {
            e.preventDefault();
          }
        }}
        className={`
          flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono
          transition-all duration-200
          ${isClickable
            ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:text-green-300 cursor-pointer'
            : 'bg-dark-800 text-dark-500 cursor-not-allowed'
          }
        `}
        title={isClickable ? `Open ${url}` : 'Process not running'}
      >
        {showIcon && (
          <ExternalLink
            size={12}
            className={`shrink-0 ${isClickable ? 'text-green-400' : 'text-dark-500'}`}
          />
        )}
        <span className="truncate max-w-[200px]">{shortUrl}</span>
      </a>

      {/* Copy Button */}
      <button
        onClick={handleCopy}
        className={`
          p-1 rounded-md transition-all duration-200
          ${isClickable
            ? 'text-dark-400 hover:text-green-400 hover:bg-green-500/10'
            : 'text-dark-600 cursor-not-allowed'
          }
          ${copied ? 'text-green-400' : ''}
        `}
        title={copied ? 'Copied!' : 'Copy URL'}
        disabled={!isClickable}
      >
        {copied ? (
          <Check size={12} className="text-green-400" />
        ) : (
          <Copy size={12} />
        )}
      </button>
    </div>
  );
}
