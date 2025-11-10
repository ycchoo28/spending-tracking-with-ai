module.exports = {
  apps: [
    {
      name: 'receipt-tracker-agent',
      script: './dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Restart delay
      restart_delay: 4000,
      // Exponential backoff restart delay
      exp_backoff_restart_delay: 100,
      // Maximum number of restarts within a minute before considering the app as unstable
      max_restarts: 10,
      min_uptime: '10s',
      // Listen for SIGINT and SIGTERM signals for graceful shutdown
      kill_timeout: 5000,
      wait_ready: false,
      // Cron restart (optional - restart daily at 3 AM)
      // cron_restart: '0 3 * * *',
    },
  ],
};
