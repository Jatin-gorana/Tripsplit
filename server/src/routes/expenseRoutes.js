const express = require('express');
const { z } = require('zod');
const { query, pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { authorizeTripMember } = require('../middleware/authorization');
const { calculateSplits } = require('../utils/settle');

const router = express.Router({ mergeParams: true });

const CATEGORIES = ['Food', 'Travel', 'Stay', 'Activities', 'Shopping', 'Other'];

// Validation Schema
const expenseSchema = z.object({
  description: z.string().trim().min(1, 'Description is required'),
  amount_paise: z.number().int().positive('Amount must be a positive integer in paise'),
  category: z.enum(['Food', 'Travel', 'Stay', 'Activities', 'Shopping', 'Other']),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid expense date format (YYYY-MM-DD)'),
  paid_by_member_id: z.number().int('Valid payer member ID required'),
  split_member_ids: z.array(z.number().int()).optional()
});

router.use(authenticateToken);
router.use(authorizeTripMember);

// GET /api/trips/:id/expenses - List trip expenses
router.get('/', async (req, res) => {
  try {
    const expensesRes = await query(
      `SELECT e.*, m.name AS paid_by_name, u.name AS created_by_name
       FROM expenses e
       JOIN members m ON m.id = e.paid_by_member_id
       JOIN users u ON u.id = e.created_by_user_id
       WHERE e.trip_id = $1
       ORDER BY e.expense_date DESC, e.id DESC`,
      [req.trip.id]
    );

    const splitsRes = await query(
      `SELECT es.expense_id, es.member_id, es.share_paise, m.name AS member_name
       FROM expense_splits es
       JOIN members m ON m.id = es.member_id
       JOIN expenses e ON e.id = es.expense_id
       WHERE e.trip_id = $1`,
      [req.trip.id]
    );

    // Group splits by expense_id
    const splitsByExpense = {};
    splitsRes.rows.forEach(s => {
      if (!splitsByExpense[s.expense_id]) splitsByExpense[s.expense_id] = [];
      splitsByExpense[s.expense_id].push(s);
    });

    const expenses = expensesRes.rows.map(exp => ({
      ...exp,
      splits: splitsByExpense[exp.id] || []
    }));

    res.json(expenses);
  } catch (err) {
    console.error('Fetch expenses error:', err);
    res.status(500).json({ error: 'Failed to fetch expenses.' });
  }
});

// POST /api/trips/:id/expenses - Create new expense (SQL Transaction)
router.post('/', async (req, res) => {
  try {
    const parseResult = expenseSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors
      });
    }

    let { description, amount_paise, category, expense_date, paid_by_member_id, split_member_ids } = parseResult.data;

    // Verify paid_by_member belongs to this trip
    const payerCheck = await query('SELECT id FROM members WHERE id = $1 AND trip_id = $2', [paid_by_member_id, req.trip.id]);
    if (payerCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Payer is not a valid member of this trip.' });
    }

    // Fetch all current trip members
    const allMembers = await query('SELECT id FROM members WHERE trip_id = $1', [req.trip.id]);
    const allMemberIds = allMembers.rows.map(m => Number(m.id));

    let is_all_members = false;
    // Default to ALL trip members if split_member_ids is empty or not provided
    if (!split_member_ids || split_member_ids.length === 0) {
      split_member_ids = allMemberIds;
      is_all_members = true;
    } else if (split_member_ids.length === allMemberIds.length && split_member_ids.every(id => allMemberIds.includes(Number(id)))) {
      is_all_members = true;
    }

    // Verify all split_member_ids belong to this trip
    const splitCheck = await query(
      'SELECT id FROM members WHERE trip_id = $1 AND id = ANY($2::int[])',
      [req.trip.id, split_member_ids]
    );
    if (splitCheck.rows.length !== split_member_ids.length) {
      return res.status(400).json({ error: 'One or more split members do not belong to this trip.' });
    }

    // Calculate splits in paise
    const splits = calculateSplits(amount_paise, split_member_ids);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const expRes = await client.query(
        `INSERT INTO expenses (trip_id, description, amount_paise, category, expense_date, paid_by_member_id, created_by_user_id, is_all_members)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [req.trip.id, description, amount_paise, category, expense_date, paid_by_member_id, req.user.id, is_all_members]
      );
      const newExpense = expRes.rows[0];

      for (const s of splits) {
        await client.query(
          `INSERT INTO expense_splits (expense_id, member_id, share_paise)
           VALUES ($1, $2, $3)`,
          [newExpense.id, s.member_id, s.share_paise]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({
        ...newExpense,
        splits
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create expense error:', err);
    res.status(500).json({ error: 'Failed to create expense.' });
  }
});

// PUT /api/trips/:id/expenses/:expenseId - Edit expense (SQL Transaction)
router.put('/:expenseId', async (req, res) => {
  try {
    const expenseId = Number(req.params.expenseId);

    const expCheck = await query('SELECT * FROM expenses WHERE id = $1 AND trip_id = $2', [expenseId, req.trip.id]);
    if (expCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found.' });
    }
    const existingExp = expCheck.rows[0];

    // Authorization: Creator OR Admin can edit
    const isCreator = Number(existingExp.created_by_user_id) === Number(req.user.id);
    if (!req.isAdmin && !isCreator) {
      return res.status(403).json({ error: 'You can only edit expenses created by you or must be trip admin.' });
    }

    const parseResult = expenseSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors
      });
    }

    let { description, amount_paise, category, expense_date, paid_by_member_id, split_member_ids } = parseResult.data;

    // Fetch all current trip members
    const allMembers = await query('SELECT id FROM members WHERE trip_id = $1', [req.trip.id]);
    const allMemberIds = allMembers.rows.map(m => Number(m.id));

    let is_all_members = false;
    // Default to ALL trip members if split_member_ids is empty or not provided
    if (!split_member_ids || split_member_ids.length === 0) {
      split_member_ids = allMemberIds;
      is_all_members = true;
    } else if (split_member_ids.length === allMemberIds.length && split_member_ids.every(id => allMemberIds.includes(Number(id)))) {
      is_all_members = true;
    }

    const splits = calculateSplits(amount_paise, split_member_ids);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updatedExpRes = await client.query(
        `UPDATE expenses
         SET description = $1,
             amount_paise = $2,
             category = $3,
             expense_date = $4,
             paid_by_member_id = $5,
             is_all_members = $6
         WHERE id = $7
         RETURNING *`,
        [description, amount_paise, category, expense_date, paid_by_member_id, is_all_members, expenseId]
      );

      // Remove old splits and write new ones
      await client.query('DELETE FROM expense_splits WHERE expense_id = $1', [expenseId]);

      for (const s of splits) {
        await client.query(
          `INSERT INTO expense_splits (expense_id, member_id, share_paise)
           VALUES ($1, $2, $3)`,
          [expenseId, s.member_id, s.share_paise]
        );
      }

      await client.query('COMMIT');

      res.json({
        ...updatedExpRes.rows[0],
        splits
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update expense error:', err);
    res.status(500).json({ error: 'Failed to update expense.' });
  }
});

// DELETE /api/trips/:id/expenses/:expenseId - Delete expense
router.delete('/:expenseId', async (req, res) => {
  try {
    const expenseId = Number(req.params.expenseId);

    const expCheck = await query('SELECT * FROM expenses WHERE id = $1 AND trip_id = $2', [expenseId, req.trip.id]);
    if (expCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found.' });
    }
    const existingExp = expCheck.rows[0];

    // Authorization: Creator OR Admin can delete
    const isCreator = Number(existingExp.created_by_user_id) === Number(req.user.id);
    if (!req.isAdmin && !isCreator) {
      return res.status(403).json({ error: 'You can only delete expenses created by you or must be trip admin.' });
    }

    await query('DELETE FROM expenses WHERE id = $1', [expenseId]);

    res.json({ message: 'Expense deleted successfully.' });
  } catch (err) {
    console.error('Delete expense error:', err);
    res.status(500).json({ error: 'Failed to delete expense.' });
  }
});

module.exports = router;
