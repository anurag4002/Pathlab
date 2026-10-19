const mongoose = require('mongoose');
module.exports = mongoose.model('Sequence', new mongoose.Schema({ _id: String, value: { type: Number, required: true } }, { versionKey: false }));
