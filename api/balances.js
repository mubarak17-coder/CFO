const { plaidClient, supabase, getUser, setCors } = require('./_shared');

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  try {
    // Fetch all linked banks for this user
    const { data: items, error: dbError } = await supabase
      .from('plaid_items')
      .select('access_token, institution_name')
      .eq('user_id', user.id);

    if (dbError) {
      console.error('Supabase query error:', dbError);
      return res.status(500).json({ error: 'Failed to fetch linked accounts' });
    }

    if (!items || items.length === 0) {
      return res.json({ accounts: [], total_balance: 0 });
    }

    // Fetch balances from all linked banks in parallel
    const results = await Promise.allSettled(
      items.map(async (item) => {
        const response = await plaidClient.accountsBalanceGet({ access_token: item.access_token });
        return response.data.accounts.map(a => ({
          ...a,
          institution_name: item.institution_name,
        }));
      })
    );

    const accounts = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);
    const total_balance = accounts.reduce((sum, a) => sum + (a.balances.current || 0), 0);

    res.json({ accounts, total_balance });
  } catch (error) {
    console.error('Balances fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch balances' });
  }
};
