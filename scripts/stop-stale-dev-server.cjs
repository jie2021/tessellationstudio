const { execFileSync } = require('node:child_process');
const path = require('node:path');

if (process.platform !== 'win32') process.exit(0);

const projectRoot = path.resolve(__dirname, '..').toLowerCase();
const escapedProjectRoot = projectRoot.replace(/'/g, "''");
const command = [
  "$connection = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1",
  'if (-not $connection) { exit 0 }',
  '$process = Get-CimInstance Win32_Process -Filter (\"ProcessId = {0}\" -f $connection.OwningProcess)',
  `$isProjectServer = $process.CommandLine -and $process.CommandLine.ToLower().Contains('${escapedProjectRoot}') -and $process.CommandLine.Contains('next')`,
  'if ($isProjectServer) { Write-Output $connection.OwningProcess; exit 0 }',
  'exit 2',
].join('; ');

try {
  const output = execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();

  if (!output) process.exit(0);

  const pid = Number(output.split(/\r?\n/).at(-1));
  if (!Number.isInteger(pid) || pid <= 0) process.exit(0);

  console.log(`Stopping stale Tessellation Studio dev server on port 3000 (PID ${pid})...`);
  execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
} catch (error) {
  if (error.status === 2) {
    console.error('Port 3000 is used by another application. Stop it or change the project port.');
    process.exit(1);
  }
  throw error;
}
