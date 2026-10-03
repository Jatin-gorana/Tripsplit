const { calculateSplits } = require('./settle');

/**
 * Recalculates splits for trip expenses when a member joins or leaves.
 * - Expenses with is_all_members = true (or null) are automatically re-split across ALL current trip members.
 * - Expenses with is_all_members = false preserve their selective members (removing any deleted member).
 * 
 * @param {Object} client - pg client or pool
 * @param {number} tripId - Target trip ID
 * @param {boolean} forceAll - If true, forces all expenses to re-split across all current trip members
 */
async function resplitTripExpenses(client, tripId, forceAll = false) {
  // 1. Fetch current list of all member IDs for this trip
  const membersRes = await client.query('SELECT id FROM members WHERE trip_id = $1 ORDER BY id ASC', [tripId]);
  const currentMemberIds = membersRes.rows.map(m => Number(m.id));

  if (currentMemberIds.length === 0) return;

  // 2. Fetch all expenses for this trip
  const expensesRes = await client.query(
    'SELECT id, amount_paise, COALESCE(is_all_members, TRUE) AS is_all_members FROM expenses WHERE trip_id = $1',
    [tripId]
  );

  // 3. For each expense, update splits
  for (const exp of expensesRes.rows) {
    let targetMemberIds = [];

    if (forceAll || exp.is_all_members) {
      targetMemberIds = currentMemberIds;
    } else {
      // Get existing split member IDs for selective expense
      const existingSplitsRes = await client.query(
        'SELECT member_id FROM expense_splits WHERE expense_id = $1',
        [exp.id]
      );
      const existingIds = existingSplitsRes.rows.map(s => Number(s.member_id));
      // Keep only members that still exist in the trip
      targetMemberIds = existingIds.filter(id => currentMemberIds.includes(id));

      // Fallback: If all selected members were removed, split among current members
      if (targetMemberIds.length === 0) {
        targetMemberIds = currentMemberIds;
      }
    }

    const newSplits = calculateSplits(exp.amount_paise, targetMemberIds);

    // Delete old splits
    await client.query('DELETE FROM expense_splits WHERE expense_id = $1', [exp.id]);

    // Insert updated splits
    for (const s of newSplits) {
      await client.query(
        'INSERT INTO expense_splits (expense_id, member_id, share_paise) VALUES ($1, $2, $3)',
        [exp.id, s.member_id, s.share_paise]
      );
    }
  }
}

module.exports = { resplitTripExpenses };
