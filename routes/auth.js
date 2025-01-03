const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const passport = require('passport');
const axios = require('axios');
const router = express.Router();
const nodemailer = require('nodemailer');
const useragent =  require('useragent');
const requestIp = require('request-ip');
const geoip = require('geoip-lite');


//! Node Mailer Setup  

const transporter = nodemailer.createTransport({
  service: 'Gmail', // E.g., 'Gmail', 'Outlook', or use your own SMTP settings
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

const sendLoginEmail = (userName,email, deviceName, location, cleanedPlatform, ip) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Security Alert! New Device Login',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://res.cloudinary.com/dsjyzqnwu/image/upload/v1725359081/TitleLogo_zjmlrf.png" alt="JobSculpt" style="max-width: 150px;">
        </div>
        <h1 style="color: #333; text-align: center;">JobSculpt</h1>
        <h2 style="color: #333; text-align: center;">Hi ${userName == undefined ? email : userName} Is this was you ? </h2>
        <h3 style="color: #555; text-align: center;">A new device was used to login to your account. If this was you, you can ignore this email.</h3>
        <h3 style="color: #555; text-align: center;">If this was not you, login to your account and <a href = '${process.env.FrontendUrl}/reset-password'> change your password immediately </a> and remove the device from your account settings.</h3>
        <h3 style="color: #555; text-align: center;">Device: ${deviceName}</h3>
        <h3 style="color: #555; text-align: center;">Location: ${location.city}, ${location.country}</h3>
        <h3 style="color: #555; text-align: center;">Time: ${new Date().toLocaleString()}</h3>
        <h3 style="color: #555; text-align: center;">Platform: ${cleanedPlatform}</h3>
        <h3 style="color: #555; text-align: center;">IP: ${ip}</p>
        <h3 style="color: #555; text-align: center;">Best regards,<br>JobSculpt Team</h3>
        <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
          <p>JobSculpt Inc.</p>
          <p>1234 Street Name, City, State, 12345</p>
          <p><a href="${process.env.FrontendUrl}" style="color: #007bff; text-decoration: none;" target="_blank">
            ${process.env.FrontendUrl}
            </a></p>
        </div>
      </div>
    `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }
    console.log('Email sent: ' + info.response);
  });
};

const sendResetPasswordEmail = (userName, email, token) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset Link',
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="https://res.cloudinary.com/dsjyzqnwu/image/upload/v1725359081/TitleLogo_zjmlrf.png" alt="JobSculpt" style="max-width: 150px;">
      </div>
      <h2 style="color: #333; text-align: center;">Hello ${userName} Your Reset Password Link is Here </h2>
      <p style="color: #555; text-align: center;">Please click the button below to reset your password.</p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="${process.env.FrontendUrl}/reset-password/${token}" style="display: inline-block; padding: 12px 24px; font-size: 16px; color: #ffffff; background-color: #000; border-radius: 10px; text-decoration: none;">Reset Password</a>
      </div>
      <p style="color: #555; text-align: center;">If you did not request this email, please ignore it.</p>
      <p style="color: #555; text-align: center;">Best regards,<br>JobSculpt Team</p>
      <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
        <p>JobSculpt Inc.</p>
        <p>1234 Street Name, City, State, 12345</p>
        <p><a href="${process.env.FrontendUrl}" style="color: #007bff; text-decoration: none;" target="_blank">www.jobsculpt.com</a></p>
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
  }
  );
}

//! Check username availability

router.post('/check-username', async (req, res) => {
  const { userName } = req.body;
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);
    if (user.userName === userName) {
      return res.json({ msg: 'Username is available' });
    }
    const userNameExists = await User.findOne({ userName });
    if (userNameExists) {
      return res.status(200).json({ msg: 'Username is already taken' });
    }
    res.json({ msg: 'Username is available' });
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
} );


//! Register user with email and password
router.post('/register', async (req, res) => {
  const { email, password, role, theme } = req.body;

  try {
    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    const userAgent = req.headers['user-agent'];
    const agent = useragent.parse(userAgent);
    const platform = req.headers['sec-ch-ua-platform'];
    const cleanedPlatform = platform ? platform.replace(/"/g, '') : 'Unknown Platform';
    const deviceName = `${agent.toAgent()} on ${agent.os.toString()}`;
    const ip = req.headers['true-client-ip'] || '::1';
    let location = {
      country: 'Unknown Country',
      city: 'Unknown City',
      timeZone: 'Unknown TimeZone',
      continent: '',
      currency: 'Unknown Currency'
    };

    if (ip === '::1') {
      location = {
        country: 'India',
        city: 'Mumbai',
        timeZone: '+5:30',
        continent: 'Asia',
        currency: 'INR'
      };
    } else {
      const fetchLocation = await axios.get(`https://freeipapi.com/api/json/${ip}`);
      location = {
        country: fetchLocation?.data?.countryName,
        city: fetchLocation?.data?.cityName,
        timeZone: fetchLocation?.data?.timeZone,
        continent: fetchLocation?.data?.continent || '',
        currency: fetchLocation?.data?.currency?.code
      };
    }

    user = new User({
      userName: email.split('@')[0], // Ensure userName is set correctly
      email,
      password,
      role,
      theme,
      devices: [{
        platform: cleanedPlatform,
        deviceName,
        ip,
        location: location,
        lastLogin: new Date()
      }]
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
    if (err.code === 11000) {
      return res.status(400).json({ msg: 'User already exists with this email' });
    }
    res.status(500).send('Server error');
  }
});

router.post('/google', async (req, res) => {
  const { token, role, rememberMe } = req.body;
  const userAgent = req.headers['user-agent'];
  const agent = useragent.parse(userAgent);
  const deviceName = `${agent.toAgent()} on ${agent.os.toString()}`;
  const platform = req.headers['sec-ch-ua-platform'];
  const cleanedPlatform = platform ? platform.replace(/"/g, '') : 'Unknown Platform';
  const ip = req.headers['true-client-ip'] || '::1';
  let location = {
    country: 'Unknown Country',
    city: 'Unknown City',
    timeZone: 'Unknown TimeZone',
    continent: '',
    currency: 'Unknown Currency'
  };

  try {
    if (ip === '::1') {
      location = {
        country: 'India',
        city: 'Mumbai',
        timeZone: '+5:30',
        continent: 'Asia',
        currency: 'INR'
      };
    } else {
      const fetchLocation = await axios.get(`https://freeipapi.com/api/json/${ip}`);
      location = {
        country: fetchLocation?.data?.countryName,
        city: fetchLocation?.data?.cityName,
        timeZone: fetchLocation?.data?.timeZone,
        continent: fetchLocation?.data?.continent || '',
        currency: fetchLocation?.data?.currency?.code
      };
    }

    const response = await axios.get(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${token}`);
    const { sub: googleId, email } = response.data;

    let user = await User.findOne({ googleId });

    if (user) {
      const deviceExists = user.devices.some(device => 
        device.deviceName === deviceName && 
        device.location.city === location.city && 
        device.location.country === location.country && 
        device.location.timeZone === location.timeZone
      );

      if (!deviceExists) {
        user.devices.push({ deviceName, location: location, ip, lastLogin: new Date(), platform: cleanedPlatform });
        await user.save();
        const userName = user.userName;
        sendLoginEmail(userName, email, deviceName, location, cleanedPlatform, ip);
      } else {
        user.devices.forEach(device => {
          if (device.deviceName === deviceName) {
            device.lastLogin = new Date();
          }
        });
        await user.save();
      }

      const payload = { user: { id: user.id } };
      const jwtToken = jwt.sign(payload, process.env.JWT_SECRET, rememberMe ? { expiresIn: '365d' } : { expiresIn: '1h' });

      res.json({ token: jwtToken });
    } else {
      const isGoogleUser = true;
      const emailVerified = true;
      console.log(email.split('@')[0]);

      user = new User({
        userName: email.split('@')[0], 
        googleId,
        email,
        isGoogleUser,
        emailVerified,
        role,
        devices: [{
          platform: cleanedPlatform,
          deviceName,
          location: location,
          lastLogin: new Date(),
          ip
        }]
      });
      await user.save();
      const payload = { user: { id: user.id } };
      const jwtToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ token: jwtToken });
    }
  } catch (err) {
    console.error(err.message);
    if (err.message.includes('E11000')) {
      return res.status(400).json({ msg: 'User already exists with this email' });
    }
    res.status(500).json({ msg: err.message });
  }
});

// !Login user with email and password
router.post('/login', async (req, res) => {
  const { email, password, rememberMe } = req.body;
  const userAgent = req.headers['user-agent'];
  const agent = useragent.parse(userAgent);
  const deviceName = `${agent.toAgent()} on ${agent.os.toString()}`;
  const platform = req.headers['sec-ch-ua-platform'];
  const cleanedPlatform = platform ? platform.replace(/"/g, '') : 'Unknown Platform';
  const ip = req.headers['true-client-ip'] || '::1';
  let location = {
    country: 'Unknown Country',
    city: 'Unknown City',
    timeZone: 'Unknown TimeZone',
    continent: '',
    currency: 'Unknown Currency'
  };

  try {
    if (ip === '::1') {
      location = {

        country: 'India',
        city: 'Mumbai',
        timeZone: '+5:30',
        continent: 'Asia',
        currency: 'INR'
      };
    } else {
    const fetchLocation = await axios.get(`https://freeipapi.com/api/json/${ip}`);
      location = {
        country: fetchLocation?.data?.countryName,
        city: fetchLocation?.data?.cityName,
        timeZone: fetchLocation?.data?.timeZone,
        continent: fetchLocation?.data?.continent || '',
        currency: fetchLocation?.data?.currency?.code
      };
    }

    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const deviceExists = user.devices.some(device => 
      device.deviceName === deviceName && 
      device.location.city === location.city && 
      device.location.country === location.country && 
      device.location.timeZone === location.timeZone
    );

    if (!deviceExists) {
      user.devices.push({ deviceName, location: location, ip, lastLogin: new Date(), platform: cleanedPlatform });
      await user.save();

      const userName = user.userName;
      sendLoginEmail( userName, email, deviceName, location, cleanedPlatform, ip);
    } else {
      user.devices.forEach(device => {
        if (device.deviceName === deviceName) {
          device.lastLogin = new Date();
        }
      });
      await user.save();
    }

    const theme = user.theme;

    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: rememberMe ? '365d' : '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, theme,user });
      }
    );
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

// ! Logout user

router.post('/logout', async (req, res) => {
  const token = req.header('x-auth-token');

  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    tokenBlacklist.push(token);
    setTimeout(() => {
      const index = tokenBlacklist.indexOf(token);
      if (index > -1) {
        tokenBlacklist.splice(index, 1);
      }
    }, 365 * 24 * 60 * 60 * 1000); 
    res.clearCookie('token');
    res.json({ msg: 'Logged out successfully' });
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
    console.error(err.message);
  }
});

// ! Remove Device

router.post('/remove-device', async (req, res) => {
  const { deviceName } = req.body;
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
    const removeIndex = user.devices.map((device) => device.deviceName).indexOf(deviceName);
    if (removeIndex === -1) {
      return res.status(404).json({ msg: 'Device not found' });
    }
    user.devices.splice(removeIndex, 1);
    await user.save();
    // destroy the cookie 
    


    res.json(user.devices);
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
    console.error(err.message);
  }
});

// ! Check token validity

router.post('/check-token', async (req, res) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }
  try {
    jwt.verify(token, process.env.JWT_SECRET);

    res.json({ msg: 'Token is valid' });
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
});



// ! Forgot Password

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  console.log(email);
  try {
    const user = await User.findOne({ email });
    console.log(user);
    if (!user) {
      return res.status(400).json({ msg: 'User does not exist' });
    }
    const userName = user.userName;

    const payload = {
      user: {
        id: user.id,
      },
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    sendResetPasswordEmail(userName, email, token);
    res.json({ msg: 'Email sent' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


// ! Reset Password

router.post('/reset-password', async (req, res) => {
  const { password, token } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);
    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();
    res.json({ msg: 'Password reset successfully' });
  }
  catch (err) {
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
          <img src="https://res.cloudinary.com/dsjyzqnwu/image/upload/v1725359081/TitleLogo_zjmlrf.png" alt="JobSculpt" style="max-width: 150px;">
        </div>
        <h2 style="color: #333; text-align: center;">Verify Your Email Address</h2>
        <p style="color: #555; text-align: center;">Thank you for registering with JobSculpt. Please click the button below to verify your email address and complete your registration.</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${process.env.BackendUrl}/api/auth/verify-email?token=${demoToken}" style="display: inline-block; padding: 12px 24px; font-size: 16px; color: #ffffff; background-color: #000; border-radius: 10px; text-decoration: none;">Verify Email</a>
        </div>
        <p style="color: #555; text-align: center;">If you did not request this email, please ignore it.</p>
        <p style="color: #555; text-align: center;">Best regards,<br>JobSculpt Team</p>
        <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
          <p>JobSculpt Inc.</p>
          <p>1234 Street Name, City, State, 12345</p>
          <p><a href="${process.env.FrontendUrl}" style="color: #007bff; text-decoration: none;" target="_blank">www.jobsculpt.com</a></p>
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
    console.error(err.message);3
    res.status(500).send('Server error');
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


// * Updation API's


// ! Change Role

router.post('/change-role', async (req, res) => {

  const { role } = req.body;
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
    console.log(role);
    user.role = role;
    await user.save();
    res.json({user , msg: 'Role changed succesfully to ' + role});
  }
  catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
});

// ! Update Profile Complete Status

router.post('/update-profile-complete-status', async (req, res) => {
  const { status } = req.body;
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

    user.profileCompleteStatus = status;
    await user.save();
    res.json(user);
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
}
);


// ! Update User Name and Name and About

router.post('/update-username', async (req, res) => {
  const { userName, name , about, dob} = req.body;
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

    user.userName = userName;
    user.name = name;
    user.dob = dob;
    if(about != undefined || about !== null){
      user.about = about;
    }
    await user.save();
    res.json(user);
  } catch (err) {
    res.status(401).json({ msg: err.message });
  }
});

// ! Update user theme 

router.post('/update-theme', async (req, res) => {
  const { theme } = req.body;
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
    user.theme = theme;
    await user.save();
    res.json({ user, msg: 'Theme updated successfully' });
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
});

// ! Update Education

router.post('/update-education', async (req, res) => {
  const { education } = req.body;
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

    user.education = education;
    await user.save();
    res.json(user);
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
    console.error(err.message);
  }
});

// ! Edit Education

router.post('/edit-education', async (req, res) => {
  const { education, index } = req.body;
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

    user.education[index] = education;
    await user.save();
    res.json(user);
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
    console.error(err.message);
  }
});


// ! Delete Education 

router.post('/delete-education', async (req, res) => {
  const { index } = req.body;
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }
  try{
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    user.education.splice(index, 1);
    await user.save();
    res.json(user);
  }
  catch(err){
    res.status(401).json({ msg: 'Token is not valid' });
    console.error(err.message);
  }
});

// ! Update Work Experience

router.post('/update-work-experience', async (req, res) => {
  const { experience } = req.body;
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

    user.workExperience = experience;
    await user.save();
    res.json(user);
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
    console.error(err.message);
  }
});


// ! Edit Work Experience

router.post('/edit-work-experience', async (req, res) => {
  const { experience, index } = req.body;
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

    user.workExperience[index] = experience;
    await user.save();
    res.json(user);
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
    console.error(err.message);
  }
}
);

// ! Delete Work Experience

router.post('/delete-work-experience', async (req, res) => {
  const { index } = req.body;
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

    user.workExperience.splice(index, 1);
    await user.save();
    res.json(user);
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
    console.error(err.message);
  }
}
);

// ! Get user Skills 

router.get('/user-skills', async (req, res) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'No skills found' });
    }
    res.json(user.skills);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ! Add User Skills

router.post('/add-user-skills', async (req, res) => {
  const { skill, proficiency } = req.body;
  const token = req.header('x-auth-token');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const newSkill = { skill, proficiency };

    // if skills are more than 12 then return error
    if (user.skills.length >= 12) {
      return res.status(400).json({ msg: 'You can add maximum 12 skills' });
    }

    if (user.skills.some((item) => item.skill === skill)) {
      return res.status(400).json({ msg: 'Skill already exists' });
    }
    user.skills.unshift(newSkill);
    await user.save();
    res.status(200).json(user.skills);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }


});

// ! Delete User Skills

router.post('/delete-user-skill', async (req, res) => {
  const  {name}  = req.body;
  console.log(name);
  const token = req.header('x-auth-token');
  try {
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'No skills found' });
    }

    const removeIndex = user.skills.map((item) => item.skill).indexOf(name);
    if (removeIndex === -1) {
      return res.status(404).json({ msg: 'Skill not found' });
    }

    user.skills.splice(removeIndex, 1);
    await user.save();
    res.json(user.skills);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});


// ! Get skillsHiring for employer

router.get('/skills-hiring', async (req, res) => {


  const token =req.headers['x-auth-token'];

  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);
    const skills = user.skillsHiring;
    res.json(skills);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ! Add skillsHiring for employer

router.post('/add-skills-hiring', async (req, res) => {
  const { skill } = req.body;
  const token = req.header('x-auth-token');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    if (user.skillsHiring.some((item) => item.skill === skill)) {
      return res.status(400).json({ msg: 'Skill already exists' });
    }
    user.skillsHiring.unshift({ skill });

    await user.save();
    res.status(200).json(user.skillsHiring);
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});


// ! Delete skillsHiring for employer

router.post('/delete-skill-hiring', async (req, res) => {
  const { skill } = req.body;
  const token = req.header('x-auth-token');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const removeIndex = user.skillsHiring.map((item) => item.skill).indexOf(skill);
    if (removeIndex === -1) {
      return res.status(404).json({ msg: 'Skill not found' });
    }

    user.skillsHiring.splice(removeIndex, 1);
    await user.save();
    res.json(user.skillsHiring);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
