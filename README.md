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

### 1. Sequential Login ID Support

Users sign up with a real email (as before) and also get a short generated ID (e.g. `001`). At login, they can use **any of**: email, phone number, or login ID.

Supabase Auth itself only ever signs in by real email under the hood — there's no native "sign in by arbitrary ID" support. So when someone logs in with a phone number or login ID, the app first resolves it to the account's real email (via the `get_login_email()` function below), then signs in normally with that email.

Run this SQL to create the sequence and function that generates login IDs atomically (so two signups can never collide):

```sql
-- Sequence for generating sequential login IDs
CREATE SEQUENCE IF NOT EXISTS login_id_seq START 1;

-- Function to atomically get the next login ID, zero-padded to 3 digits
-- (e.g. 1 -> "001", 42 -> "042"; beyond 999 it naturally becomes 4 digits)
CREATE OR REPLACE FUNCTION generate_login_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_id INT;
BEGIN
  next_id := nextval('login_id_seq');
  RETURN LPAD(next_id::TEXT, 3, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_login_id() TO anon, authenticated;
```

### 2. Login Lookup Table & Resolver Function

A small lookup table maps phone number and login ID back to the account's real email — this is what makes "log in with phone or ID" possible. It's intentionally minimal (not a full profile table): just the fields needed to resolve an identifier.

```sql
CREATE TABLE IF NOT EXISTS login_lookup (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone_number VARCHAR(20) NOT NULL UNIQUE,
  login_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE login_lookup ENABLE ROW LEVEL SECURITY;

-- Open insert policy: signup calls this right after auth.signUp(), which may
-- not yet have an active session if "Confirm email" is enabled in your
-- Supabase project (no session exists until the user clicks the confirmation
-- link). Restricting this to auth.uid() = id would break signup in that case.
-- The row still can't be spoofed usefully: id must reference a real
-- auth.users row (FK), and email/phone/login_id are all UNIQUE.
CREATE POLICY "Anyone can insert a lookup row" ON login_lookup
  FOR INSERT WITH CHECK (true);

-- Needed so the profile page can show the user's own phone number
CREATE POLICY "Users can read own lookup row" ON login_lookup
  FOR SELECT USING (auth.uid() = id);

-- Needed so the profile page can save phone/email edits
CREATE POLICY "Users can update own lookup row" ON login_lookup
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
```

The resolver function is `SECURITY DEFINER`, so it can read the table server-side without needing a public SELECT policy (which would otherwise let anyone enumerate phone numbers / emails by querying the table directly):

```sql
CREATE OR REPLACE FUNCTION get_login_email(identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  found_email TEXT;
BEGIN
  SELECT email INTO found_email
  FROM login_lookup
  WHERE phone_number = identifier OR login_id = identifier
  LIMIT 1;

  RETURN found_email;
END;
$$;

GRANT EXECUTE ON FUNCTION get_login_email(TEXT) TO anon, authenticated;
```

**If you already ran the earlier `phone_reservations` table SQL from before this change**, drop it — it's replaced by `login_lookup`:
```sql
DROP TABLE IF EXISTS phone_reservations;
```

### 3. Inventory Table (for storing products)
```sql
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  product_id VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  quantity_available INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 4. Enable Row Level Security (RLS) - OPTIONAL
**⚠️ IMPORTANT:** Do NOT enable RLS until after users can sign up. RLS policies can block signup if not configured correctly.

If you need RLS, use these policies:
```sql
-- Enable RLS on inventory table
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

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

### 5. Create Index for Better Performance
```sql
CREATE INDEX idx_inventory_user_id ON inventory(user_id);
CREATE INDEX idx_inventory_product_name ON inventory(product_name);
```

## Notes
- Copy and paste each SQL block into your Supabase SQL Editor
- Execute them in order (tables first, then RLS policies)
- Replace placeholder values as needed

## Changelog

### July 21, 2026 (later) — Editable profile + fixed invisible error messages
**Bug fix:** `showError()` set the error text but never added the `.show` CSS class that actually makes `.error-message` visible (it's `display: none` by default). This meant error/success messages on login, signup, and elsewhere have never actually been appearing on screen. Fixed by having `showError`/new `showSuccess`/`clearMessage` helpers manage the `.show` class consistently everywhere.

**Features Added:**
- ✅ Profile page now shows Phone Number too (previously only Login ID, Name, Email)
- ✅ Name, Email, and Phone are now editable via an "Edit Profile" / "Save" / "Cancel" flow; Login ID stays locked (not editable)
- ✅ Editing checks for duplicates: a changed email is checked by Supabase Auth itself (the real account identity); a changed phone number is checked against `login_lookup`'s UNIQUE constraint. Both produce a specific "already registered" message rather than a generic error.

**Known limitation:** since a phone/login-ID login is resolved through `login_lookup.email` (not the live auth email), changing your email updates that lookup value immediately — but the *actual* Supabase sign-in email doesn't change until you click the confirmation link. In that window, logging in by phone or ID will resolve to the new (unconfirmed) email, which won't yet work for `signInWithPassword`. This resolves itself once the email change is confirmed; logging in with the old email still works in the meantime.

**Files Modified:**
- `profile.html` - Added Phone field, Edit/Save/Cancel buttons
- `auth.js` - Added `showSuccess`/`clearMessage` helpers, fixed `showError`, added phone fetch + full edit/save logic to `loadProfile`
- `README.md` - Added SELECT/UPDATE RLS policies on `login_lookup` needed for the profile page

### July 21, 2026 — Specific duplicate-account messages + profile page
**Features Added:**
- ✅ New `profile.html` page showing the logged-in user's Login ID, Full Name, and Email (pulled from existing signup data — no extra query needed)
- ✅ Profile link added to the navbar, shown only when logged in; the page itself also redirects to `login.html` if visited without a session
- ✅ Sign up now gives a specific error depending on what's already registered: "This email is already registered", "This phone number is already registered", etc., instead of one generic message

**Known limitation (pre-existing, now more visible):** because Supabase creates the auth account (tied to the real email) *before* we can check phone-number uniqueness, a signup that fails at the phone-uniqueness step still leaves an unconfirmed `auth.users` row behind. If a user then retries with the same email, they'll see "This email is already registered" even though their first attempt never fully completed. If this happens during testing, delete the stray unconfirmed user in **Authentication → Users** in the Supabase dashboard, then retry.

**Files Modified:**
- `profile.html` - New page
- `index.html`, `inventory.html` - Added Profile nav link
- `auth.js` - Added `loadProfile()`, nav toggle for Profile link, and specific duplicate-account error messages
- `auth.css` - Styling for read-only profile fields

### July 20, 2026 (later still) — Login with email, phone, OR login ID
**Design change:** Brought real email back (it's needed as the actual Supabase Auth identity again) and added a lookup layer so login accepts any of the three identifiers.

**Features Added:**
- ✅ Sign up collects name, email, phone, and password again; a sequential login ID (e.g. `001`) is still generated automatically
- ✅ The actual Supabase Auth account uses the **real email** this time — no more synthetic `@stockease.local` address, so Supabase's normal email confirmation works as intended if you have it enabled
- ✅ A `login_lookup` table maps phone number and login ID to the account's email
- ✅ Login accepts email, phone, or login ID in a single field — non-email input is resolved to the real email via the `get_login_email()` DB function before signing in
- ✅ Error messages for a failed lookup don't reveal whether the account exists

**Dashboard setting is now optional, not required:** since the real email is used for auth, you can leave "Confirm email" on or off depending on whether you want email verification — either works. Leaving it off gives the smoothest experience (user is logged in immediately after signup); leaving it on means they must click the confirmation link before their first login.

**Files Modified:**
- `login.html` - Single field now accepts email, phone, or login ID
- `signup.html` - Email field restored alongside name, phone, password (unchanged from two changes ago)
- `auth.js` - Signup now creates the account with the real email and writes a `login_lookup` row; login detects `@` to decide whether to sign in directly or resolve via `get_login_email()` first
- `README.md` - Replaced `phone_reservations` with `login_lookup` + `get_login_email()`, fixed its RLS insert policy, updated changelog

### July 20, 2026 (earlier) — Sequential Login ID with synthetic email (superseded above)
**Design change:** Replaced the `users` profile table approach (below) with a table-free design, per updated requirements.

**Features Added:**
- ✅ Users now log in with a short sequential ID (e.g. `001`) instead of email
- ✅ Login ID generated atomically via a Postgres `SEQUENCE` + `generate_login_id()` function — no profile table needed
- ✅ Phone number uniqueness now enforced via a minimal `phone_reservations` table (just a primary key column) instead of a full profile table
- ✅ Real email field removed from sign up entirely; a synthetic, never-emailed address (`<id>@stockease.local`) is used internally to satisfy Supabase Auth's requirement for an email

**Files Modified:**
- `login.html` - Email field replaced with a "Login ID" field
- `signup.html` - Real email field removed (kept name, phone, password)
- `auth.js` - Rewrote signup/login to generate and use login IDs and synthetic emails; phone uniqueness now checked against `phone_reservations`
- `README.md` - Replaced `users` table schema with sequence/function + `phone_reservations`, updated RLS section, updated inventory table's foreign key to reference `auth.users` directly

### July 20, 2026 — Added phone number to sign up (superseded above)
**Features Added:**
- ✅ Phone number field on sign up, required and enforced unique
- ✅ `phone_number` column added to `users` table with a UNIQUE constraint
- ✅ Sign up now writes a profile row to `users` (id, email, full_name, phone_number) after the auth account is created
- ✅ Duplicate phone numbers are rejected with a clear error message (relies on the DB unique constraint rather than a pre-check, so it stays correct even if RLS is enabled later)
- ✅ Added `users` INSERT policy so the profile row can be saved under RLS

**Files Modified:**
- `signup.html` - Added phone number input to the sign up form
- `auth.js` - Added phone validation, included phone in signup metadata, insert profile row with duplicate handling
- `README.md` - Updated schema and RLS policies, changelog entry

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
