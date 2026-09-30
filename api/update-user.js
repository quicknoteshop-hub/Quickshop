
const https = require('https');

function httpsRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ ok: res.statusCode < 300, status: res.statusCode, text: () => data, json: () => JSON.parse(data) }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (!body || typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch(e) { body = {}; }
  }
  if (!body) body = {};

  const { email, newEmail, newPassword, displayName } = body;

  if (!email) return res.status(400).json({ error: 'email (current) requis' });
  if (!newEmail && !newPassword && !displayName) {
    return res.status(400).json({ error: 'Rien à mettre à jour' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Variables env manquantes' });
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`
  };

  try {
    // 1. Find user by current email
    const listRes = await httpsRequest(
      `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}&per_page=100`,
      { method: 'GET', headers }
    );

    if (!listRes.ok) {
      return res.status(500).json({ error: 'Erreur recherche utilisateur: ' + listRes.text() });
    }

    const listData = listRes.json();
    const users = listData.users || [];
    const user = users.find(u => u.email === email);

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable avec cet email' });
    }

    const userId = user.id;

    // 2. Update password / email in Auth
    const authUpdate = {};
    if (newEmail) authUpdate.email = newEmail;
    if (newPassword) authUpdate.password = newPassword;

    if (Object.keys(authUpdate).length > 0) {
      const updateRes = await httpsRequest(
        `${SUPABASE_URL}/auth/v1/admin/users/${userId}`,
        { method: 'PUT', headers },
        JSON.stringify({ ...authUpdate, email_confirm: true })
      );

      if (!updateRes.ok) {
        return res.status(500).json({ error: 'Erreur mise à jour Auth: ' + updateRes.text() });
      }
    }

    // 3. Update confirmators table
    if (displayName || newEmail) {
      await httpsRequest(
        `${SUPABASE_URL}/rest/v1/confirmators?name=eq.${encodeURIComponent(email)}`,
        { method: 'PATCH', headers: { ...headers, 'Prefer': 'return=minimal' } },
        JSON.stringify({
          ...(displayName ? { display_name: displayName } : {}),
          ...(newEmail ? { name: newEmail } : {})
        })
      );
    }

    return res.status(200).json({ success: true });
  } catch(e) {
    return res.status(500).json({ error: String(e) });
  }
};
