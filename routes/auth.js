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
  const {  email, password , role, theme} = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    user = new User({
      email,
      password,
      role, 
      theme
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

      const isGoogleUser = true;

      user = new User({ googleId, email, isGoogleUser ,  userName, role, devices: [{ uid: googleId, deviceName, location, lastLogin: new Date() }] });
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
    res.json(user);
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
  const { userName, name , about} = req.body;
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
    if(about != undefined || about !== null){
      user.about = about;
    }
    await user.save();
    res.json(user);
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
  try {
    const user = await User.findOne();
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
  const { skills } = req.body;

  try {
    let user = await User.findOne();
    if (!user) {
      user = new User({ skills: [] });
    }
    const validSkills = skills.filter((item) => item.skill);

    const newSkills = validSkills.filter(
      (item) => !user.skills.some((s) => s.skill === item.skill)
    );

    newSkills.forEach((item) => {
      user.skills.push({ skill: item.skill });
    });

    const savedSkills = await user.save();
    res.json({ savedSkills, msg: 'Skills added successfully' });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ! Delete User Skills

router.delete('/delete-user-skills/:name', async (req, res) => {
  const { name } = req.params;
  try {
    const user = await User.findOne();
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


module.exports = router;
