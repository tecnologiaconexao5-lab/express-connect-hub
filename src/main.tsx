import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ConfirmDialogProvider } from "./components/ui/ConfirmDialogProvider";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ConfirmDialogProvider>
    <App />
  </ConfirmDialogProvider>
);
