import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import supabase from "../config/supabaseclient.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.SERVER_URL}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const name = profile.displayName;

        const { data: existingUser } = await supabase
          .from("user")
          .select("*")
          .eq("email", email)
          .maybeSingle();

        let user = existingUser;

        if (!existingUser) {
          const username = email.split("@")[0];

          const { data: newUser, error } = await supabase
            .from("user")
            .insert([
              {
                name,
                email,
                password: null,
                account_status: true,
                username,
              },
            ])
            .select()
            .single();

          if (error) throw error;
          user = newUser;
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));
