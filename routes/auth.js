const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const passport = require('passport');
const axios = require('axios');
const router = express.Router();
const nodemailer = require('nodemailer');

//! Node Mailer Setup  

const transporter = nodemailer.createTransport({
  service: 'Gmail', // E.g., 'Gmail', 'Outlook', or use your own SMTP settings
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});




//! Register user with email and password
router.post('/register', async (req, res) => {
  const { userName, email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    user = new User({
      userName,
      email,
      password,
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

//! Check username availability

router.post('/check-username', async (req, res) => {
  const { userName } = req.body;
  try {
    let user = await
      User.findOne({ userName });
    if (user) {
      return res.status(200).json({ msg: 'Username already exists' });
    }
    res.status(200).json({ msg: 'Username is available' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

//! Login user with email and password
router.post('/login', async (req, res) => {
  const { email, userName, password } = req.body;
  try {
    let user = await User.findOne({ $or: [{ email }, { userName }] });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;

        if (!user.emailVerified) {
          console.log('Email is not validated');
          return res.status(200).json({ token, msg: 'Email is not validated' });
        }
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// ! Auth user

router.post('/auth-user', async (req, res) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    const user = await User.findById(req.user.id);
    res.json(user);
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }

});

//! check if User have validated their email 

router.post('/check-email-validated', async (req, res) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    const user = await User.findById(req.user.id);
    if (user.emailValidated) {
      res.json({ msg: 'Email is validated' });
    }
    res.json({ msg: 'Email is not validated' });
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }

});

// ! Send Email Verification Link

router.post('/send-email-verification-link', async (req, res) => {
  const userToken = req.header('x-auth-token');
  try {
    const decoded = jwt.verify(userToken, process.env.JWT_SECRET);
    const user  = await User.findById(decoded.user.id);
    if (!user) {
      return res.status(400).json({ msg: 'User does not exist' });
    }
    const payload = {
      user: {
        id: user.id,
      },
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    user.emailToken = token;
    await user.save();

    const verificationLink = `http://localhost:5000/api/auth/verify-email?token=${token}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Email Verification',
      text: `Please verify your email by clicking on the following link: ${verificationLink}`,
      html: `<p>Please verify your email by clicking on the following link: <a href="${verificationLink}">${verificationLink}</a></p>`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(error.message);
        return res.status(500).send('Server error');
      }
      res.json({ msg: 'Email sent' });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


// ! Verify Email

router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);
    if (!user) {
      return res.status(400).json({ msg: 'User does not exist' });
    }
    user.emailValidated = true;
    await user.save();
    res.redirect('http://localhost:3000/login');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


//* Google OAuth route
router.post('/google', async (req, res) => {
  const { token } = req.body;

  try {
    // Verify and process the token here
    const response = await axios.get(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${token}`);
    const { sub: googleId, email } = response.data;

    let user = await User.findOne({ googleId });

    if (user) {
      // Existing user
      const payload = { user: { id: user.id } };
      const jwtToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ token: jwtToken });
    } else {
      // New user
      user = new User({ googleId, email });
      await user.save();
      const payload = { user: { id: user.id } };
      const jwtToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ token: jwtToken });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    const payload = {
      user: {
        id: req.user.id,
      },
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.cookie('token', token, { httpOnly: true });
    res.redirect('http://localhost:5173/dashboard'); // Redirect to the frontend
  }
);


module.exports = router;
