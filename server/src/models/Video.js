const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
    title: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, default: 'uploading' },
    size: {type: Number},
    originalName: {type: String},
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Video', videoSchema);