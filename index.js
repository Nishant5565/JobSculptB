const express = require('express');
const connectDB = require('./config/db');
const dotenv = require('dotenv');
const passport = require('passport');
const session = require('express-session');
const cors = require('cors');
dotenv.config();
const cloudinary = require('./routes/cloudinary');
const fileUpload = require('express-fileupload');
const User = require('./models/user');
const app = express();
const jwt = require('jsonwebtoken');


connectDB();

app.use(cors(
     {
     origin: ['http://localhost:5173' , 'http://192.168.1.2:5173' , 'https://nishant5565.github.io', 'https://nishant5565.github.io/JobSculpt'],
     credentials: true
     }
));

app.use(fileUpload({ useTempFiles: true }));


app.use(express.json());
app.use(session({ secret: 'secret', resave: true, saveUninitialized: true }));

app.use(passport.initialize());
app.use(passport.session());

require('./config/passport')(passport);

app.use('/api/auth', require('./routes/auth'));

app.post('/upload', async (req, res, next) => {
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
        // if file size is greater than 5mb then return message
        if(file.size > 5 * 1024 * 1024) {
            return res.status(400).json({ success: false, message: 'Image should be less than 5mb' });
        }
        const publicId = user.profileImage ? user.profileImage.split('/').pop().split('.')[0] : undefined;

        const result = await cloudinary.uploader.upload(file.tempFilePath, {
            public_id: publicId,
            overwrite: true
        });

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

// update image
 
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

