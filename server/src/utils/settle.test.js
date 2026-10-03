const { test, describe } = require('node:test');
const assert = require('node:assert');
const { calculateSplits, calculateDashboard, calculateSettlements } = require('./settle.js');

describe('TripSplit Math & Settlement Core Logic', () => {

  test('calculateSplits divides total evenly and handles remainder paise correctly', () => {
    // 1000 paise (₹10.00) split among 3 members: 334, 333, 333
    const splits = calculateSplits(1000, [1, 2, 3]);
    assert.strictEqual(splits.length, 3);
    assert.strictEqual(splits[0].share_paise, 334);
    assert.strictEqual(splits[1].share_paise, 333);
    assert.strictEqual(splits[2].share_paise, 333);

    const totalSplit = splits.reduce((sum, s) => sum + s.share_paise, 0);
    assert.strictEqual(totalSplit, 1000);
  });

  test('calculateSplits handles exact division', () => {
    // 1200 paise split among 3 members: 400 each
    const splits = calculateSplits(1200, [10, 20, 30]);
    assert.strictEqual(splits[0].share_paise, 400);
    assert.strictEqual(splits[1].share_paise, 400);
    assert.strictEqual(splits[2].share_paise, 400);
  });

  test('calculateDashboard aggregates total spent, per-member balances, and next to pay', () => {
    const members = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' }
    ];

    const expenses = [
      { id: 101, amount_paise: 3000, category: 'Food', paid_by_member_id: 1 }
    ];

    const splits = [
      { expense_id: 101, member_id: 1, share_paise: 1000 },
      { expense_id: 101, member_id: 2, share_paise: 1000 },
      { expense_id: 101, member_id: 3, share_paise: 1000 }
    ];

    const result = calculateDashboard(members, expenses, splits);

    assert.strictEqual(result.total_spent_paise, 3000);
    assert.strictEqual(result.category_totals.Food, 3000);

    const alice = result.member_stats.find(m => m.id === 1);
    const bob = result.member_stats.find(m => m.id === 2);
    const charlie = result.member_stats.find(m => m.id === 3);

    assert.strictEqual(alice.paid_paise, 3000);
    assert.strictEqual(alice.share_paise, 1000);
    assert.strictEqual(alice.balance_paise, 2000); // Alice is owed ₹20

    assert.strictEqual(bob.balance_paise, -1000); // Bob owes ₹10
    assert.strictEqual(charlie.balance_paise, -1000); // Charlie owes ₹10

    // Next to pay should be Bob or Charlie (lowest balance of -1000)
    assert.strictEqual(result.next_to_pay.balance_paise, -1000);
  });

  test('calculateSettlements generates minimum transfers using greedy algorithm', () => {
    const members = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' }
    ];

    // Alice paid ₹300 for dinner split 3 ways (₹100 each)
    const expenses = [
      { id: 1, amount_paise: 30000, category: 'Food', paid_by_member_id: 1 }
    ];
    const splits = [
      { expense_id: 1, member_id: 1, share_paise: 10000 },
      { expense_id: 1, member_id: 2, share_paise: 10000 },
      { expense_id: 1, member_id: 3, share_paise: 10000 }
    ];

    const transfers = calculateSettlements(members, expenses, splits);

    assert.strictEqual(transfers.length, 2);
    
    // Both Bob and Charlie pay Alice 10000 paise (₹100) each
    const bobTransfer = transfers.find(t => t.from_member_id === 2);
    assert.strictEqual(bobTransfer.to_member_id, 1);
    assert.strictEqual(bobTransfer.amount_paise, 10000);

    const charlieTransfer = transfers.find(t => t.from_member_id === 3);
    assert.strictEqual(charlieTransfer.to_member_id, 1);
    assert.strictEqual(charlieTransfer.amount_paise, 10000);
  });

  test('recalculating splits when 3rd member joins distributes 2-person expense equally among all 3', () => {
    // Initial state: ₹1,000 paid by Member 1 for 2 members
    const initialSplits = calculateSplits(100000, [1, 2]); // ₹500.00 each
    assert.strictEqual(initialSplits.length, 2);
    assert.strictEqual(initialSplits[0].share_paise, 50000);
    assert.strictEqual(initialSplits[1].share_paise, 50000);

    // 3rd member joins -> re-calculate split among 3 members: Member 1, Member 2, Member 3
    const updatedSplits = calculateSplits(100000, [1, 2, 3]);
    assert.strictEqual(updatedSplits.length, 3);
    assert.strictEqual(updatedSplits[0].share_paise, 33334);
    assert.strictEqual(updatedSplits[1].share_paise, 33333);
    assert.strictEqual(updatedSplits[2].share_paise, 33333);

    const totalResplit = updatedSplits.reduce((sum, s) => sum + s.share_paise, 0);
    assert.strictEqual(totalResplit, 100000);
  });
});
