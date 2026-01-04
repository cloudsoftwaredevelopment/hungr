module.exports = {
    apps: [
        {
            name: 'hungr-api',
            script: 'server.js',
            instances: 1,
            autorestart: true,
            watch: true,
            ignore_watch: ['node_modules', 'uploads', 'logs'],
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'development',
                PORT: 3000
            }
        },
        {
            name: 'hungr-worker',
            script: 'worker.js',
            instances: 1,
            autorestart: true,
            watch: true,
            ignore_watch: ['node_modules', 'uploads', 'logs'],
            max_memory_restart: '500M',
            env: {
                NODE_ENV: 'development'
            }
        }
    ]
};
