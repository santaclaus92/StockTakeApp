const { createClient } = require('@supabase/supabase-js');

// On Vercel, environment variables are injected by the platform.
// dotenv is only useful for local development with a .env file.
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables: SUPABASE_URL and SUPABASE_ANON_KEY must be set.'
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = supabase;
