module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const flowUrl = process.env.POWER_AUTOMATE_URL;
  if (!flowUrl) return res.status(500).json({ message: 'POWER_AUTOMATE_URL is not set in Vercel environment variables' });

  try {
    const upstream = await fetch(flowUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    });

    const text = await upstream.text();

    // Power Automate may return 202 Accepted with no body if the flow has no Response action
    if (!upstream.ok) {
      return res.status(502).json({ message: 'Flow returned ' + upstream.status, body: text });
    }

    if (!text) {
      return res.status(202).json({ message: 'Flow accepted the request but returned no data. Add a Response action to your flow that returns JSON.' });
    }

    try {
      const data = JSON.parse(text);
      return res.status(200).json(data);
    } catch {
      return res.status(502).json({ message: 'Flow did not return valid JSON', body: text });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to reach Power Automate', details: err.message });
  }
};
