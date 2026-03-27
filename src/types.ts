export type TabKind = "ai" | "shell";
export type SplitDirection = "vertical" | "horizontal";

export interface Pane {
  id: string;
  kind: TabKind;
  cwd: string;
}

export interface Tab {
  id: string;
  title: string;
  cwd: string;
  kind: TabKind;
  panes: Pane[];
  activePaneId: string;
  splitDirection: SplitDirection | null;
}

export interface PtyOutputPayload {
  pane_id: string;
  data: number[];
}

export interface PtyExitPayload {
  pane_id: string;
}

export interface ClaudeUsage {
  session_pct: number;
  weekly_pct: number;
  session_resets: string;
  weekly_resets: string;
}

export interface ProjectEntry {
  name: string;
  path: string;
}

export interface LauncherProps {
  projects: ProjectEntry[];
  onSelect: (project: ProjectEntry) => void;
  onClose: () => void;
}
