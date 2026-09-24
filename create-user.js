module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password, role } = req.body || {};

  if (!email || !password || !role) {
    return res.status(400).json({ error: 'email, password et role sont requis' });
  }
  if (!['confirmateur', 'stock', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Role invalide' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Variables env manquantes: SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis' });
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`
  };

  // 1. Créer le compte Auth via Supabase Admin API
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password, email_confirm: true })
  });

  const authData = await authRes.json();

  if (!authRes.ok) {
    return res.status(400).json({ error: authData.message || authData.msg || JSON.stringify(authData) });
  }

  const userId = authData.id;

  // 2. Insérer dans user_roles
  const roleRes = await fetch(`${SUPABASE_URL}/rest/v1/user_roles`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ id: userId, role })
  });

  if (!roleRes.ok) {
    const roleErr = await roleRes.text();
    // Rollback : supprimer le compte Auth
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers });
    return res.status(500).json({ error: 'Erreur user_roles: ' + roleErr });
  }

  return res.status(200).json({ success: true, user: { id: userId, email, role } });
};
