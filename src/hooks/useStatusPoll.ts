import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ClaudeUsage } from "../types";

interface StatusPollResult {
  branch: string;
  usage: ClaudeUsage;
}

const DEFAULT_USAGE: ClaudeUsage = {
  session_pct: 0,
  weekly_pct: 0,
  session_resets: "—",
  weekly_resets: "—",
};

export function useStatusPoll(cwd: string): StatusPollResult {
  const [branch, setBranch] = useState("—");
  const [usage, setUsage] = useState<ClaudeUsage>(DEFAULT_USAGE);

  const pollStatus = useCallback(async () => {
    try {
      const b = await invoke<string>("get_git_branch", { cwd });
      setBranch(b);
    } catch {
      setBranch("—");
    }
    try {
      const u = await invoke<ClaudeUsage>("get_claude_usage");
      setUsage(u);
    } catch {
      // keep last known value
    }
  }, [cwd]);

  useEffect(() => {
    pollStatus();
    const id = setInterval(pollStatus, 10_000);
    return () => clearInterval(id);
  }, [pollStatus]);

  return { branch, usage };
}
