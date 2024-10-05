const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const passport = require('passport');
const axios = require('axios');
const router = express.Router();
const nodemailer = require('nodemailer');
const useragent =  require('useragent');
const geoip = require('geoip-lite');

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
  const { userName, email, password , role} = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    user = new User({
      userName,
      email,
      password,
      role
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
  const { email, password } = req.body;
  const userAgent = req.headers['user-agent'];
  const agent = useragent.parse(userAgent);
  const deviceName = `${agent.toAgent()} on ${agent.os.toString()}`;
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const geo = geoip.lookup(ip);

  const location = geo ? `${geo.city}, ${geo.region}, ${geo.country}` : 'Unknown location';

  try {
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    // Update the devices array with the new device
    const deviceExists = user.devices.some(device => device.deviceName === deviceName && device.location === location);
    if (!deviceExists) {
      user.devices.push({ uid: user.id, deviceName, location, lastLogin: new Date() });
      await user.save();
    }

    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '3h' },
      (err, token) => {
        if (err) throw err;

        if (!user.emailVerified) {
          return res.status(200).json({ token, msg: 'Email is not Verified' });
        }
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


//* Google OAuth route

router.post('/google', async (req, res) => {
  const { token, role } = req.body;
  const userAgent = req.headers['user-agent'];
  const agent = useragent.parse(userAgent);
  const deviceName = `${agent.toAgent()} on ${agent.os.toString()}`;
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const geo = geoip.lookup(ip);
  const location = geo ? `${geo.city}, ${geo.region}, ${geo.country}` : 'Unknown location';
  console.log(location);
  try {
    const response = await axios.get(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${token}`);
    const { sub: googleId, email } = response.data;

    let user = await User.findOne({ googleId });

    if (user) {
      const deviceExists = user.devices.some(device => device.deviceName === deviceName && device.location === location);
      console.log(deviceExists);
      if (!deviceExists) {
        user.devices.push({ uid: googleId, deviceName, location, lastLogin: new Date() });
        await user.save();
      }
      const payload = { user: { id: user.id } };
      const jwtToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '3h' });
      res.json({ token: jwtToken });
    } else {
      let userName = email.split('@')[0];
      let existingUser = await User.findOne({ userName });

      while (existingUser) {
        userName = `${userName}${Math.floor(Math.random() * 10000)}`;
        existingUser = await User.findOne({ userName });
      }

      user = new User({ googleId, email, userName, role, devices: [{ uid: googleId, deviceName, location, lastLogin: new Date() }] });
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
    res.redirect(`${process.env.FrontendUrl}`); // Redirect to the frontend
  }
);

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

//! check if User have Verified their email 

router.post('/check-email-verified', async (req, res) => {
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
    if (user.emailVerified) {
      return res.json({ msg: 'Email is Verified' });
    } else {
      return res.status(200).json({ msg: 'Email is not Verified' });
    }
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
});

// ! Send Email Verification Link


router.post('/send-email-verification-link', async (req, res) => {
  const token = req.header('x-auth-token');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);
    if (!user) {
      return res.status(400).json({ msg: 'User does not exist' });
    }

    const payload = {
      user: {
        id: user.id,
      },
    };
    const demoToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Email Verification Link',
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="" alt="JobSculpt" style="max-width: 150px;">
        </div>
        <h2 style="color: #333; text-align: center;">Verify Your Email Address</h2>
        <p style="color: #555; text-align: center;">Thank you for registering with JobSculpt. Please click the button below to verify your email address and complete your registration.</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${process.env.BackendUrl}/api/auth/verify-email?token=${demoToken}" style="display: inline-block; padding: 12px 24px; font-size: 16px; color: #ffffff; background-color: #007bff; border-radius: 5px; text-decoration: none;">Verify Email</a>
        </div>
        <p style="color: #555; text-align: center;">If you did not request this email, please ignore it.</p>
        <p style="color: #555; text-align: center;">Best regards,<br>JobSculpt Team</p>
        <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
          <p>JobSculpt Inc.</p>
          <p>1234 Street Name, City, State, 12345</p>
          <p><a href="https://yourcompanywebsite.com" style="color: #007bff; text-decoration: none;">www.yourcompanywebsite.com</a></p>
        </div>
      </div>
      `,
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

    user.emailVerified = true;
    await user.save();

    const frontendUrl = `${process.env.FrontendUrl}/email-verified`;
    res.redirect(frontendUrl);

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});





router.post('/update-profile', async (req, res) => {
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

    const { userName, about } = req.body;
    user.userName = userName;
    user.about = about;


    await user.save();
    res.json(user);
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
});

// ! Get Devices of User

router.get('/devices', async (req, res) => {
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
    res.json(user.devices);
  } catch (err) { 
    res.status(401).json({ msg: 'Token is not valid' });
  }

} );


module.exports = router;
