# Tag a Long - Supabase Backend Setup

This folder contains all the SQL migrations and configuration to set up the Tag a Long backend on Supabase.

## 🚀 Quick Setup

### 1. Create Supabase Project
1. Go to https://supabase.com
2. Sign up / Log in
3. Click "New Project"
4. Name: `tag-a-long`
5. Database Password: (save this!)
6. Region: Choose closest to you
7. Click "Create new project"

### 2. Run Database Migrations

Open the Supabase SQL Editor and run these files in order:

1. **01_create_tables.sql** - Creates all database tables
2. **02_row_level_security.sql** - Sets up security policies
3. **03_functions.sql** - Creates custom SQL functions
4. **04_storage.sql** - Sets up file storage for images

### 3. Configure Storage

In Supabase Dashboard:
1. Go to Storage
2. Create bucket: `profile-photos` (public)
3. Create bucket: `listing-photos` (public)

### 4. Get Your Credentials

From Supabase Dashboard → Settings → API:
- **Project URL**: `https://xxxxx.supabase.co`
- **anon/public key**: `eyJhbGc...` (this is safe to use in frontend)
- **service_role key**: `eyJhbGc...` (KEEP SECRET - server only)

## 📋 What You Get

### Features Included:
✅ User authentication (email/password)
✅ User profiles with photos
✅ Activity listings
✅ Tag along requests
✅ Notifications
✅ Image storage
✅ Real-time subscriptions
✅ Row Level Security (RLS)

### Automatic Features from Supabase:
- User authentication (signup/login)
- Password reset via email
- JWT token management
- API endpoints auto-generated
- Real-time data sync
- File storage with CDN
- Database backups

## 🔒 Security

All tables have Row Level Security (RLS) enabled:
- Users can only see their own email/private data
- Users can only edit their own profiles
- Users can only delete their own listings
- Request notifications only visible to recipient
- Listings visible to all users in same city

## 📝 Database Schema

### Tables:
- `profiles` - User profiles (extends Supabase auth.users)
- `listings` - Activity listings
- `tag_along_requests` - Join requests
- `notifications` - In-app notifications

### Storage Buckets:
- `profile-photos` - User profile images
- `listing-photos` - Activity listing images

## 🔌 Frontend Integration

### Install Supabase Client:
```bash
npm install @supabase/supabase-js
```

### Initialize Client:
```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xxxxx.supabase.co'
const supabaseAnonKey = 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Example Usage:
```javascript
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  options: {
    data: {
      display_name: 'Sarah',
      username: 'sarah_hikes',
      city: 'Provo'
    }
  }
})

// Get listings
const { data: listings } = await supabase
  .from('listings')
  .select('*, profiles(*)')
  .eq('city', 'Provo')
  .order('created_at', { ascending: false })

// Create listing
const { data } = await supabase
  .from('listings')
  .insert({
    caption: 'Looking for people to go ice skating!',
    time_text: 'Tonight at 8pm'
  })

// Upload image
const file = event.target.files[0]
const { data, error } = await supabase.storage
  .from('listing-photos')
  .upload(`${userId}/${Date.now()}.jpg`, file)
```

## 🎯 Advantages over Custom Backend

1. **No server to manage** - Supabase handles everything
2. **Real-time built-in** - Live updates without websockets
3. **Free tier generous** - 500MB database, 1GB storage, 2GB bandwidth
4. **Auto-scaling** - Handles traffic spikes automatically
5. **Built-in auth** - Email, OAuth, magic links, etc.
6. **Admin dashboard** - View/edit data directly
7. **Automatic backups** - Daily backups included
8. **Global CDN** - Fast image delivery worldwide

## 📚 Next Steps

1. Run all SQL migrations
2. Configure storage buckets
3. Save your credentials securely
4. Build the React Native frontend
5. Deploy and test

## 🔗 Useful Links

- Supabase Dashboard: https://app.supabase.com
- Supabase Docs: https://supabase.com/docs
- JavaScript Client Docs: https://supabase.com/docs/reference/javascript
- React Native Guide: https://supabase.com/docs/guides/getting-started/tutorials/with-react-native

---

**Ready to build!** Your backend is now serverless, scalable, and production-ready.
