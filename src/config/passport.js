import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import supabase from "./supabaseclient.js"; // pastikan path benar

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

        // Cek user existing
        const { data: existingUser, error: fetchError } = await supabase
          .from("user")
          .select("*")
          .eq("email", email)
          .maybeSingle();

        if (fetchError) {
          console.error("Supabase Fetch Error:", fetchError);
          return done(null, false);
        }

        let user = existingUser;

        // Kalau belum ada, insert user baru
        if (!existingUser) {
          const username = email.split("@")[0];

          const { data: newUser, error: insertError } = await supabase
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

          if (insertError) {
            console.error("Supabase Insert Error:", insertError);
            return done(null, false); // jangan throw → crash server
          }

          user = newUser;
        }

        return done(null, user);
      } catch (err) {
        console.error("Passport GoogleStrategy Error:", err);
        return done(null, false);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));
