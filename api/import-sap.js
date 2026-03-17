module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const flowUrl = process.env.POWER_AUTOMATE_URL;
  if (!flowUrl) return res.status(500).json({ message: 'POWER_AUTOMATE_URL not configured' });

  try {
    const upstream = await fetch(flowUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    });
    if (!upstream.ok) {
      return res.status(502).json({ message: 'Flow returned ' + upstream.status });
    }
    const data = await upstream.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to reach Power Automate', details: err.message });
  }
};
