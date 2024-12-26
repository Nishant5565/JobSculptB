const express = require('express');
const connectDB = require('./config/db');
const dotenv = require('dotenv');
const passport = require('passport');
const session = require('express-session');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const jwt = require('jsonwebtoken');
const User = require('./models/user');
const Skill = require('./models/skills');
const cloudinary = require('./routes/cloudinary');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./adminPanel/admin');
const jobs = require('./routes/jobs');

dotenv.config();

const app = express();

// Increase the limit of listeners to avoid MaxListenersExceededWarning
require('events').EventEmitter.defaultMaxListeners = 20;

// Connect to MongoDB
connectDB();

// app.use((req, res, next) => {
//   console.log('Request Origin:', req.headers.origin);
//   next();
// });

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://nishant5565.github.io/',
    'http://nishantkumarsingh.me',
    'https://nishantkumarsingh.me/JobSculpt',
    'https://v811xkq7-5173.inc1.devtunnels.ms/',
    'https://jobsculpt.netlify.app',
    'https://jobsculpt.netlify.app/'

  ],
  credentials: true
}));

app.use(fileUpload({ useTempFiles: true }));
app.use(express.json());
app.use(session({ secret: 'secret', resave: true, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

require('./config/passport')(passport);

// Routes

app.post('/', (req, res) => {
    const SecretCode = req.body.SecretCode;
    if (SecretCode === process.env.SECRET_CODE) {
        res.status(200).json({ success: true });
    } else {
        res.status(400).json({ success: false });
    }
});

app.use('/api/auth', authRoutes);
app.use('/api/jobsculpt/admin/auth', adminRoutes);
app.use('/api/', jobs);

app.post('/upload', async (req, res) => {
  try {
    const token = req.header('x-auth-token');
    if (!token) {
      return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const file = req.files.image;
    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'Image should be less than 5mb' });
    }

    let result;
    if (user.profileImage === "noImage") {
      result = await cloudinary.uploader.upload(file.tempFilePath);
    } else {
      const publicId = user.profileImage.split('/').pop().split('.')[0];
      result = await cloudinary.uploader.upload(file.tempFilePath, {
        public_id: publicId,
        overwrite: true
      });
    }

    user.profileImage = result.secure_url;
    await user.save();

    res.json({
      success: true,
      message: 'Image uploaded successfully!',
      url: result.secure_url
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Upload failed', error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));