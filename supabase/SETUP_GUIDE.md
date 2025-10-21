# Tag a Long - Supabase Setup Guide

Complete step-by-step guide to set up your Supabase backend.

## 📋 Prerequisites

- Supabase account (free at https://supabase.com)
- Web browser

---

## 🚀 Step 1: Create Supabase Project (5 minutes)

1. Go to https://app.supabase.com
2. Click **"New project"**
3. Fill in details:
   - **Organization**: Select or create one
   - **Name**: `tag-a-long`
   - **Database Password**: Create a strong password (SAVE THIS!)
   - **Region**: Choose closest to your users (e.g., US West)
   - **Pricing Plan**: Free
4. Click **"Create new project"**
5. Wait 2-3 minutes for project to initialize

---

## 🗄️ Step 2: Run Database Migrations (10 minutes)

### 2.1 Open SQL Editor
1. In Supabase Dashboard, click **"SQL Editor"** in left sidebar
2. Click **"New query"**

### 2.2 Run Migration 01 - Create Tables
1. Copy entire contents of `migrations/01_create_tables.sql`
2. Paste into SQL Editor
3. Click **"Run"** button
4. You should see: ✅ "Success. No rows returned"
5. Check for notice: "Tables created successfully!"

### 2.3 Run Migration 02 - Row Level Security
1. Create a new query (click **"+"** tab)
2. Copy entire contents of `migrations/02_row_level_security.sql`
3. Paste and click **"Run"**
4. Verify: "Row Level Security policies created successfully!"

### 2.4 Run Migration 03 - Functions
1. Create a new query
2. Copy entire contents of `migrations/03_functions.sql`
3. Paste and click **"Run"**
4. Verify: "Functions and views created successfully!"

### 2.5 Run Migration 04 - Storage (Policies Only)
1. Create a new query
2. Copy entire contents of `migrations/04_storage.sql`
3. Paste and click **"Run"**
4. Note: You'll see instructions for creating buckets

---

## 📦 Step 3: Create Storage Buckets (5 minutes)

### 3.1 Create profile-photos Bucket
1. Click **"Storage"** in left sidebar
2. Click **"New bucket"**
3. Configure:
   - **Name**: `profile-photos`
   - **Public bucket**: ✅ YES
   - **File size limit**: 5 MB
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp`
4. Click **"Create bucket"**

### 3.2 Create listing-photos Bucket
1. Click **"New bucket"** again
2. Configure:
   - **Name**: `listing-photos`
   - **Public bucket**: ✅ YES
   - **File size limit**: 10 MB
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp`
3. Click **"Create bucket"**

---

## 🔑 Step 4: Get Your Credentials (2 minutes)

1. Click **"Project Settings"** (gear icon in left sidebar)
2. Click **"API"** in settings menu
3. Copy these values:

```
Project URL: https://xxxxxxxxxxxxx.supabase.co
anon/public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**⚠️ IMPORTANT:**
- The `anon` key is SAFE to use in frontend apps (React Native, web)
- Keep the `service_role` key SECRET - only use on backend if needed

---

## ✅ Step 5: Verify Setup (3 minutes)

### 5.1 Check Tables
1. Click **"Table Editor"** in left sidebar
2. You should see tables:
   - ✅ profiles
   - ✅ listings
   - ✅ tag_along_requests
   - ✅ notifications

### 5.2 Check Storage
1. Click **"Storage"**
2. You should see buckets:
   - ✅ profile-photos
   - ✅ listing-photos

### 5.3 Check Authentication
1. Click **"Authentication"** in left sidebar
2. You should see the Auth settings page (no users yet)

---

## 🧪 Step 6: Test with Sample Data (Optional)

### Create Test User
1. Go to **"Authentication"** → **"Users"**
2. Click **"Add user"** → **"Create new user"**
3. Enter:
   - **Email**: `test@example.com`
   - **Password**: `Test1234!`
   - **Confirm Password**: `Test1234!`
4. Click **"Create user"**

### Add Profile Data
1. Go to **"Table Editor"** → **"profiles"**
2. Click **"Insert row"**
3. Fill in:
   - **id**: (copy from auth.users table)
   - **email**: `test@example.com`
   - **username**: `testuser`
   - **display_name**: `Test User`
   - **city**: `Provo`
   - **date_of_birth**: `2000-01-01`
4. Click **"Save"**

---

## 🔗 Step 7: Connect Frontend

### Install Supabase Client
```bash
npm install @supabase/supabase-js
```

### Create Supabase Client File

**File**: `src/lib/supabase.js`

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'YOUR_PROJECT_URL'  // From Step 4
const supabaseAnonKey = 'YOUR_ANON_KEY'  // From Step 4

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Test Connection

```javascript
import { supabase } from './lib/supabase'

// Test query
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .limit(10)

console.log('Profiles:', data)
```

---

## 🎯 Common Operations

### Sign Up User
```javascript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'securePassword123',
  options: {
    data: {
      username: 'cooluser',
      display_name: 'Cool User',
      city: 'Provo',
      date_of_birth: '1995-05-15',
      bio: 'Love hiking!'
    }
  }
})
```

### Login User
```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'securePassword123'
})
```

### Get Feed
```javascript
const { data: feed } = await supabase
  .rpc('get_user_feed', {
    user_city: 'Provo',
    page_limit: 50,
    page_offset: 0
  })
```

### Create Listing
```javascript
// 1. Upload photo first
const file = /* your file */
const fileName = `${userId}/${Date.now()}.jpg`

const { data: uploadData, error: uploadError } = await supabase.storage
  .from('listing-photos')
  .upload(fileName, file)

// 2. Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('listing-photos')
  .getPublicUrl(fileName)

// 3. Create listing
const { data, error } = await supabase
  .from('listings')
  .insert({
    photo_url: publicUrl,
    caption: 'Looking for people to go ice skating!',
    time_text: 'Tonight at 8pm'
  })
  .select()
  .single()
```

### Send Tag Along Request
```javascript
const { data, error } = await supabase
  .from('tag_along_requests')
  .insert({
    listing_id: 'listing-uuid-here',
    requester_id: supabase.auth.user().id
  })
```

### Accept Request
```javascript
const { data, error } = await supabase
  .rpc('accept_request', {
    request_id: 'request-uuid-here'
  })
```

### Get Notifications
```javascript
const { data: notifications } = await supabase
  .from('notifications')
  .select('*')
  .order('created_at', { ascending: false })
```

### Real-time Subscriptions
```javascript
// Subscribe to new notifications
const channel = supabase
  .channel('notifications')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    },
    (payload) => {
      console.log('New notification:', payload.new)
    }
  )
  .subscribe()
```

---

## 🐛 Troubleshooting

### "relation does not exist" error
- Make sure you ran all migrations in order
- Check SQL Editor for any error messages

### "permission denied" error
- Verify Row Level Security policies were created
- Check that you're authenticated when making requests

### Storage upload fails
- Verify buckets are created and set to public
- Check file size is within limits (5MB for profiles, 10MB for listings)
- Ensure file type is allowed (jpg, png, webp)

### Authentication not working
- Double-check your `supabaseUrl` and `supabaseAnonKey`
- Make sure you're using the `anon` key, not `service_role`

---

## 📊 Monitor Your Backend

### View Logs
1. Go to **"Logs"** in Supabase Dashboard
2. Filter by:
   - API requests
   - Database queries
   - Storage operations

### Check Database Size
1. Go to **"Settings"** → **"Usage"**
2. See:
   - Database size
   - Storage used
   - Bandwidth used

### View Active Users
1. Go to **"Authentication"** → **"Users"**
2. See all registered users
3. Can manually verify emails or delete users

---

## 🎉 You're Done!

Your Supabase backend is now fully set up and ready to use!

### What You Have:
✅ PostgreSQL database with all tables
✅ Row Level Security for data protection
✅ Authentication system
✅ File storage for images
✅ Custom functions for complex operations
✅ Real-time subscriptions (optional)
✅ Auto-generated REST API

### Next Steps:
1. Build the React Native frontend
2. Test all features end-to-end
3. Deploy your app
4. Monitor usage in Supabase Dashboard

---

**Need help?** Check the Supabase docs at https://supabase.com/docs
