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
    invoke<string>("get_home_dir")
      .then((dir) => {
        setHomeDir(dir);
        setCwd((prev) => (prev ? prev : dir));
      })
      .catch(() => {
        setHomeDir("/");
        setCwd((prev) => (prev ? prev : "/"));
      });
  }, []);

  return { homeDir, cwd, setCwd };
}
