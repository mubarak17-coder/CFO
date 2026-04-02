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
      return res.json({ transactions: [] });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    // Fetch transactions from all linked banks in parallel
    const results = await Promise.allSettled(
      items.map(async (item) => {
        let attempts = 0;
        while (attempts < 5) {
          try {
            const response = await plaidClient.transactionsGet({
              access_token: item.access_token,
              start_date: startDate,
              end_date: endDate,
              options: { count: 100, offset: 0 },
            });
            return response.data.transactions.map(t => ({
              ...t,
              institution_name: item.institution_name,
            }));
          } catch (e) {
            if (e.response?.data?.error_code === 'PRODUCT_NOT_READY' && attempts < 4) {
              attempts++;
              await new Promise(r => setTimeout(r, 2000));
            } else {
              throw e;
            }
          }
        }
        return [];
      })
    );

    const transactions = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ transactions });
  } catch (error) {
    console.error('Transactions fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};
