import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { pdfjs } from "react-pdf";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./context/AuthContext";
import { AppDataProvider } from "./context/AppDataContext";
import { AppErrorBoundary } from "./components/ui/AppErrorBoundary";
import { primeFaceRecognitionModels } from "./lib/faceRecognition";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

const scheduleModelPreload =
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? window.requestIdleCallback.bind(window)
    : (callback) => window.setTimeout(callback, 250);

scheduleModelPreload(() => {
  primeFaceRecognitionModels().catch(() => {});
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppDataProvider>
            <App />
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  border: "1px solid #E4E8ED",
                  borderRadius: "0.625rem",
                  color: "#0F1724",
                  background: "#FFFFFF",
                  fontSize: "0.8125rem",
                  fontWeight: "500",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                },
                success: {
                  iconTheme: { primary: "#006CC4", secondary: "#E8F4FD" },
                },
              }}
            />
          </AppDataProvider>
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);
