/**
 * Genera `progress/metrics.json` para el dashboard de desarrollo.
 *
 * Ejecuta tests (con cobertura), build y lint, y recoge datos de git y del
 * tamaño del código. Nunca lanza: cualquier paso que falle queda registrado
 * como `error` para que el dashboard pueda mostrarlo.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const srcDir = join(root, 'src');

type CommandResult = { ok: boolean; durationMs: number; output: string };

interface TestMetrics {
  status: 'ok' | 'error';
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  files: number;
  durationMs: number;
}

interface CoverageMetrics {
  status: 'ok' | 'error';
  lines: number | null;
  functions: number | null;
  branches: number | null;
}

interface GitMetrics {
  status: 'ok' | 'error';
  hash: string | null;
  message: string | null;
  date: string | null;
  commits: number | null;
}

interface Metrics {
  generatedAt: string;
  tests: TestMetrics;
  coverage: CoverageMetrics;
  build: { status: 'ok' | 'error'; durationMs: number; output: string };
  lint: { status: 'ok' | 'error'; durationMs: number; output: string };
  git: GitMetrics;
  loc: { byFolder: Record<string, number>; total: number };
}

const npmCli = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command: string, args: readonly string[]): CommandResult {
  const startedAt = Date.now();
  const result = spawnSync(command, [...args], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const output = `${result.stdout}${result.stderr}`.trim();
  return { ok: result.status === 0, durationMs: Date.now() - startedAt, output };
}

/** Deja solo la cola del log: el dashboard muestra el error, no la salida entera. */
function tail(output: string, lines = 12): string {
  return output.split(/\r?\n/).slice(-lines).join('\n');
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function numberAt(value: unknown, ...path: readonly string[]): number | null {
  let current: unknown = value;
  for (const key of path) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return typeof current === 'number' ? current : null;
}

function collectTests(): { tests: TestMetrics; coverage: CoverageMetrics } {
  const tempDir = mkdtempSync(join(tmpdir(), 'orbclick-metrics-'));
  const reportPath = join(tempDir, 'vitest.json');
  const result = run(npmCli, [
    'run',
    '--silent',
    'test',
    '--',
    '--coverage',
    '--reporter=json',
    `--outputFile=${reportPath}`,
  ]);

  const report = readJson(reportPath);
  rmSync(tempDir, { recursive: true, force: true });

  const tests: TestMetrics = {
    status: result.ok ? 'ok' : 'error',
    total: numberAt(report, 'numTotalTests') ?? 0,
    passed: numberAt(report, 'numPassedTests') ?? 0,
    failed: numberAt(report, 'numFailedTests') ?? 0,
    skipped: numberAt(report, 'numPendingTests') ?? 0,
    files: numberAt(report, 'numTotalTestSuites') ?? 0,
    durationMs: result.durationMs,
  };

  const summary = readJson(join(root, 'coverage', 'coverage-summary.json'));
  const coverage: CoverageMetrics = {
    status: summary === null ? 'error' : 'ok',
    lines: numberAt(summary, 'total', 'lines', 'pct'),
    functions: numberAt(summary, 'total', 'functions', 'pct'),
    branches: numberAt(summary, 'total', 'branches', 'pct'),
  };

  return { tests, coverage };
}

function collectGit(): GitMetrics {
  const log = run('git', ['log', '-1', '--format=%h%x1f%s%x1f%cI']);
  if (!log.ok) {
    return { status: 'error', hash: null, message: null, date: null, commits: null };
  }
  const [hash = null, message = null, date = null] = log.output.split('\u001f');
  const count = run('git', ['rev-list', '--count', 'HEAD']);
  return {
    status: 'ok',
    hash,
    message,
    date,
    commits: count.ok ? Number.parseInt(count.output, 10) : null,
  };
}

function countLines(path: string): number {
  const content = readFileSync(path, 'utf8');
  return content.length === 0 ? 0 : content.replace(/\r?\n$/, '').split(/\r?\n/).length;
}

const CODE_EXTENSIONS = ['.ts', '.css', '.html'];

function collectLoc(): Metrics['loc'] {
  const byFolder: Record<string, number> = {};

  const walk = (dir: string): number => {
    let lines = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        lines += walk(path);
      } else if (CODE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
        lines += countLines(path);
      }
    }
    return lines;
  };

  if (existsSync(srcDir)) {
    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      const path = join(srcDir, entry.name);
      if (entry.isDirectory()) {
        byFolder[entry.name] = walk(path);
      } else if (CODE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
        byFolder['(raíz)'] = (byFolder['(raíz)'] ?? 0) + countLines(path);
      }
    }
  }

  const total = Object.values(byFolder).reduce((sum, lines) => sum + lines, 0);
  return { byFolder, total };
}

const { tests, coverage } = collectTests();
const build = run(npmCli, ['run', '--silent', 'build']);
const lint = run(npmCli, ['run', '--silent', 'lint']);

const metrics: Metrics = {
  generatedAt: new Date().toISOString(),
  tests,
  coverage,
  build: {
    status: build.ok ? 'ok' : 'error',
    durationMs: build.durationMs,
    output: build.ok ? '' : tail(build.output),
  },
  lint: {
    status: lint.ok ? 'ok' : 'error',
    durationMs: lint.durationMs,
    output: lint.ok ? '' : tail(lint.output),
  },
  git: collectGit(),
  loc: collectLoc(),
};

writeFileSync(join(root, 'progress', 'metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`);

const summaryLine = [
  `tests ${metrics.tests.passed}/${metrics.tests.total}`,
  `cobertura ${metrics.coverage.lines ?? '?'}%`,
  `build ${metrics.build.status}`,
  `lint ${metrics.lint.status}`,
].join(' · ');
console.log(`progress/metrics.json actualizado — ${summaryLine}`);
