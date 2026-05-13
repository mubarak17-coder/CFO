const { supabase, getUser, setCors } = require('./_shared');

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  try {
    await supabase.from('plaid_items').delete().eq('user_id', user.id);

    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) {
      console.error('Delete user error:', error);
      return res.status(500).json({ error: 'Failed to delete account' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};
