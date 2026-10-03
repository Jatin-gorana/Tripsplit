-- TripSplit Database Schema

DROP TABLE IF EXISTS expense_splits CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users Table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Trips Table
CREATE TABLE trips (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  destination VARCHAR(150) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  budget_paise BIGINT NULL,
  invite_code VARCHAR(6) UNIQUE NOT NULL,
  admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Members Table (Guest members have user_id = NULL)
CREATE TABLE members (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Expenses Table
CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  description VARCHAR(255) NOT NULL,
  amount_paise BIGINT NOT NULL,
  category VARCHAR(50) NOT NULL,
  expense_date DATE NOT NULL,
  paid_by_member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_all_members BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Expense Splits Table
CREATE TABLE expense_splits (
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  share_paise BIGINT NOT NULL,
  PRIMARY KEY (expense_id, member_id)
);

-- Indexes for performance
CREATE INDEX idx_trips_admin_user_id ON trips(admin_user_id);
CREATE INDEX idx_trips_invite_code ON trips(invite_code);
CREATE INDEX idx_members_trip_id ON members(trip_id);
CREATE INDEX idx_members_user_id ON members(user_id);
CREATE INDEX idx_expenses_trip_id ON expenses(trip_id);
CREATE INDEX idx_expenses_paid_by_member_id ON expenses(paid_by_member_id);
CREATE INDEX idx_expenses_created_by_user_id ON expenses(created_by_user_id);
CREATE INDEX idx_expense_splits_member_id ON expense_splits(member_id);
