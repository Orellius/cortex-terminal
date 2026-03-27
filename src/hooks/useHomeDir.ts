import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface HomeDirResult {
  homeDir: string;
  cwd: string;
  setCwd: (cwd: string) => void;
}

export function useHomeDir(): HomeDirResult {
  const [homeDir, setHomeDir] = useState("");
  const [cwd, setCwd] = useState("");

  useEffect(() => {
    // Fetch both home dir and launch dir in parallel
    Promise.all([
      invoke<string>("get_home_dir").catch(() => "/"),
      invoke<string>("get_launch_dir").catch(() => ""),
    ]).then(([home, launch]) => {
      setHomeDir(home);
      // Use launch dir (where Cortex was opened from) as default, not home
      setCwd((prev) => prev || launch || home);
    });
  }, []);

  return { homeDir, cwd, setCwd };
}
