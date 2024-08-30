const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user');

module.exports = function (passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:5000/api/auth/google/callback"
      },
      async (accessToken, refreshToken, profile, done) => {
        const { id, emails } = profile;

        try {
          let user = await User.findOne({ googleId: id });

          if (user) {
            done(null, user);
          } else {
            user = new User({
              googleId: id,
              email: emails[0].value,
              userName: emails[0].value.split('@')[0],
              emailVerified: true
            });
            await user.save();
            done(null, user);
          }
        } catch (err) {
          console.error(err.message);
          done(err, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
};
