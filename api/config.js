module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).end(JSON.stringify({
    supabaseUrl:      process.env.SUPABASE_URL      || null,
    supabaseAnonKey:  process.env.SUPABASE_ANON_KEY || null,
    powerAutomateUrl: process.env.POWER_AUTOMATE_URL || null,
  }));
};
