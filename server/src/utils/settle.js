/**
 * Core mathematical and settlement logic for TripSplit.
 * All monetary values are stored as integers in paise (₹1 = 100 paise).
 */

/**
 * Calculates equal splits for an expense among selected members,
 * distributing remaining paise fairly to the first R members.
 * 
 * @param {number} amountPaise - Total expense amount in paise
 * @param {Array<number>} memberIds - List of member IDs involved in the split
 * @returns {Array<{member_id: number, share_paise: number}>}
 */
function calculateSplits(amountPaise, memberIds) {
  if (!memberIds || memberIds.length === 0) {
    throw new Error('Splits must involve at least one member.');
  }

  const total = Math.round(Number(amountPaise));
  const n = memberIds.length;
  const baseShare = Math.floor(total / n);
  const remainder = total % n;

  return memberIds.map((memberId, index) => ({
    member_id: memberId,
    share_paise: baseShare + (index < remainder ? 1 : 0)
  }));
}

/**
 * Calculates dashboard statistics for a trip.
 * 
 * @param {Array<{id: number, name: string}>} members 
 * @param {Array<Object>} expenses 
 * @param {Array<Object>} splits 
 * @returns {Object} Dashboard summary
 */
function calculateDashboard(members, expenses, splits = []) {
  const memberStats = {};
  members.forEach(m => {
    memberStats[m.id] = {
      id: m.id,
      name: m.name,
      paid_paise: 0,
      share_paise: 0,
      balance_paise: 0
    };
  });

  let totalSpentPaise = 0;
  const categoryTotals = {};

  // Process expenses (paid amounts & category totals)
  expenses.forEach(exp => {
    const amt = Number(exp.amount_paise);
    totalSpentPaise += amt;

    const cat = exp.category || 'Other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;

    if (memberStats[exp.paid_by_member_id]) {
      memberStats[exp.paid_by_member_id].paid_paise += amt;
    }
  });

  // Process splits (share amounts)
  splits.forEach(s => {
    if (memberStats[s.member_id]) {
      memberStats[s.member_id].share_paise += Number(s.share_paise);
    }
  });

  // Calculate balances and find "next to pay"
  let lowestBalance = Infinity;
  let nextToPayMember = null;

  const memberList = Object.values(memberStats).map(m => {
    m.balance_paise = m.paid_paise - m.share_paise;
    
    if (m.balance_paise < lowestBalance) {
      lowestBalance = m.balance_paise;
      nextToPayMember = { id: m.id, name: m.name, balance_paise: m.balance_paise };
    }
    return m;
  });

  // Sort members by balance ascending (lowest balance/most indebted first)
  memberList.sort((a, b) => a.balance_paise - b.balance_paise);

  return {
    total_spent_paise: totalSpentPaise,
    member_stats: memberList,
    next_to_pay: nextToPayMember,
    category_totals: categoryTotals
  };
}

/**
 * Calculates minimum cash flow transfers to settle up all balances greedily.
 * 
 * @param {Array<{id: number, name: string}>} members 
 * @param {Array<Object>} expenses 
 * @param {Array<Object>} splits 
 * @returns {Array<{from_member_id: number, from_name: string, to_member_id: number, to_name: string, amount_paise: number}>}
 */
function calculateSettlements(members, expenses, splits = []) {
  const dash = calculateDashboard(members, expenses, splits);
  
  // Separate into debtors (balance < 0) and creditors (balance > 0)
  const debtors = [];
  const creditors = [];

  dash.member_stats.forEach(m => {
    if (m.balance_paise < 0) {
      debtors.push({ id: m.id, name: m.name, amount: -m.balance_paise });
    } else if (m.balance_paise > 0) {
      creditors.push({ id: m.id, name: m.name, amount: m.balance_paise });
    }
  });

  // Sort debtors and creditors descending by amount
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let i = 0; // debtor index
  let j = 0; // creditor index

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const settledAmount = Math.min(debtor.amount, creditor.amount);

    if (settledAmount > 0) {
      transfers.push({
        from_member_id: debtor.id,
        from_name: debtor.name,
        to_member_id: creditor.id,
        to_name: creditor.name,
        amount_paise: settledAmount
      });

      debtor.amount -= settledAmount;
      creditor.amount -= settledAmount;
    }

    if (debtor.amount === 0) i++;
    if (creditor.amount === 0) j++;
  }

  return transfers;
}

module.exports = {
  calculateSplits,
  calculateDashboard,
  calculateSettlements
};
