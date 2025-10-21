// Supabase client configuration for server-side operations
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Warning: Supabase credentials not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env');
}

// Create Supabase client with service role (for admin operations)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = supabase;
