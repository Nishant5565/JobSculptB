const mongoose = require('mongoose');
const { is } = require('useragent');



const LocationSchema = new mongoose.Schema({
  country: { type: String, required: true },
  city: { type: String, required: true },
  timeZone: { type: String, required: true },
  continent: { type: String, required: true },
  currency: { type: String, required: true },
});

const DeviceSchema = new mongoose.Schema({
  platform: { type: String, required: true },
  deviceName: { type: String, required: true },
  ip: { type: String, required: true },
  location: { type: LocationSchema, required: true },
  lastLogin: { type: Date, required: true },
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
    default: null,
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
  skills: [
    {
      skill: {
        type: String,
        required: true,
      },
      proficiency: {
        type: String,
        required: true,
      },
    },
  ],
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
  dob: {
    type: Date,
    default: Date.now,
  },

  skillsHiring: {
    type: [String],
    default: [],
    required: false,
  }

});

module.exports = mongoose.model('User', UserSchema);

