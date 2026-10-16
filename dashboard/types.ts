export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  notes?: string;
  files?: string[];
  finishedAt?: string | null;
}

export interface Phase {
  id: number;
  name: string;
  status: TaskStatus;
  startedAt: string | null;
  finishedAt: string | null;
  tasks: Task[];
}

export interface LogEntry {
  at: string;
  phase: number;
  task: string;
  message: string;
}

export interface Blocker {
  task: string;
  reason: string;
  needs: string;
}

export interface Progress {
  updatedAt: string;
  currentPhase: number;
  currentTask: string | null;
  phases: Phase[];
  log: LogEntry[];
  blockers: Blocker[];
}

export type CheckStatus = 'ok' | 'error';

export interface Metrics {
  generatedAt: string;
  tests: {
    status: CheckStatus;
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    files: number;
    durationMs: number;
  };
  coverage: {
    status: CheckStatus;
    lines: number | null;
    functions: number | null;
    branches: number | null;
  };
  build: { status: CheckStatus; durationMs: number; output: string };
  lint: { status: CheckStatus; durationMs: number; output: string };
  git: {
    status: CheckStatus;
    hash: string | null;
    message: string | null;
    date: string | null;
    commits: number | null;
  };
  loc: { byFolder: Record<string, number>; total: number };
}
