import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles/globals.css";

async function mount() {
  await document.fonts.ready;

  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("Root element not found");

  ReactDOM.createRoot(rootEl).render(<App />);
}

mount();
