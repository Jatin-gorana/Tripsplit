const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const { query, pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { authorizeTripMember, authorizeAdminOnly } = require('../middleware/authorization');
const { calculateDashboard, calculateSettlements } = require('../utils/settle');
const { resplitTripExpenses } = require('../utils/resplitHelper');

const router = express.Router();

// Helper to generate a 6-character uppercase alphanumeric code
function generateInviteCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// Validation Schemas
const createTripSchema = z.object({
  name: z.string().trim().min(1, 'Trip name is required'),
  destination: z.string().trim().min(1, 'Destination is required'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid start date format (YYYY-MM-DD)'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid end date format (YYYY-MM-DD)'),
  budget_paise: z.number().int().nonnegative().nullable().optional()
});

const updateTripSchema = createTripSchema.partial();

const joinTripSchema = z.object({
  invite_code: z.string().trim().length(6, 'Invite code must be 6 characters'),
  action: z.enum(['claim', 'new']),
  member_id: z.number().int().optional()
});

// All trip routes require authentication
router.use(authenticateToken);

// GET /api/trips - List user's trips
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT t.*, 
              (SELECT COUNT(*) FROM members WHERE trip_id = t.id)::int AS member_count,
              (SELECT COALESCE(SUM(amount_paise), 0) FROM expenses WHERE trip_id = t.id)::bigint AS total_spent_paise
       FROM trips t
       INNER JOIN members m ON m.trip_id = t.id
       WHERE m.user_id = $1
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Fetch trips error:', err);
    res.status(500).json({ error: 'Failed to fetch trips.' });
  }
});

// POST /api/trips - Create new trip
router.post('/', async (req, res) => {
  try {
    const parseResult = createTripSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors
      });
    }

    const { name, destination, start_date, end_date, budget_paise } = parseResult.data;

    // Generate unique 6-char invite code
    let invite_code = generateInviteCode();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      const codeCheck = await query('SELECT id FROM trips WHERE invite_code = $1', [invite_code]);
      if (codeCheck.rows.length === 0) {
        isUnique = true;
      } else {
        invite_code = generateInviteCode();
        attempts++;
      }
    }

    // Start SQL transaction to create trip and admin member
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const tripRes = await client.query(
        `INSERT INTO trips (name, destination, start_date, end_date, budget_paise, invite_code, admin_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [name, destination, start_date, end_date, budget_paise || null, invite_code, req.user.id]
      );
      const trip = tripRes.rows[0];

      // Add creator as member
      const memberRes = await client.query(
        `INSERT INTO members (trip_id, name, user_id)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [trip.id, req.user.name, req.user.id]
      );

      await client.query('COMMIT');

      res.status(201).json({
        trip,
        member: memberRes.rows[0]
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create trip error:', err);
    res.status(500).json({ error: 'Failed to create trip.' });
  }
});

// GET /api/trips/invite/:code - Preview trip info for invite link
router.get('/invite/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const tripRes = await query(
      `SELECT t.id, t.name, t.destination, t.start_date, t.end_date, t.invite_code, u.name AS admin_name
       FROM trips t
       JOIN users u ON u.id = t.admin_user_id
       WHERE t.invite_code = $1`,
      [code]
    );

    if (tripRes.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired invite code.' });
    }

    const trip = tripRes.rows[0];

    // Check if user is already a member
    const existingMember = await query(
      'SELECT id, name FROM members WHERE trip_id = $1 AND user_id = $2',
      [trip.id, req.user.id]
    );

    // Get unlinked guest members for claiming
    const unlinkedGuests = await query(
      'SELECT id, name FROM members WHERE trip_id = $1 AND user_id IS NULL ORDER BY name ASC',
      [trip.id]
    );

    res.json({
      trip,
      is_already_member: existingMember.rows.length > 0,
      current_member: existingMember.rows[0] || null,
      unlinked_guests: unlinkedGuests.rows
    });
  } catch (err) {
    console.error('Invite lookup error:', err);
    res.status(500).json({ error: 'Failed to lookup invite code.' });
  }
});

// POST /api/trips/join - Join trip via invite code + Auto Resplit
router.post('/join', async (req, res) => {
  try {
    const parseResult = joinTripSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors
      });
    }

    const { invite_code, action, member_id } = parseResult.data;
    const code = invite_code.toUpperCase();

    const tripRes = await query('SELECT * FROM trips WHERE invite_code = $1', [code]);
    if (tripRes.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid invite code.' });
    }
    const trip = tripRes.rows[0];

    // Check existing membership
    const existing = await query(
      'SELECT * FROM members WHERE trip_id = $1 AND user_id = $2',
      [trip.id, req.user.id]
    );
    if (existing.rows.length > 0) {
      return res.json({ message: 'Already a member of this trip.', trip, member: existing.rows[0] });
    }

    const client = await pool.connect();
    let joinedMember;

    try {
      await client.query('BEGIN');

      if (action === 'claim') {
        if (!member_id) {
          return res.status(400).json({ error: 'member_id is required to claim a guest profile.' });
        }

        // Claim an unlinked guest member
        const guestRes = await client.query(
          'SELECT * FROM members WHERE id = $1 AND trip_id = $2 AND user_id IS NULL',
          [member_id, trip.id]
        );

        if (guestRes.rows.length === 0) {
          return res.status(400).json({ error: 'Target guest member is invalid or already claimed.' });
        }

        const updateRes = await client.query(
          `UPDATE members
           SET user_id = $1
           WHERE id = $2
           RETURNING *`,
          [req.user.id, member_id]
        );
        joinedMember = updateRes.rows[0];
      } else {
        // Create new member profile
        const insertRes = await client.query(
          `INSERT INTO members (trip_id, name, user_id)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [trip.id, req.user.name, req.user.id]
        );
        joinedMember = insertRes.rows[0];
      }

      // Auto-resplit all past trip expenses across the updated member list
      await resplitTripExpenses(client, trip.id);

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Successfully joined trip!',
        trip,
        member: joinedMember
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Join trip error:', err);
    res.status(500).json({ error: 'Failed to join trip.' });
  }
});

// GET /api/trips/:id - Trip details
router.get('/:id', authorizeTripMember, async (req, res) => {
  res.json({
    trip: req.trip,
    is_admin: req.isAdmin,
    current_member: req.member
  });
});

// PUT /api/trips/:id - Edit trip (Admin only)
router.put('/:id', authorizeTripMember, authorizeAdminOnly, async (req, res) => {
  try {
    const parseResult = updateTripSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors
      });
    }

    const { name, destination, start_date, end_date, budget_paise } = parseResult.data;

    const updatedRes = await query(
      `UPDATE trips
       SET name = COALESCE($1, name),
           destination = COALESCE($2, destination),
           start_date = COALESCE($3, start_date),
           end_date = COALESCE($4, end_date),
           budget_paise = CASE WHEN $5::boolean THEN $6 ELSE budget_paise END
       WHERE id = $7
       RETURNING *`,
      [
        name,
        destination,
        start_date,
        end_date,
        budget_paise !== undefined,
        budget_paise,
        req.trip.id
      ]
    );

    res.json(updatedRes.rows[0]);
  } catch (err) {
    console.error('Update trip error:', err);
    res.status(500).json({ error: 'Failed to update trip.' });
  }
});

// DELETE /api/trips/:id - Delete trip (Admin only)
router.delete('/:id', authorizeTripMember, authorizeAdminOnly, async (req, res) => {
  try {
    await query('DELETE FROM trips WHERE id = $1', [req.trip.id]);
    res.json({ message: 'Trip deleted successfully.' });
  } catch (err) {
    console.error('Delete trip error:', err);
    res.status(500).json({ error: 'Failed to delete trip.' });
  }
});

// POST /api/trips/:id/resplit - Manual 1-click expense rebalancing across all current members
router.post('/:id/resplit', authorizeTripMember, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await resplitTripExpenses(client, req.trip.id);
      await client.query('COMMIT');
      res.json({ message: 'All trip expenses successfully re-balanced across current members.' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Manual resplit error:', err);
    res.status(500).json({ error: 'Failed to re-split trip expenses.' });
  }
});

// GET /api/trips/:id/dashboard - Complete dashboard data
router.get('/:id/dashboard', authorizeTripMember, async (req, res) => {
  try {
    const tripId = req.trip.id;

    // Fetch members
    const membersRes = await query(
      `SELECT m.id, m.name, m.user_id, m.created_at, u.email
       FROM members m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.trip_id = $1
       ORDER BY m.id ASC`,
      [tripId]
    );

    // Fetch expenses
    const expensesRes = await query(
      `SELECT e.*, m.name AS paid_by_name
       FROM expenses e
       JOIN members m ON m.id = e.paid_by_member_id
       WHERE e.trip_id = $1
       ORDER BY e.expense_date DESC, e.id DESC`,
      [tripId]
    );

    // Fetch splits
    const splitsRes = await query(
      `SELECT es.*
       FROM expense_splits es
       JOIN expenses e ON e.id = es.expense_id
       WHERE e.trip_id = $1`,
      [tripId]
    );

    const dashboard = calculateDashboard(membersRes.rows, expensesRes.rows, splitsRes.rows);

    const budgetPaise = req.trip.budget_paise ? Number(req.trip.budget_paise) : null;
    const budgetRemainingPaise = budgetPaise !== null ? Math.max(0, budgetPaise - dashboard.total_spent_paise) : null;

    res.json({
      trip: req.trip,
      is_admin: req.isAdmin,
      current_member: req.member,
      total_spent_paise: dashboard.total_spent_paise,
      budget_paise: budgetPaise,
      budget_remaining_paise: budgetRemainingPaise,
      next_to_pay: dashboard.next_to_pay,
      member_stats: dashboard.member_stats,
      category_totals: dashboard.category_totals
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to generate dashboard data.' });
  }
});

// GET /api/trips/:id/settle - Minimum cash flow transfers
router.get('/:id/settle', authorizeTripMember, async (req, res) => {
  try {
    const tripId = req.trip.id;

    const membersRes = await query('SELECT id, name FROM members WHERE trip_id = $1', [tripId]);
    const expensesRes = await query('SELECT * FROM expenses WHERE trip_id = $1', [tripId]);
    const splitsRes = await query(
      `SELECT es.* FROM expense_splits es
       JOIN expenses e ON e.id = es.expense_id
       WHERE e.trip_id = $1`,
      [tripId]
    );

    const transfers = calculateSettlements(membersRes.rows, expensesRes.rows, splitsRes.rows);

    res.json({
      trip_id: tripId,
      transfers
    });
  } catch (err) {
    console.error('Settle-up calculation error:', err);
    res.status(500).json({ error: 'Failed to calculate settlements.' });
  }
});

// POST /api/trips/:id/resplit - Manual re-split of trip expenses (Admin only)
router.post('/:id/resplit', authorizeTripMember, authorizeAdminOnly, async (req, res) => {
  try {
    const forceAll = req.body.force_all === true || req.query.force_all === 'true';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await resplitTripExpenses(client, req.trip.id, forceAll);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ message: 'Expenses successfully recalculated across trip members.' });
  } catch (err) {
    console.error('Manual resplit error:', err);
    res.status(500).json({ error: 'Failed to recalculate trip expenses.' });
  }
});

module.exports = router;
