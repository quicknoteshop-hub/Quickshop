export default async function handler(req, res) {
  try {
    const url = 'https://txlcppqnpoqnyjskevbh.supabase.co/rest/v1/app_settings?select=id&limit=1';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bGNwcHFucG9xbnlqc2tldmJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2MDQzNTgsImV4cCI6MjEwMzE4MDM1OH0.pFCdNJXkUI981atVJJqavXo4EcMZu9XMOVAL-mkZ58Q';
    const r = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      }
    });
    res.status(200).json({ status: r.status, ok: r.ok, ts: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
