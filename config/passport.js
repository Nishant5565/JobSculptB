const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user');

module.exports = function (passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
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

  passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => done(err, user));
  });
};
