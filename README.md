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

### 3. Enable Row Level Security (RLS) - OPTIONAL
**⚠️ IMPORTANT:** Do NOT enable RLS until after users can sign up. RLS policies can block signup if not configured correctly.

If you need RLS, use these policies:
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
- ✅ Auto-logout functionality with Logout button in navbar
- ✅ Dynamic navbar: "Login" converts to "Logout" when user is authenticated
- ✅ User session persistence using localStorage
- ✅ Added SQL database schema with Row Level Security (RLS)
- ✅ Created comprehensive Supabase setup guide with SQL queries
- ✅ Split authentication into separate login.html and signup.html pages
- ✅ Updated navbar to link to separate login page
- ✅ Sign up and login now have dedicated pages instead of toggled forms

**Features Removed:**
- ❌ Removed phone number field from sign-up form
- ❌ Removed phone_number column from users table in database
- ❌ Removed database insert calls from signup logic
- ❌ Removed form toggle functionality (separate pages instead)

**Files Modified:**
- `login.html` - New page for user login
- `signup.html` - New page for user registration
- `index.html` - Updated navbar to link to login.html
- `inventory.html` - Updated navbar to link to login.html
- `auth.js` - Removed form toggle logic, updated logout redirect to login.html
- `README.md` - Updated users table schema (removed phone_number field) and changelog
# Inventory System - Fixes Applied

## Issues Fixed

### 1. ✅ Products Not Persisting to Database
**Problem:** Products added to inventory were only stored in memory, not in the Supabase database.

**Solution:** Updated `script.js` to integrate with Supabase:
- Added `loadUserAndProducts()` function that runs on page load
- Added `loadProductsFromDB()` to fetch all products from database on page load
- Updated `handleAddProduct()` to insert products into Supabase `inventory` table
- Updated `handleEditProduct()` to update products in the database
- Updated `handleDeleteProduct()` to delete products from the database

### 2. ✅ Inventory Empty on Fresh Load
**Problem:** Inventory page showed no products until you added something.

**Solution:**
- The new `loadProductsFromDB()` function automatically loads all products from the database when the page loads
- Products are now displayed immediately if they exist in the database

### 3. ✅ Login/Logout Button Toggle
**Problem:** The login button didn't change to logout after signing in.

**Solution:** Enhanced `auth.js` with improved `checkUserAndUpdateNav()` function:
- Checks if user is authenticated when page loads
- Changes "Log In" link to "Log Out" when user is logged in
- Changes back to "Log In" when user logs out
- Properly handles logout functionality

**Additional changes:**
- After signup, users are now redirected to `inventory.html` instead of `index.html`
- After login, users are redirected to `inventory.html` instead of `index.html`

## Key Implementation Details

### Database Integration in script.js

**When page loads:**
1. `DOMContentLoaded` event fires
2. `loadUserAndProducts()` is called
3. Current user is retrieved from Supabase Auth
4. If user is logged in, `loadProductsFromDB()` fetches their products
5. Table and stats are automatically updated

**When adding a product:**
1. Form validation is performed
2. Check if user is logged in
3. Insert product into `inventory` table with `user_id`
4. Add product to local array
5. Refresh table and stats

**When editing/deleting:**
1. Update/delete the record in Supabase `inventory` table
2. Update the local array
3. Refresh display

### Authentication in auth.js

**Login Flow:**
1. User enters credentials
2. Supabase authenticates user
3. User is redirected to `inventory.html`
4. `loadUserAndProducts()` loads their products
5. Navbar shows "Log Out" instead of "Log In"

**Logout Flow:**
1. User clicks "Log Out"
2. `logoutUser()` signs out from Supabase
3. LocalStorage is cleared
4. User is redirected to `login.html`
5. Navbar shows "Log In"

## Required Supabase Database Schema

Make sure you have these tables in Supabase (see README.md for full setup):

```sql
-- Inventory table
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

## Testing the Fixes

1. **Test Login/Logout:**
   - Go to Login page
   - Log in with your credentials
   - Verify navbar shows "Log Out"
   - Click "Log Out"
   - Verify navbar shows "Log In"

2. **Test Add Product:**
   - Log in
   - Click "+ Add Product"
   - Fill in details (Name, ID, Price, Stock)
   - Click "Add Product"
   - Verify product appears in table
   - Close browser and reopen
   - Verify product is still there (loaded from DB)

3. **Test Edit Product:**
   - Click "Edit" on a product
   - Change the details
   - Click "Save Changes"
   - Verify changes are saved and persist after refresh

4. **Test Delete Product:**
   - Click "Delete" on a product
   - Confirm deletion
   - Verify product is removed
   - Verify product stays removed after refresh

## Troubleshooting

**Products not saving:**
- Check browser console for errors
- Verify Supabase credentials in `auth.js`
- Ensure `inventory` table exists in Supabase
- Check that Row Level Security (RLS) isn't blocking inserts

**Login button not changing to logout:**
- Clear browser cache/localStorage
- Check browser console for errors
- Verify `checkUserAndUpdateNav()` is being called

**Products not loading on page load:**
- Ensure user is logged in
- Check Supabase connection
- Verify `loadProductsFromDB()` doesn't have errors in console
- Check that products exist in the database with correct user_id

## Files Modified

1. **script.js** - Added database integration for CRUD operations
2. **auth.js** - Enhanced login/logout button toggle and redirect to inventory