module.exports = {
  apps: [
    {
      name: "bidlock-api",
      script: "npm",
      args: "run start",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "worker-matching",
      script: "npm",
      args: "run worker:match",
      instances: 1,
      autorestart: true,
      watch: false,
    },
    {
      name: "worker-auction-closer",
      script: "npm",
      args: "run worker:close-auctions",
      instances: 1,
      autorestart: true,
      watch: false,
    },
    {
      name: "worker-hotzone-refresh",
      script: "npm",
      args: "run worker:refresh-hotzones",
      instances: 1,
      autorestart: true,
      watch: false,
    },
  ],
};
