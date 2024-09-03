const mongoose = require('mongoose');

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
  role : {
    type: String,
    required: true,
    default: 'Job',
  },
  profileImage: {
    type: String,
    required: false,
    default:'https://res.cloudinary.com/dsjyzqnwu/image/upload/v1725361139/ynkcblb9ufqfcf61vzzw.jpg',
  },
  about : {
    type: String,
    required: false,
  },
});

module.exports = mongoose.model('User', UserSchema);
