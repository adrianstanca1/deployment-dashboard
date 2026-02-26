import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderOpen, File, Upload, Download, Trash2, RefreshCw, ChevronRight,
  ChevronLeft, Home, Search, Plus, FolderPlus, FilePlus, X, Edit3,
  Save, AlertTriangle, CheckCircle, ArrowUp, ArrowDown, Archive,
  Terminal, Play, Settings, Shield, Lock
} from 'lucide-react';
import { serverAPI, systemAPI } from '@/api';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified: string;
  permissions?: string;
  owner?: string;
}

// File icon based on extension
function getFileIcon(name: string, type: string) {
  if (type === 'directory') return { icon: FolderOpen, color: 'text-yellow-400' };

  const ext = name.split('.').pop()?.toLowerCase();
  const iconMap: Record<string, { icon: any; color: string }> = {
    js: { icon: File, color: 'text-yellow-300' },
    ts: { icon: File, color: 'text-blue-400' },
    jsx: { icon: File, color: 'text-cyan-400' },
    tsx: { icon: File, color: 'text-blue-500' },
    json: { icon: File, color: 'text-green-400' },
    md: { icon: File, color: 'text-gray-400' },
    html: { icon: File, color: 'text-orange-400' },
    css: { icon: File, color: 'text-blue-300' },
    scss: { icon: File, color: 'text-pink-400' },
    py: { icon: File, color: 'text-blue-500' },
    sh: { icon: File, color: 'text-green-500' },
    yml: { icon: File, color: 'text-purple-400' },
    yaml: { icon: File, color: 'text-purple-400' },
    dockerfile: { icon: File, color: 'text-blue-600' },
    env: { icon: File, color: 'text-yellow-500' },
    gitignore: { icon: File, color: 'text-red-400' },
    log: { icon: File, color: 'text-gray-500' },
  };

  return iconMap[ext || ''] || { icon: File, color: 'text-dark-400' };
}

// Upload Modal
function UploadModal({ path, onClose, onUpload }: { path: string; onClose: () => void; onUpload: (files: FileList) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files);
    }
  }, [onUpload]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-dark-700 rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-dark-100">Upload Files</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-dark-200">
            <X size={20} />
          </button>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
            ${isDragging
              ? 'border-primary-500 bg-primary-500/10'
              : 'border-dark-600 hover:border-dark-500 hover:bg-dark-800'
            }
          `}
        >
          <Upload size={48} className="mx-auto mb-4 text-dark-500" />
          <p className="text-dark-300 mb-2">Drop files here or click to browse</p>
          <p className="text-xs text-dark-500">Uploading to: {path}</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => e.target.files && onUpload(e.target.files)}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
}

// Create Item Modal
function CreateItemModal({ path, onClose, onCreate }: { path: string; onClose: () => void; onCreate: (name: string, type: 'file' | 'directory') => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'file' | 'directory'>('file');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim(), type);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-dark-900 border border-dark-700 rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-dark-100">Create New {type === 'directory' ? 'Folder' : 'File'}</h2>
          <button type="button" onClick={onClose} className="text-dark-400 hover:text-dark-200">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setType('file')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              type === 'file' ? 'bg-primary-600 text-white' : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
            }`}
          >
            <FilePlus size={16} className="inline mr-2" />
            File
          </button>
          <button
            type="button"
            onClick={() => setType('directory')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              type === 'directory' ? 'bg-primary-600 text-white' : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
            }`}
          >
            <FolderPlus size={16} className="inline mr-2" />
            Folder
          </button>
        </div>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={type === 'directory' ? 'folder-name' : 'file-name.txt'}
          className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none mb-4"
          autoFocus
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 px-4 rounded-lg bg-dark-800 text-dark-300 hover:bg-dark-700 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="flex-1 py-2 px-4 rounded-lg bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}

// File Editor Modal
function FileEditorModal({ file, onClose, onSave }: { file: FileItem; onClose: () => void; onSave: (content: string) => void }) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch file content
  React.useEffect(() => {
    const fetchContent = async () => {
      try {
        // In a real implementation, you'd fetch the file content from the server
        setContent(`// Content of ${file.name}\n// File editing would be implemented with a proper backend endpoint`);
      } catch (error) {
        console.error('Failed to load file:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchContent();
  }, [file]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(content);
      onClose();
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-dark-950/90 backdrop-blur-sm z-50 flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-dark-800 bg-dark-900">
        <div className="flex items-center gap-3">
          <Edit3 size={18} className="text-primary-400" />
          <span className="font-mono text-sm text-dark-200">{file.path}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            <Save size={16} />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-800"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-dark-500">
            Loading...
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full bg-dark-900 border border-dark-700 rounded-xl p-4 font-mono text-sm text-dark-100 resize-none focus:border-primary-500 focus:outline-none"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
}

export default function EnhancedFileManager() {
  const [currentPath, setCurrentPath] = useState('/var/www');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingFile, setEditingFile] = useState<FileItem | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const qc = useQueryClient();

  // Fetch directory contents
  const { data: filesData, isLoading, refetch } = useQuery({
    queryKey: ['server-files', currentPath],
    queryFn: async () => {
      const res = await fetch(`/api/server/browse?path=${encodeURIComponent(currentPath)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('dashboard_token')}` },
      });
      return res.json();
    },
    refetchInterval: 30000,
  });

  const files: FileItem[] = filesData?.data?.contents || [];

  // Filter files
  const filteredFiles = files.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort: directories first, then files
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'directory' ? -1 : 1;
  });

  // Navigation
  const navigateUp = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    setCurrentPath(parent);
  };

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    setSelectedFiles(new Set());
  };

  // File operations
  const handleUpload = async (fileList: FileList) => {
    const formData = new FormData();
    Array.from(fileList).forEach(file => {
      formData.append('files', file);
    });
    formData.append('path', currentPath);

    try {
      await fetch('/api/server/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('dashboard_token')}` },
        body: formData,
      });
      refetch();
      setShowUploadModal(false);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const handleCreate = async (name: string, type: 'file' | 'directory') => {
    try {
      await fetch('/api/server/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('dashboard_token')}`,
        },
        body: JSON.stringify({ path: currentPath, name, type }),
      });
      refetch();
    } catch (error) {
      console.error('Create failed:', error);
    }
  };

  const handleDelete = async (path: string) => {
    if (!confirm(`Are you sure you want to delete ${path.split('/').pop()}?`)) return;

    try {
      await fetch('/api/server/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('dashboard_token')}`,
        },
        body: JSON.stringify({ path }),
      });
      refetch();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleDownload = (file: FileItem) => {
    window.open(`/api/server/download?path=${encodeURIComponent(file.path)}&token=${localStorage.getItem('dashboard_token')}`, '_blank');
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Breadcrumb navigation
  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div className="h-full flex flex-col bg-dark-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-dark-800 bg-dark-900">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-primary-400" />
            <h1 className="text-lg font-bold text-dark-100">File Manager</h1>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm">
            <button
              onClick={() => navigateTo('/var/www')}
              className="px-2 py-1 rounded text-dark-400 hover:text-dark-200 hover:bg-dark-800"
            >
              <Home size={14} />
            </button>
            {pathParts.slice(2).map((part, index) => (
              <React.Fragment key={index}>
                <ChevronRight size={14} className="text-dark-600" />
                <button
                  onClick={() => navigateTo('/' + pathParts.slice(0, index + 3).join('/'))}
                  className="px-2 py-1 rounded text-dark-300 hover:text-dark-100 hover:bg-dark-800 font-mono"
                >
                  {part}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none w-64"
            />
          </div>

          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-colors"
          >
            <Upload size={16} />
            Upload
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-200 text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            New
          </button>

          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-800 transition-colors"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-dark-800 bg-dark-900/50">
        <div className="flex items-center gap-2">
          <button
            onClick={navigateUp}
            disabled={currentPath === '/var/www'}
            className="p-2 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-dark-500">
            {sortedFiles.length} items
          </span>
        </div>

        {selectedFiles.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-dark-400">{selectedFiles.size} selected</span>
            <button
              onClick={() => {
                selectedFiles.forEach(path => handleDelete(path));
                setSelectedFiles(new Set());
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* File List */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-dark-500">
            Loading...
          </div>
        ) : sortedFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-dark-500">
            <FolderOpen size={48} className="mb-4 opacity-50" />
            <p>{searchQuery ? 'No files match your search' : 'This folder is empty'}</p>
          </div>
        ) : (
          <div className="border border-dark-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-dark-800/50 border-b border-dark-800">
                  <th className="text-left px-4 py-3 text-dark-500 font-medium w-12">
                    <input
                      type="checkbox"
                      checked={selectedFiles.size === sortedFiles.length && sortedFiles.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFiles(new Set(sortedFiles.map(f => f.path)));
                        } else {
                          setSelectedFiles(new Set());
                        }
                      }}
                      className="rounded border-dark-600"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-dark-500 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-dark-500 font-medium">Size</th>
                  <th className="text-left px-4 py-3 text-dark-500 font-medium">Modified</th>
                  <th className="text-right px-4 py-3 text-dark-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedFiles.map((file) => {
                  const { icon: Icon, color } = getFileIcon(file.name, file.type);
                  const isSelected = selectedFiles.has(file.path);

                  return (
                    <tr
                      key={file.path}
                      className={`border-b border-dark-800 last:border-0 transition-colors ${
                        isSelected ? 'bg-primary-500/10' : 'hover:bg-dark-800/50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const newSet = new Set(selectedFiles);
                            if (e.target.checked) {
                              newSet.add(file.path);
                            } else {
                              newSet.delete(file.path);
                            }
                            setSelectedFiles(newSet);
                          }}
                          className="rounded border-dark-600"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            if (file.type === 'directory') {
                              navigateTo(file.path);
                            } else {
                              setEditingFile(file);
                            }
                          }}
                          className="flex items-center gap-3 text-dark-200 hover:text-primary-400"
                        >
                          <Icon size={18} className={color} />
                          <span className="font-mono">{file.name}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-dark-500">{formatFileSize(file.size)}</td>
                      <td className="px-4 py-3 text-dark-500 text-xs">{file.modified}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {file.type === 'file' && (
                            <>
                              <button
                                onClick={() => handleDownload(file)}
                                className="p-1.5 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-700"
                                title="Download"
                              >
                                <Download size={14} />
                              </button>
                              <button
                                onClick={() => setEditingFile(file)}
                                className="p-1.5 rounded-lg text-dark-400 hover:text-primary-400 hover:bg-primary-500/10"
                                title="Edit"
                              >
                                <Edit3 size={14} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDelete(file.path)}
                            className="p-1.5 rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showUploadModal && (
        <UploadModal
          path={currentPath}
          onClose={() => setShowUploadModal(false)}
          onUpload={handleUpload}
        />
      )}

      {showCreateModal && (
        <CreateItemModal
          path={currentPath}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}

      {editingFile && (
        <FileEditorModal
          file={editingFile}
          onClose={() => setEditingFile(null)}
          onSave={async () => {
            // Save would be implemented
            setEditingFile(null);
          }}
        />
      )}
    </div>
  );
}
