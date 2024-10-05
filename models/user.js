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
    required: true,
    default: Date.now,
  },
});

const UserSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: false,
    unique: true,
  },
  emailVerified: {
    type: Boolean,
    required: false,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: false,
  },
  googleId: {
    type: String,
    required: false,
  },
  role: {
    type: String,
    required: true,
    default: 'Job',
  },
  profileImage: {
    type: String,
    required: false,
    default: 'https://res.cloudinary.com/dsjyzqnwu/image/upload/v1725361139/ynkcblb9ufqfcf61vzzw.jpg',
  },
  about: {
    type: String,
    required: false,
  },
  devices: [DeviceSchema],

});

module.exports = mongoose.model('User', UserSchema);