// Serve o App do Motorista (Flutter Web) — build local em C:\src\conexao_prestador\build\web
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = process.env.APP_MOBILE_DIR || "C:/src/conexao_prestador/build/web";
const PORT = Number(process.env.APP_MOBILE_PORT || 8081);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const file = path.join(ROOT, urlPath);
    fs.readFile(file, (err, data) => {
      if (err) {
        // SPA fallback
        fs.readFile(path.join(ROOT, "index.html"), (err2, html) => {
          if (err2) {
            res.writeHead(500);
            res.end("index.html nao encontrado");
            return;
          }
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(html);
        });
        return;
      }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    });
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(`[app-mobile] Servindo ${ROOT} em http://localhost:${PORT}`);
  });
