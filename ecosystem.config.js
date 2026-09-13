/**
 * PM2 Ecosystem File
 * Gerencia a aplicação Next.js em produção na VPS
 *
 * Uso:
 *   pm2 start ecosystem.config.js
 *   pm2 reload ecosystem.config.js
 *   pm2 logs
 */

module.exports = {
  apps: [
    {
      name: "gescola",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "/var/app",
      instances: 1,           // 1 processo (Next.js com App Router já lida bem; aumentar para 'max' em VPS maior)
      exec_mode: "fork",      // 'fork' para 1 instância, 'cluster' para múltiplas
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "/var/log/pm2/gescola-error.log",
      out_file: "/var/log/pm2/gescola-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      watch: false,
      // Health check opcional
      // node_args: ["--max-old-space-size=2048"],
    },
  ],
};
