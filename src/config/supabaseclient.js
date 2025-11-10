import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

console.log(" SUPABASE_URL:", process.env.SUPABASE_URL);
console.log(" SUPABASE_ANON_KEY:", process.env.SUPABASE_ANON_KEY ? "Key detected" : "❌ Missing key");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default supabase;
