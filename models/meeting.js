const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
    link: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isPasswordSet: { type: Boolean, default: true },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400 // set to 1 day (86400 seconds)
    },
});

module.exports = mongoose.model('Meeting', meetingSchema);
