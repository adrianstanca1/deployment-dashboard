import express from 'express';
import pm2 from 'pm2';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

const app = express();
const PORT = 4000;

app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// PM2 Status
app.get('/api/pm2/status', async (req, res) => {
  try {
    const processes = await new Promise<any[]>((resolve, reject) => {
      pm2.connect((err) => {
        if (err) return reject(err);
        pm2.list((err, list) => {
          pm2.disconnect();
          if (err) return reject(err);
          resolve(list);
        });
      });
    });

    res.json({ success: true, data: processes });
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// PM2 Start
app.post('/api/pm2/start/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const projectPath = path.join('/var/www', name);

    await new Promise<void>((resolve, reject) => {
      pm2.connect((err) => {
        if (err) return reject(err);
        pm2.start({
          name,
          cwd: projectPath,
          script: 'npm',
          args: 'start',
          instances: 1,
          exec_mode: 'fork',
          env: {
            NODE_ENV: 'production',
            PORT: process.env[`PORT_${name}`] || '3000',
          },
        }, (err) => {
          pm2.disconnect();
          if (err) return reject(err);
          resolve();
        });
      });
    });

    res.json({ success: true, message: `Started ${name}` });
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : 'Failed to start' });
  }
});

// PM2 Stop
app.post('/api/pm2/stop/:name', async (req, res) => {
  try {
    const { name } = req.params;
    await new Promise<void>((resolve, reject) => {
      pm2.connect((err) => {
        if (err) return reject(err);
        pm2.stop(name, (err) => {
          pm2.disconnect();
          if (err) return reject(err);
          resolve();
        });
      });
    });
    res.json({ success: true, message: `Stopped ${name}` });
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : 'Failed to stop' });
  }
});

// PM2 Restart
app.post('/api/pm2/restart/:name', async (req, res) => {
  try {
    const { name } = req.params;
    await new Promise<void>((resolve, reject) => {
      pm2.connect((err) => {
        if (err) return reject(err);
        pm2.restart(name, (err) => {
          pm2.disconnect();
          if (err) return reject(err);
          resolve();
        });
      });
    });
    res.json({ success: true, message: `Restarted ${name}` });
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : 'Failed to restart' });
  }
});

// PM2 Delete
app.post('/api/pm2/delete/:name', async (req, res) => {
  try {
    const { name } = req.params;
    await new Promise<void>((resolve, reject) => {
      pm2.connect((err) => {
        if (err) return reject(err);
        pm2.delete(name, (err) => {
          pm2.disconnect();
          if (err) return reject(err);
          resolve();
        });
      });
    });
    res.json({ success: true, message: `Deleted ${name}` });
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : 'Failed to delete' });
  }
});

// PM2 Logs
app.get('/api/pm2/logs/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { lines = 100 } = req.query;

    const processes = await new Promise<any[]>((resolve, reject) => {
      pm2.connect((err) => {
        if (err) return reject(err);
        pm2.list((err, list) => {
          pm2.disconnect();
          if (err) return reject(err);
          resolve(list.filter(p => p.name === name));
        });
      });
    });

    if (processes.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const proc = processes[0];
    const logPath = proc.pm2_env.pm_out_log_path;
    const errLogPath = proc.pm2_env.pm_err_log_path;

    let logs: Array<{ timestamp: string; message: string; type: 'out' | 'err' }> = [];

    const readLastLines = async (filePath: string, type: 'out' | 'err') => {
      try {
        if (!fs.existsSync(filePath)) return [];
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());
        return lines.slice(-Number(lines)).map(line => ({
          timestamp: new Date().toISOString(),
          message: line,
          type,
        }));
      } catch {
        return [];
      }
    };

    const [outLogs, errLogs] = await Promise.all([
      readLastLines(logPath, 'out'),
      readLastLines(errLogPath, 'err'),
    ]);

    logs = [...outLogs, ...errLogs].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    res.json({ success: true, data: logs.slice(-Number(lines)) });
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : 'Failed to get logs' });
  }
});

// GitHub Repos
app.get('/api/github/repos/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const token = process.env.GITHUB_TOKEN;

    const repos: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && repos.length < 100) {
      const response = await fetch(
        `https://api.github.com/users/${username}/repos?per_page=100&page=${page}&sort=pushed`,
        {
          headers: token ? { Authorization: `token ${token}` } : {},
        }
      );

      if (!response.ok) break;
      const data = await response.json();
      if (data.length === 0) hasMore = false;
      else {
        repos.push(...data);
        page++;
      }
    }

    res.json({ success: true, data: repos });
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch repos' });
  }
});

// GitHub Commits
app.get('/api/github/commits/:owner/:repo', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const { branch = 'main' } = req.query;
    const token = process.env.GITHUB_TOKEN;

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?sha=${branch}&per_page=10`,
      {
        headers: token ? { Authorization: `token ${token}` } : {},
      }
    );

    const data = await response.json();
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch commits' });
  }
});

// GitHub Branches
app.get('/api/github/branches/:owner/:repo', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const token = process.env.GITHUB_TOKEN;

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches`,
      {
        headers: token ? { Authorization: `token ${token}` } : {},
      }
    );

    const data = await response.json();
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch branches' });
  }
});

// Server Directory
app.get('/api/server/www', async (req, res) => {
  try {
    const wwwPath = '/var/www';
    const items = await fs.promises.readdir(wwwPath, { withFileTypes: true });

    const pm2Processes = await new Promise<any[]>((resolve, reject) => {
      pm2.connect((err) => {
        if (err) return reject(err);
        pm2.list((err, list) => {
          pm2.disconnect();
          if (err) return reject(err);
          resolve(list);
        });
      });
    });

    const deployedNames = new Set(pm2Processes.map(p => p.name));

    const result = await Promise.all(
      items.map(async (item) => {
        const fullPath = path.join(wwwPath, item.name);
        const stats = await fs.promises.stat(fullPath);

        let gitInfo = null;
        try {
          const branchResult = await execAsync('git branch --show-current', { cwd: fullPath });
          const commitResult = await execAsync('git log -1 --format="%s|%ai"', { cwd: fullPath });
          const [commitMessage, commitDate] = commitResult.stdout.trim().split('|');
          gitInfo = {
            branch: branchResult.stdout.trim(),
            lastCommit: commitMessage,
            lastCommitDate: commitDate,
          };
        } catch {
          // Not a git repo
        }

        return {
          name: item.name,
          path: fullPath,
          type: item.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime.toISOString(),
          isDeployed: deployedNames.has(item.name),
          gitInfo,
        };
      })
    );

    res.json({ success: true, data: result.filter(i => i.type === 'directory') });
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : 'Failed to list directory' });
  }
});

// Docker Containers
app.get('/api/docker/containers', async (req, res) => {
  try {
    const { all = 'true' } = req.query;
    const { stdout } = await execAsync(
      `docker ps -a --format '{{json .}}'${all === 'false' ? '' : ''}`
    );
    const containers = stdout.trim().split('\n').filter(l => l).map(l => JSON.parse(l));
    res.json({ success: true, data: containers });
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : 'Docker not available' });
  }
});

// Docker Images
app.get('/api/docker/images', async (req, res) => {
  try {
    const { stdout } = await execAsync(`docker images --format '{{json .}}'`);
    const images = stdout.trim().split('\n').filter(l => l).map(l => JSON.parse(l));
    res.json({ success: true, data: images });
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : 'Docker not available' });
  }
});

// Docker Volumes
app.get('/api/docker/volumes', async (req, res) => {
  try {
    const { stdout } = await execAsync(`docker volume ls --format '{{json .}}'`);
    const volumes = stdout.trim().split('\n').filter(l => l).map(l => JSON.parse(l));
    res.json({ success: true, data: volumes });
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : 'Docker not available' });
  }
});

// Docker Networks
app.get('/api/docker/networks', async (req, res) => {
  try {
    const { stdout } = await execAsync(`docker network ls --format '{{json .}}'`);
    const networks = stdout.trim().split('\n').filter(l => l).map(l => JSON.parse(l));
    res.json({ success: true, data: networks });
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : 'Docker not available' });
  }
});

// System Stats
app.get('/api/system/stats', async (req, res) => {
  try {
    const os = await import('os');

    const cpus = os.cpus();
    const cpuUsage = 100 - cpus[0].times.idle / (cpus[0].times.user + cpus[0].times.nice + cpus[0].times.sys + cpus[0].times.idle + cpus[0].times.irq) * 100;

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const loadAvg = os.loadavg();

    const { stdout } = await execAsync('df -h / | tail -1');
    const parts = stdout.trim().split(/\s+/);
    const diskTotal = parseFloat(parts[1]);
    const diskUsed = parseFloat(parts[2]);
    const diskFree = parseFloat(parts[3]);
    const diskPercent = parseFloat(parts[4].replace('%', ''));

    res.json({
      success: true,
      data: {
        cpu: {
          usage: Math.round(cpuUsage * 100) / 100,
          cores: cpus.length,
          model: cpus[0].model,
        },
        memory: {
          total: totalMem,
          used: usedMem,
          free: freeMem,
          percentage: Math.round((usedMem / totalMem) * 100),
        },
        disk: {
          total: diskTotal,
          used: diskUsed,
          free: diskFree,
          percentage: diskPercent,
        },
        uptime: os.uptime(),
        load: loadAvg,
      },
    });
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : 'Failed to get system stats' });
  }
});

// Git Command Executor
app.post('/api/git/command', async (req, res) => {
  try {
    const { command, cwd = '/var/www' } = req.body;

    if (!command) {
      return res.json({ success: false, error: 'Command is required' });
    }

    // Security: only allow git commands
    if (!command.startsWith('git ')) {
      return res.json({ success: false, error: 'Only git commands are allowed' });
    }

    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    try {
      const result = await execAsync(command, {
        cwd,
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error: any) {
      stdout = error.stdout || '';
      stderr = error.stderr || error.message;
      exitCode = error.code || 1;
    }

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        command,
        output: stdout || stderr,
        error: stderr || null,
        exitCode,
        duration,
      },
    });
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : 'Failed to execute command' });
  }
});

// PM2 Deploy all from /var/www
app.post('/api/pm2/deploy-all', async (req, res) => {
  try {
    const wwwPath = '/var/www';
    const items = await fs.promises.readdir(wwwPath, { withFileTypes: true });
    const directories = items.filter(item => item.isDirectory());

    const results: Array<{ name: string; success: boolean; error?: string }> = [];

    for (const dir of directories) {
      try {
        const packageJsonPath = path.join(wwwPath, dir.name, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
          results.push({ name: dir.name, success: false, error: 'No package.json' });
          continue;
        }

        const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'));
        if (!packageJson.scripts?.start) {
          results.push({ name: dir.name, success: false, error: 'No start script' });
          continue;
        }

        await new Promise<void>((resolve, reject) => {
          pm2.connect((err) => {
            if (err) return reject(err);
            pm2.start({
              name: dir.name,
              cwd: path.join(wwwPath, dir.name),
              script: 'npm',
              args: 'start',
              instances: 1,
              exec_mode: 'fork',
              env: { NODE_ENV: 'production' },
            }, (err) => {
              pm2.disconnect();
              if (err) return reject(err);
              resolve();
            });
          });
        });

        results.push({ name: dir.name, success: true });
      } catch (error) {
        results.push({ name: dir.name, success: false, error: error instanceof Error ? error.message : 'Failed' });
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : 'Failed to deploy all' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
