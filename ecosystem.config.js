/**
 * PM2 Ecosystem File
 * Gerencia a aplicação Next.js em produção na VPS Hostinger
 *
 * Uso (na VPS, em /var/app):
 *   pm2 start ecosystem.config.js --update-env
 *   pm2 reload ecosystem.config.js --update-env
 *   pm2 save
 *
 * Tuning: os valores abaixo assumem uma VPS de 2–4 GB de RAM rodando
 * também o PostgreSQL. Em VPS maior, aumente `instances` e o heap.
 */

module.exports = {
  apps: [
    {
      name: "gescola",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "/var/app",
      instances: 1,           // 1 processo; use 'max' + exec_mode 'cluster' em VPS maior
      exec_mode: "fork",
      // Heap do Node: ~768 MB deixa folga para o Postgres na mesma máquina
      node_args: "--max-old-space-size=768",
      max_memory_restart: "1G",
      kill_timeout: 5000,      // 5 s para o PM2 reiniciar o processo
      time: true,              // prefixa o timestamp nos logs
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
    },
  ],
};
