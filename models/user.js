const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
  },
  deviceName: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  lastLogin: {
    type: Date,
    default: Date.now,
  },
});

const EducationSchema = new mongoose.Schema({
  institution: {
    type: String,
    required: true,
  },
  degree: {
    type: String,
  },  
  fieldOfStudy: {
    type: String,
    required: true,
  },
  from: {
    type: Date,
    required: true,
  },
  to: {
    type: Date,
  },
  description: {
    type: String,
  },
});


const WorkExperienceSchema = new mongoose.Schema({
  company: {
    type: String,
    required: true,
  },
  position: {
    type: String,
    required: true,
  },
  from: {
    type: Date,
    required: true,
  },
  to: {
    type: Date,
  },
  description: {
    type: String,
  },
});

const UserSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true,
    unique: true,
  },
  role : {
    type: String,
    required: true,
    default: 'user',
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  password: {
    type: String,
  },
  googleId: {
    type: String,
  },
  isGoogleUser: {
    type: Boolean,
    default: false,
  },
  profileCompleteStatus: {
    type: 'String',
    default: 'Incomplete',
  },
  name: {
    type: String,
    required: false,
  },
  twoFactorAuth: {
    type: Boolean,
    default: false,
  },
  devices: [DeviceSchema],
  education: [EducationSchema],
  workExperience: [WorkExperienceSchema],
  profileCompleted: {
    type: Boolean,
    default: false,
  },
  skills: {
    type: [String],
  },
  linkedAccounts: {
    type: Map, 
    of: String,
  },
  overview: {
    type: String,
  },
  profileImage: {
    type: String,
    default: 'noImage',
  },
  about : {
    type : String,
    require : false
  },
  theme: {
    type: String,
    default: 'light',
  },
});

module.exports = mongoose.model('User', UserSchema);

