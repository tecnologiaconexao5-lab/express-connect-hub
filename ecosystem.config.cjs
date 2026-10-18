/**
 * PM2 Ecosystem File — Zoho Connect Server
 *
 * Uso:
 *   npm run zoho:start     — inicia via PM2
 *   npm run zoho:stop      — para
 *   npm run zoho:restart   — reinicia
 *   npm run zoho:logs      — logs em tempo real
 *   pm2 save               — salva lista para startup automática
 *   pm2 startup            — gera script de inicialização do servidor
 *
 * Nota (Windows): PM2 tenta executar .cmd como JS gerando SyntaxError
 * (@ECHO off). A solução é usar node --import tsx diretamente, sem
 * depender de npx ou tsx.cmd como script/interpreter.
 */
const path = require("path");

module.exports = {
  apps: [
    {
      name: "zoho-connect",
      script: path.resolve(__dirname, "scripts", "zoho_connect_server.ts"),
      node_args: "--import tsx",
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      max_memory_restart: "300M",
      min_uptime: "10s",
      listen_timeout: 10000,
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
      },
      error_file: path.resolve(__dirname, "logs", "zoho-connect-error.log"),
      out_file: path.resolve(__dirname, "logs", "zoho-connect-out.log"),
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      windowsHide: true,
    },
  ],
};
