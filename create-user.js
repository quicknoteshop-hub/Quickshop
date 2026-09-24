const { createClient } = require('@supabase/supabase-js');

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

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Variables d\'environnement manquantes (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Créer le compte Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  const userId = authData.user.id;

  // 2. Insérer dans user_roles
  const { error: roleError } = await supabase
    .from('user_roles')
    .insert({ id: userId, role });

  if (roleError) {
    // Rollback : supprimer le compte Auth créé
    await supabase.auth.admin.deleteUser(userId);
    return res.status(500).json({ error: 'Erreur assignation du rôle: ' + roleError.message });
  }

  return res.status(200).json({ success: true, user: { id: userId, email, role } });
};
