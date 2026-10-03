const bcrypt = require('bcryptjs');
const { pool } = require('./index');

async function seedDb() {
  console.log('Seeding demo data...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Clean existing data
    await client.query('TRUNCATE users, trips, members, expenses, expense_splits RESTART IDENTITY CASCADE;');

    // 1. Create Demo User
    const passwordHash = await bcrypt.hash('password123', 10);
    const userRes = await client.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      ['Demo User', 'demo@tripsplit.app', passwordHash]
    );
    const demoUser = userRes.rows[0];

    // 2. Create Demo Trip
    const tripRes = await client.query(
      `INSERT INTO trips (name, destination, start_date, end_date, budget_paise, invite_code, admin_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, invite_code`,
      ['Goa Beach Vacation', 'Goa, India', '2026-10-10', '2026-10-15', 5000000, 'GOA123', demoUser.id] // ₹50,000 budget
    );
    const trip = tripRes.rows[0];

    // 3. Create Members
    // Member 1: Demo User (linked)
    const m1 = (await client.query(
      `INSERT INTO members (trip_id, name, user_id) VALUES ($1, $2, $3) RETURNING id`,
      [trip.id, demoUser.name, demoUser.id]
    )).rows[0];

    // Member 2: Rahul (guest)
    const m2 = (await client.query(
      `INSERT INTO members (trip_id, name, user_id) VALUES ($1, $2, NULL) RETURNING id`,
      [trip.id, 'Rahul']
    )).rows[0];

    // Member 3: Priya (guest)
    const m3 = (await client.query(
      `INSERT INTO members (trip_id, name, user_id) VALUES ($1, $2, NULL) RETURNING id`,
      [trip.id, 'Priya']
    )).rows[0];

    // Member 4: Ankit (guest)
    const m4 = (await client.query(
      `INSERT INTO members (trip_id, name, user_id) VALUES ($1, $2, NULL) RETURNING id`,
      [trip.id, 'Ankit']
    )).rows[0];

    const allMemberIds = [m1.id, m2.id, m3.id, m4.id];

    // Helper to insert expense with splits
    const insertExpense = async (description, amountPaise, category, date, paidByMemberId, memberIds) => {
      const expRes = await client.query(
        `INSERT INTO expenses (trip_id, description, amount_paise, category, expense_date, paid_by_member_id, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [trip.id, description, amountPaise, category, date, paidByMemberId, demoUser.id]
      );
      const expenseId = expRes.rows[0].id;

      const n = memberIds.length;
      const baseShare = Math.floor(amountPaise / n);
      const remainder = amountPaise % n;

      for (let i = 0; i < n; i++) {
        const share = baseShare + (i < remainder ? 1 : 0);
        await client.query(
          `INSERT INTO expense_splits (expense_id, member_id, share_paise) VALUES ($1, $2, $3)`,
          [expenseId, memberIds[i], share]
        );
      }
    };

    // 4. Create ~8 sample expenses
    await insertExpense('Villa Booking (2 nights)', 1600000, 'Stay', '2026-10-10', m1.id, allMemberIds); // ₹16,000 by Demo User
    await insertExpense('Airport Cab to Resort', 240000, 'Travel', '2026-10-10', m2.id, allMemberIds); // ₹2,400 by Rahul
    await insertExpense('Seafood Dinner at Brittos', 480000, 'Food', '2026-10-10', m3.id, allMemberIds); // ₹4,800 by Priya
    await insertExpense('Scuba Diving & Water Sports', 800000, 'Activities', '2026-10-11', m4.id, allMemberIds); // ₹8,000 by Ankit
    await insertExpense('Scooter Rental (4 Days)', 320000, 'Travel', '2026-10-11', m1.id, allMemberIds); // ₹3,200 by Demo User
    await insertExpense('Beach Shack Snacks & Cocktails', 185000, 'Food', '2026-10-12', m2.id, [m1.id, m2.id, m3.id]); // ₹1,850 split 3 ways
    await insertExpense('Souvenir Shopping & Spices', 120000, 'Shopping', '2026-10-12', m3.id, allMemberIds); // ₹1,200 by Priya
    await insertExpense('Sunset Cruise Tickets', 200000, 'Activities', '2026-10-13', m1.id, allMemberIds); // ₹2,000 by Demo User

    await client.query('COMMIT');

    console.log('Seed completed successfully!');
    console.log('-----------------------------------------');
    console.log('Demo Login Email:    demo@tripsplit.app');
    console.log('Demo Login Password: password123');
    console.log(`Demo Trip Code:      ${trip.invite_code}`);
    console.log('-----------------------------------------');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDb();
