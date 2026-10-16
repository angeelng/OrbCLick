/**
 * Dashboard de desarrollo (solo dev). Lee `progress/progress.json` y
 * `progress/metrics.json` cada 3 s y repinta sin recargar la página.
 */
import './dashboard.css';
import type { Blocker, LogEntry, Metrics, Phase, Progress, Task, TaskStatus } from './types';

const POLL_MS = 3000;
const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'pendiente',
  in_progress: 'en curso',
  done: 'hecha',
  blocked: 'bloqueada',
};

function el(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`Falta el elemento #${id} en dashboard/index.html`);
  return node;
}

const nodes = {
  freshness: el('freshness'),
  error: el('error'),
  ring: el('ring-value'),
  globalPercent: el('global-percent'),
  currentPhase: el('current-phase'),
  currentTask: el('current-task'),
  taskCount: el('task-count'),
  locTotal: el('loc-total'),
  quality: el('quality'),
  locBars: el('loc-bars'),
  git: el('git'),
  blockers: el('blockers'),
  phases: el('phases'),
  activity: el('activity'),
};

// --- utilidades -------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function fetchJson<T>(path: string, isValid: (value: unknown) => value is T): Promise<T> {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  const data: unknown = await response.json();
  if (!isValid(data)) throw new Error(`${path}: formato inesperado`);
  return data;
}

function isProgress(value: unknown): value is Progress {
  return isRecord(value) && Array.isArray(value['phases']) && Array.isArray(value['log']);
}

function isMetrics(value: unknown): value is Metrics {
  return isRecord(value) && isRecord(value['tests']) && isRecord(value['loc']);
}

function relativeTime(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `hace ${seconds} s`;
  if (seconds < 3600) return `hace ${Math.round(seconds / 60)} min`;
  if (seconds < 86_400) return `hace ${Math.round(seconds / 3600)} h`;
  return `hace ${Math.round(seconds / 86_400)} d`;
}

const timeFormat = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' });

function formatDate(iso: string | null): string {
  return iso === null ? '—' : timeFormat.format(new Date(iso));
}

function formatNumber(value: number): string {
  return value.toLocaleString('es-ES');
}

function create<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function statusDot(status: TaskStatus): HTMLElement {
  return create('span', `dot dot--${status}`);
}

// --- pintado --------------------------------------------------------------

function renderSummary(progress: Progress, metrics: Metrics | null): void {
  const tasks = progress.phases.flatMap((phase) => phase.tasks);
  const done = tasks.filter((task) => task.status === 'done').length;
  const percent = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100);

  nodes.ring.style.strokeDashoffset = String(
    RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * percent) / 100,
  );
  nodes.globalPercent.textContent = `${percent} %`;

  const phase = progress.phases.find((candidate) => candidate.id === progress.currentPhase);
  nodes.currentPhase.textContent =
    phase === undefined ? `${progress.currentPhase}` : `${phase.id}. ${phase.name}`;

  const current = tasks.find((task) => task.id === progress.currentTask);
  nodes.currentTask.textContent =
    progress.currentTask === null
      ? 'ninguna'
      : `${progress.currentTask} · ${current?.title ?? 'desconocida'}`;

  nodes.taskCount.textContent = `${done} / ${tasks.length}`;
  nodes.locTotal.textContent = metrics === null ? '—' : `${formatNumber(metrics.loc.total)} líneas`;
}

function metricCard(
  label: string,
  value: string,
  status: 'ok' | 'error' | 'neutral',
  detail?: string,
): HTMLElement {
  const card = create('div', `metric metric--${status}`);
  card.append(create('span', 'metric-label', label), create('strong', 'metric-value', value));
  if (detail !== undefined && detail !== '') {
    card.append(create('span', 'metric-detail', detail));
  }
  return card;
}

function renderQuality(metrics: Metrics | null): void {
  nodes.quality.replaceChildren();
  nodes.locBars.replaceChildren();

  if (metrics === null) {
    nodes.quality.append(
      create('p', 'empty', 'Sin métricas todavía. Ejecuta npm run progress:metrics.'),
    );
    nodes.git.textContent = '—';
    return;
  }

  const { tests, coverage, build, lint, git, loc } = metrics;
  nodes.quality.append(
    metricCard(
      'Tests',
      `${tests.passed} / ${tests.total}`,
      tests.failed > 0 || tests.status === 'error' ? 'error' : 'ok',
      tests.failed > 0 ? `${tests.failed} fallando` : `${tests.files} archivos`,
    ),
    metricCard(
      'Cobertura core',
      coverage.lines === null ? '—' : `${coverage.lines.toFixed(1)} %`,
      coverage.lines === null ? 'neutral' : coverage.lines >= 80 ? 'ok' : 'error',
      coverage.branches === null ? '' : `ramas ${coverage.branches.toFixed(1)} %`,
    ),
    metricCard('Build', build.status === 'ok' ? 'ok' : 'error', build.status, build.output),
    metricCard('Lint', lint.status === 'ok' ? 'ok' : 'error', lint.status, lint.output),
  );

  const folders = Object.entries(loc.byFolder).sort(([, a], [, b]) => b - a);
  const max = folders[0]?.[1] ?? 1;
  for (const [folder, lines] of folders) {
    const row = create('div', 'loc-row');
    const bar = create('div', 'bar');
    const fill = create('div', 'bar-fill');
    fill.style.width = `${Math.round((lines / max) * 100)}%`;
    bar.append(fill);
    row.append(create('span', undefined, folder), bar, create('span', undefined, `${lines}`));
    nodes.locBars.append(row);
  }

  nodes.git.textContent =
    git.status === 'ok' && git.hash !== null
      ? `Último commit ${git.hash} · ${git.message ?? ''} · ${formatDate(git.date)} · ${git.commits ?? '?'} commits`
      : 'Sin repositorio git todavía.';
}

function renderBlockers(blockers: readonly Blocker[]): void {
  nodes.blockers.replaceChildren();
  if (blockers.length === 0) {
    nodes.blockers.append(create('p', 'empty', 'Nada bloqueado. Vía libre.'));
    return;
  }
  for (const blocker of blockers) {
    const card = create('div', 'blocker');
    card.append(
      create('strong', 'blocker-task', `Tarea ${blocker.task}`),
      create('p', undefined, blocker.reason),
      create('p', 'dash-note', `Necesita: ${blocker.needs}`),
    );
    nodes.blockers.append(card);
  }
}

function renderTask(task: Task): HTMLElement {
  const item = create('li', `task status-${task.status}`);
  item.append(
    statusDot(task.status),
    create('span', 'task-id', task.id),
    create('span', 'task-title', task.title),
  );
  if (task.notes !== undefined && task.notes !== '') {
    item.append(create('span', 'task-notes', task.notes));
  }
  return item;
}

function renderPhase(phase: Phase, isCurrent: boolean): HTMLDetailsElement {
  const done = phase.tasks.filter((task) => task.status === 'done').length;
  const percent = phase.tasks.length === 0 ? 0 : Math.round((done / phase.tasks.length) * 100);

  const details = create('details', 'phase');
  details.open = isCurrent || phase.status === 'in_progress';

  const summary = document.createElement('summary');
  const head = create('div', 'phase-head');
  head.append(
    create('div', 'phase-name', `${phase.id}. ${phase.name}`),
    create('span', 'badge', STATUS_LABEL[phase.status]),
  );

  const bar = create('div', 'bar');
  const fill = create('div', 'bar-fill');
  fill.style.width = `${percent}%`;
  bar.append(fill);

  const dates =
    phase.startedAt === null
      ? 'sin empezar'
      : `inicio ${formatDate(phase.startedAt)}${
          phase.finishedAt === null ? '' : ` · fin ${formatDate(phase.finishedAt)}`
        }`;

  summary.append(
    head,
    bar,
    create('span', 'phase-count', `${done} / ${phase.tasks.length} tareas · ${percent} %`),
    create('span', 'phase-dates', dates),
  );

  const list = create('ul', 'task-list');
  list.append(...phase.tasks.map(renderTask));

  details.append(summary, list);
  return details;
}

function renderPhases(progress: Progress): void {
  // Conserva qué fases tenía desplegadas el autor entre repintados.
  const openIds = new Set(
    [...nodes.phases.querySelectorAll<HTMLDetailsElement>('details[open]')].map(
      (details) => details.dataset['phase'],
    ),
  );

  nodes.phases.replaceChildren();
  for (const phase of progress.phases) {
    const node = renderPhase(phase, phase.id === progress.currentPhase);
    node.dataset['phase'] = String(phase.id);
    if (openIds.size > 0) node.open = openIds.has(String(phase.id));
    nodes.phases.append(node);
  }
}

function renderActivity(log: readonly LogEntry[], now: number): void {
  nodes.activity.replaceChildren();
  if (log.length === 0) {
    nodes.activity.append(create('li', 'empty', 'Sin actividad registrada.'));
    return;
  }
  for (const entry of log) {
    const item = document.createElement('li');
    const time = document.createElement('time');
    time.dateTime = entry.at;
    time.textContent = `${formatDate(entry.at)} (${relativeTime(entry.at, now)})`;
    item.append(
      time,
      create('span', 'activity-task', `F${entry.phase} · ${entry.task}`),
      create('span', undefined, entry.message),
    );
    nodes.activity.append(item);
  }
}

// --- ciclo de refresco ----------------------------------------------------

let lastUpdatedAt: string | null = null;

function showError(message: string | null): void {
  if (message === null) {
    nodes.error.hidden = true;
    return;
  }
  nodes.error.hidden = false;
  nodes.error.textContent = message;
}

async function refresh(): Promise<void> {
  const progress = await fetchJson('../progress/progress.json', isProgress);
  const metrics = await fetchJson('../progress/metrics.json', isMetrics).catch(() => null);
  const now = Date.now();

  renderSummary(progress, metrics);
  renderQuality(metrics);

  // Las listas largas solo se repintan cuando el progreso cambió de verdad.
  if (progress.updatedAt !== lastUpdatedAt) {
    lastUpdatedAt = progress.updatedAt;
    renderPhases(progress);
    renderBlockers(progress.blockers);
    renderActivity(progress.log, now);
  }
  showError(null);
}

function tickFreshness(): void {
  nodes.freshness.textContent =
    lastUpdatedAt === null ? 'sin datos' : `actualizado ${relativeTime(lastUpdatedAt, Date.now())}`;
}

function poll(): void {
  void refresh().catch((error: unknown) => {
    showError(error instanceof Error ? error.message : 'error al leer el progreso');
  });
}

poll();
tickFreshness();
setInterval(poll, POLL_MS);
setInterval(tickFreshness, 1000);
