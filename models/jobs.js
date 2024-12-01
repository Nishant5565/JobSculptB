// models/job.js
const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  jobTitle: {
    type: String,
    required: true,
  },
  requiredSkills: {
    type: [],
    required: true,
  },
  jobDescription: {
    type: String,
    required: true,
  },
  companyName: {
    type: String,
    required: true,
  },
  salary: {
    type: Number,
    required: true,
  },
  duration: {
    type: String,
    required: true,
  },
  postedDate: {
    type: Date,
    default: Date.now,
  },
  applicants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    coverLetter: {
      type: String,
      required: true,
    }
  }],
});

module.exports = mongoose.model('Job', JobSchema);