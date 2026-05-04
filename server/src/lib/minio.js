const {S3Client} = require('@aws-sdk/client-s3');

const s3 = new S3Client({
    endpoint: process.env.MINIO_ENDPOINT,
    region: 'us-east-1',
    credentials: {
        accessKeyId: process.env.MINIO_ROOT_USER,
        secretAccessKey: process.env.MINIO_ROOT_PASSWORD,
    },
    forcePathStyle: true,
});

module.exports = s3;