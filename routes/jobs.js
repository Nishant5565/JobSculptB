// routes/jobs.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Job = require('../models/jobs');
const User = require('../models/user');

// Add a new job
router.post('/post-job', async (req, res) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const { jobTitle, selectedSkills, jobDescription, companyName, salary, duration } = req.body;

    // Use selectedSkills to set requiredSkills
    const newJob = new Job({
      userId: user.id,
      jobTitle,
      requiredSkills: selectedSkills, // Map selectedSkills to requiredSkills
      jobDescription,
      companyName,
      salary,
      duration,
    });

    await newJob.save();
    res.status(200).json({ msg: 'Job posted successfully', success: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get all jobs posted by a user
router.get('/employer-jobs', async (req, res) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const jobs = await Job.find({ userId: user.id });
    res.json(jobs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get all jobs posted by an employer
router.get('/employer-jobs/:employerId', async (req, res) => {
  try {
    const jobs = await Job.find({ userId: req.params.employerId });
    res.json(jobs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get All Jobs
router.get('/all-jobs', async (req, res) => { 
  try {
    const jobs = await Job.find();
    res.json(jobs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
}
);

// only the user who posted the job can delete it
router.delete('/delete-job/:id', async (req, res) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ msg: 'Job not found' });
    }

    if (job.userId.toString() !== user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    await job.deleteOne();
    res.status(200).json({ msg: 'Job removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


// send job according to the skills of the user

router.post('/find-jobs', async (req, res) => {
  const token = req.header('x-auth-token');
  const { skills } = req.body;

  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    const skillNames = skills.map(skillObj => skillObj.skill);

    const jobs = await Job.find({ requiredSkills: { $in: skillNames } });
    res.json(jobs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Apply for a job
router.post('/apply-job', async (req, res) => {
  const token = req.header('x-auth-token');
  const { jobId, userId, coverLetter } = req.body;
  console.log(token, jobId, userId, coverLetter);
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.user.id !== userId) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ msg: 'Job not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (!job.applicants) {
      job.applicants = [];
    }

    if (job.applicants.some(applicant => applicant.userId.toString() === userId)) {
      return res.status(400).json({ msg: 'Already applied' });
    }

    job.applicants.push({ userId, coverLetter });
    await job.save();
    res.json({ success: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Show all applicants for the particular job

router.get('/applicants/:jobId', async (req, res) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const job = await Job.findById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ msg: 'Job not found' });
    }
    
    if (job.userId.toString() !== user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    res.json(job.applicants);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
}
);

// Get applicants for a specific job
router.get('/job-applicants/:jobId', async (req, res) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const job = await Job.findById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ msg: 'Job not found' });
    }

    if (job.userId.toString() !== user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    const userDetails = await User.find({ _id: { $in: job.applicants.map(applicant => applicant.userId) } });

    
    res.status(200).json({ applicants: job.applicants, userDetails });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;