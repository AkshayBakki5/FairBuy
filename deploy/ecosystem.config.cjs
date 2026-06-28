// PM2 ecosystem config for FairBuy backend
// Usage: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'fairbuy-server',
      script: 'server.js',
      cwd: '/home/ubuntu/fairbuy/server',
      instances: 1,           // 1 instance — t2.micro only has 1 vCPU
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '700M',  // restart if it creeps above 700 MB

      env_production: {
        NODE_ENV:    'production',
        PORT:        4000,
      },

      // Logging
      out_file:   '/home/ubuntu/logs/fairbuy-out.log',
      error_file: '/home/ubuntu/logs/fairbuy-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      // Restart policy
      autorestart:   true,
      restart_delay: 4000,
      max_restarts:  10,
    },
  ],
};
