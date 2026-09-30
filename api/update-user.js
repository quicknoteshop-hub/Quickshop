module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Parse body if not already parsed
  let body = req.body;
  if (!body || typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch(e) { body = {}; }
  }

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

  // 1. Find user by current email
  const listRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}&per_page=1`,
    { method: 'GET', headers }
  );

  if (!listRes.ok) {
    const err = await listRes.text();
    return res.status(500).json({ error: 'Erreur recherche utilisateur: ' + err });
  }

  const listData = await listRes.json();
  const users = listData.users || [];
  const user = users.find(u => u.email === email);

  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable avec cet email' });
  }

  const userId = user.id;

  // 2. Build update payload for Supabase Auth
  const authUpdate = {};
  if (newEmail) authUpdate.email = newEmail;
  if (newPassword) authUpdate.password = newPassword;

  if (Object.keys(authUpdate).length > 0) {
    const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ ...authUpdate, email_confirm: true })
    });

    if (!updateRes.ok) {
      const err = await updateRes.text();
      return res.status(500).json({ error: 'Erreur mise à jour Auth: ' + err });
    }
  }

  // 3. Update display_name in confirmators table if provided
  if (displayName) {
    const confKey = newEmail || email;
    // Update by old email first
    await fetch(
      `${SUPABASE_URL}/rest/v1/confirmators?name=eq.${encodeURIComponent(email)}`,
      {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ display_name: displayName, ...(newEmail ? { name: newEmail } : {}) })
      }
    );
  } else if (newEmail) {
    // If only email changed, update the name key in confirmators too
    await fetch(
      `${SUPABASE_URL}/rest/v1/confirmators?name=eq.${encodeURIComponent(email)}`,
      {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ name: newEmail })
      }