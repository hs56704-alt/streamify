const express = require('express');
const multer = require('multer');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const s3 = require('../lib/minio');
const authenticate = require('../middleware/authenticate');
const Video = require('../models/Video');

const router = express.Router();

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per chunk
 });

router.post('/init', authenticate, async (req, res) => {
    try{
        const { filename, fileSize } = req.body;

        const video = new Video({
            title: filename,
            owner: req.user.userId,
            status: 'uploading',
            size: fileSize,
            originalName: filename,
        });

        await video.save();
        return res.status(201).json({ uploadId: video._id,
            filename,
         });
    } catch (error) {
        console.error('Error initializing video upload:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.post('/:id/chunk', authenticate, upload.single('chunk'), async(req,res) => {
    try{
        const video = await Video.findById(req.params.id);

        if(!video){
            return res.status(404).json({ message: 'Video not found' });
        }

        if(video.owner.toString() !== req.user.userId.toString()){
            return res.status(403).json({ message: 'Forbidden - this upload belongs to another user.' });
        }

        const chunkIndex = Number(req.body.chunkIndex);
        if(isNaN(chunkIndex) || chunkIndex < 0){
            return res.status(400).json({ message: 'Invalid chunk index' });
        }

        const key = `chunks/${video._id}/chunk_${chunkIndex}`;

        await s3.send(new PutObjectCommand({
            Bucket: process.env.MINIO_BUCKET_RAW,
            Key: key,
            Body: req.file.buffer,
            ContentType: 'application/octet-stream',
            ContentLength: req.file.size,
        }));

        console.log(`Chunk ${chunkIndex} stored for video ${video._id}-(${req.file.size} bytes -> ${key})`);

        return res.status(200).json({  received: true,
            chunkIndex,
            bytes: req.file.size,
         });
    } catch (error) {
        console.error('Error receiving video chunk:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.post('/:id/complete', authenticate, async(req,res) => {
    try{
        const video = await Video.findById(req.params.id);

        if(!video){
            return res.status(404).json({ message: 'Video not found' });
        }

        if(video.owner.toString() !== req.user.userId.toString()){
            return res.status(403).json({ message: 'Forbidden - this upload belongs to another user.' });
        }

        const totalChunks = Number(req.body.totalChunks);
        if(isNaN(totalChunks) || totalChunks <= 0){
            return res.status(400).json({ message: 'Invalid total chunks' });
        }
        //TODO: replace with streaming approach to avoid memory issues with large files
        const chunkBuffers = [];
        for(let i=0; i<totalChunks; i++){
            const response = await s3.send(new GetObjectCommand({
                Bucket: process.env.MINIO_BUCKET_RAW,
                Key: `chunks/${video._id}/chunk_${i}`,
            }));

            const pieces = [];
            for await (const piece of response.Body){
                pieces.push(piece);
            }
            chunkBuffers.push(Buffer.concat(pieces));
        }

        const fullBuffer = Buffer.concat(chunkBuffers);

        await s3.send(new PutObjectCommand({
            Bucket: process.env.MINIO_BUCKET_RAW,
            Key: `raw/${video._id}/original`,
            Body: fullBuffer,
            ContentType: 'application/octet-stream',
            ContentLength: fullBuffer.length,
        }));

        await Promise.all(
            Array.from({ length: totalChunks }, (_, i) => 
                s3.send(new DeleteObjectCommand({
                    Bucket: process.env.MINIO_BUCKET_RAW,
                    Key: `chunks/${video._id}/chunk_${i}`,
                }))
            )
        );

        video.status = 'processing';
        await video.save();

        return res.status(200).json({ message: 'Upload complete', videoId: video._id });
    } catch (error) {
        console.error('Error completing video upload:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});
        
module.exports = router;