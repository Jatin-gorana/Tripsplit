const { query } = require('../db');

/**
 * Middleware enforcing that the logged-in user is a member of the target trip.
 * Attaches req.trip, req.member, and req.isAdmin.
 */
async function authorizeTripMember(req, res, next) {
  const tripId = req.params.id || req.params.tripId || req.body.trip_id;

  if (!tripId || isNaN(Number(tripId))) {
    return res.status(400).json({ error: 'Valid Trip ID is required.' });
  }

  try {
    // Fetch trip details
    const tripRes = await query('SELECT * FROM trips WHERE id = $1', [tripId]);
    if (tripRes.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found.' });
    }
    const trip = tripRes.rows[0];

    // Check member record for logged-in user
    const memberRes = await query(
      'SELECT * FROM members WHERE trip_id = $1 AND user_id = $2',
      [trip.id, req.user.id]
    );

    if (memberRes.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this trip.' });
    }

    req.trip = trip;
    req.member = memberRes.rows[0];
    req.isAdmin = Number(trip.admin_user_id) === Number(req.user.id);

    next();
  } catch (err) {
    console.error('Authorization error:', err);
    res.status(500).json({ error: 'Failed to authorize trip access.' });
  }
}

/**
 * Middleware enforcing that the logged-in user is the trip admin.
 */
function authorizeAdminOnly(req, res, next) {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Admin permission required for this action.' });
  }
  next();
}

module.exports = {
  authorizeTripMember,
  authorizeAdminOnly
};
