const express = require('express');
const connectDB = require('./config/db');
const dotenv = require('dotenv');
const passport = require('passport');
const session = require('express-session');
const cors = require('cors');
dotenv.config();



const app = express();
connectDB();

app.use(cors(
     {
     origin: ['http://localhost:5173' , 'http://192.168.1.2:5173' , 'https://nishant5565.github.io', 'https://nishant5565.github.io/JobSculpt'],
     credentials: true
     }
));


app.use(express.json());
app.use(session({ secret: 'secret', resave: true, saveUninitialized: true }));

app.use(passport.initialize());
app.use(passport.session());

require('./config/passport')(passport);

app.use('/api/auth', require('./routes/auth'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
