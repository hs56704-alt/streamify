const { Queue } = require('bullmq');

const transcodeQueue = new Queue('transcode', {
    connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
    },
});

module.exports = transcodeQueue;    
    