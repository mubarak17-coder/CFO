const { plaidClient, supabase, getUser, checkRateLimit, setCors } = require('./_shared');

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  const ip = req.headers['x-forwarded-for'] || 'unknown';
  if (!checkRateLimit(ip, 5, 60000)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  try {
    const { public_token } = req.body;
    if (!public_token || typeof public_token !== 'string') {
      return res.status(400).json({ error: 'Invalid public_token' });
    }
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = response.data;

    // Fetch institution name for display
    let institution_name = null;
    try {
      const itemResponse = await plaidClient.itemGet({ access_token });
      const instId = itemResponse.data.item.institution_id;
      if (instId) {
        const instResponse = await plaidClient.institutionsGetById({
          institution_id: instId,
          country_codes: ['DE'],
        });
        institution_name = instResponse.data.institution.name;
      }
    } catch (_) { /* non-critical — institution name is for display only */ }

    // Upsert into plaid_items table (supports multiple banks per user)
    const { error: dbError } = await supabase
      .from('plaid_items')
      .upsert({
        user_id: user.id,
        item_id,
        access_token,
        institution_name,
      }, { onConflict: 'item_id' });

    if (dbError) {
      console.error('Supabase upsert error:', dbError);
      return res.status(500).json({ error: 'Failed to store bank connection' });
    }

    res.json({ success: true, institution_name });
  } catch (error) {
    res.status(500).json({ error: 'Failed to exchange token' });
  }
};
