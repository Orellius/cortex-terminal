// UA patch MUST be the first import — xterm.js reads navigator.userAgent
// at module evaluation time to detect Safari.
import "./patch-ua";

import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles/globals.css";
// xterm.css MUST load AFTER globals.css so it wins over Tailwind's * rules
import "@xterm/xterm/css/xterm.css";

async function mount() {
  await document.fonts.ready;

  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("Root element not found");

  ReactDOM.createRoot(rootEl).render(<App />);
}

mount();
