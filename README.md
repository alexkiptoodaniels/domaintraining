# domaintraining stockease

## Features
- Manage user inventory
- Add and remove inventory items
- Filter products by name/ID or alphabetically
- Track inventory details: name, product ID, price, quantity available
- Low stock alerts
- User authentication with sign up and login

## Supabase Database Setup

Run these SQL queries in your Supabase SQL editor to create the necessary tables:

### 1. Users Table (for storing user profiles)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  phone_number VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Inventory Table (for storing products)
```sql
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  product_id VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  quantity_available INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Enable Row Level Security (RLS)
```sql
-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on inventory table
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own profile
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Policy: Users can only read their own inventory
CREATE POLICY "Users can read own inventory" ON inventory
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own inventory
CREATE POLICY "Users can insert own inventory" ON inventory
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own inventory
CREATE POLICY "Users can update own inventory" ON inventory
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own inventory
CREATE POLICY "Users can delete own inventory" ON inventory
  FOR DELETE USING (auth.uid() = user_id);
```

### 4. Create Index for Better Performance
```sql
CREATE INDEX idx_inventory_user_id ON inventory(user_id);
CREATE INDEX idx_inventory_product_name ON inventory(product_name);
```

## Notes
- Copy and paste each SQL block into your Supabase SQL Editor
- Execute them in order (tables first, then RLS policies)
- Replace placeholder values as needed

## Changelog

### June 6, 2026
**Features Added:**
- ✅ Integrated Supabase authentication (sign up & login)
- ✅ Added phone number field to sign-up form
- ✅ Store phone number in user profile during registration
- ✅ Auto-logout functionality with Logout button in navbar
- ✅ Dynamic navbar: "Login/Sign Up" converts to "Logout" when user is authenticated
- ✅ User session persistence using localStorage
- ✅ Added SQL database schema with Row Level Security (RLS)
- ✅ Database schema includes phone_number field in users table
- ✅ Created comprehensive Supabase setup guide with SQL queries

**Files Modified:**
- `auth.html` - Added phone number input field to sign-up form
- `auth.js` - Enhanced with user authentication check and dynamic navbar updates
- `README.md` - Added Supabase database setup queries and changelog