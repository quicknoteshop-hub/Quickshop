const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({ error: 'userId est requis' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Variables d\'environnement manquantes' });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Supprimer de user_roles
  await supabase.from('user_roles').delete().eq('id', userId);

  // 2. Supprimer le compte Auth
  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
};
