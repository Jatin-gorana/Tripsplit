const express = require('express');
const { z } = require('zod');
const { query, pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { authorizeTripMember, authorizeAdminOnly } = require('../middleware/authorization');
const { resplitTripExpenses } = require('../utils/resplitHelper');

const router = express.Router({ mergeParams: true });

// Validation Schemas
const addMemberSchema = z.object({
  name: z.string().trim().min(1, 'Member name is required')
});

const updateMemberSchema = z.object({
  name: z.string().trim().min(1, 'Member name is required')
});

router.use(authenticateToken);
router.use(authorizeTripMember);

// GET /api/trips/:id/members - List members
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT m.*, u.email
       FROM members m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.trip_id = $1
       ORDER BY m.id ASC`,
      [req.trip.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Fetch members error:', err);
    res.status(500).json({ error: 'Failed to fetch members.' });
  }
});

// POST /api/trips/:id/members - Add guest member (Admin only) + Auto Resplit
router.post('/', authorizeAdminOnly, async (req, res) => {
  try {
    const parseResult = addMemberSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors
      });
    }

    const { name } = parseResult.data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO members (trip_id, name, user_id)
         VALUES ($1, $2, NULL)
         RETURNING *`,
        [req.trip.id, name]
      );
      const newMember = result.rows[0];

      // Auto-resplit all past trip expenses across the updated list of members
      await resplitTripExpenses(client, req.trip.id);

      await client.query('COMMIT');

      res.status(201).json(newMember);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Add member error:', err);
    res.status(500).json({ error: 'Failed to add member.' });
  }
});

// PUT /api/trips/:id/members/:memberId - Rename member (Admin or self)
router.put('/:memberId', async (req, res) => {
  try {
    const memberId = Number(req.params.memberId);
    
    // Fetch target member
    const targetRes = await query('SELECT * FROM members WHERE id = $1 AND trip_id = $2', [memberId, req.trip.id]);
    if (targetRes.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found.' });
    }
    const targetMember = targetRes.rows[0];

    // Authorization check: Admin OR target member's user_id === req.user.id
    const isSelf = targetMember.user_id && Number(targetMember.user_id) === Number(req.user.id);
    if (!req.isAdmin && !isSelf) {
      return res.status(403).json({ error: 'You can only rename your own profile or must be trip admin.' });
    }

    const parseResult = updateMemberSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors
      });
    }

    const updatedRes = await query(
      `UPDATE members
       SET name = $1
       WHERE id = $2
       RETURNING *`,
      [parseResult.data.name, memberId]
    );

    res.json(updatedRes.rows[0]);
  } catch (err) {
    console.error('Update member error:', err);
    res.status(500).json({ error: 'Failed to update member.' });
  }
});

// DELETE /api/trips/:id/members/:memberId - Remove member (Admin only) + Auto Resplit remaining
router.delete('/:memberId', authorizeAdminOnly, async (req, res) => {
  try {
    const memberId = Number(req.params.memberId);
    const force = req.query.force === 'true' || req.body.force === true;

    // Fetch target member
    const targetRes = await query('SELECT * FROM members WHERE id = $1 AND trip_id = $2', [memberId, req.trip.id]);
    if (targetRes.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found.' });
    }
    const targetMember = targetRes.rows[0];

    // Cannot remove admin member
    if (targetMember.user_id && Number(targetMember.user_id) === Number(req.trip.admin_user_id)) {
      return res.status(400).json({ error: 'Cannot remove the trip admin.' });
    }

    // Check if member has associated expenses
    const expenseCheck = await query(
      `SELECT COUNT(*)::int AS cnt
       FROM expenses
       WHERE paid_by_member_id = $1
          OR id IN (SELECT expense_id FROM expense_splits WHERE member_id = $1)`,
      [memberId]
    );

    const expenseCount = expenseCheck.rows[0].cnt;

    if (expenseCount > 0 && !force) {
      return res.status(409).json({
        error: `Member has ${expenseCount} associated expense(s).`,
        requires_force: true,
        message: 'Pass force=true parameter to confirm removal of member and their expense records.'
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query('DELETE FROM members WHERE id = $1', [memberId]);

      // Resplit remaining expenses across remaining members
      await resplitTripExpenses(client, req.trip.id);

      await client.query('COMMIT');

      res.json({ message: 'Member removed successfully.' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'Failed to remove member.' });
  }
});

module.exports = router;
