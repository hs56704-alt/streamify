const { Worker } = require('bullmq');

const worker = new Worker('transcode', async (job) => {
    console.log(`[job:${job.id}] Processing:`, job.data);
},
{
    connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
    },
}
);

worker.on('completed', (job) => {
    console.log(`[job:${job.id}] Completed`);
});

worker.on('failed', (job, err) => {
    console.error(`[job:${job.id}] Failed:`, err.message);
});