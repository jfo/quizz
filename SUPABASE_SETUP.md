# Supabase Authentication & Progress Saving Setup

This guide will walk you through setting up Supabase for authentication and cloud progress saving.

## Overview

The quiz app now supports:
- **Username/password authentication**
- **SSO (Google & GitHub)**
- **Cloud progress sync** across devices
- **Automatic migration** of existing localStorage data

## Step 1: Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Sign in or create a free account
3. Click "New Project"
4. Fill in:
   - **Name**: Quiz App (or your preferred name)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
5. Click "Create new project" (takes ~2 minutes)

## Step 2: Set Up the Database

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click "New Query"
3. Copy the entire contents of `supabase-setup.sql` and paste it into the editor
4. Click **Run** (or press Ctrl/Cmd + Enter)
5. You should see a success message showing 3 tables created:
   - `question_states`
   - `metrics`
   - `user_preferences`

## Step 3: Configure Authentication Providers

### Email/Password (Already enabled by default)

Email/password authentication is enabled by default. No additional configuration needed!

### Google OAuth (Optional but Recommended)

1. Go to **Authentication** → **Providers** in your Supabase dashboard
2. Find **Google** and click to expand
3. Toggle **Enable Sign in with Google**
4. Follow the Supabase guide to:
   - Create a Google Cloud project
   - Set up OAuth consent screen
   - Create OAuth credentials
   - Add authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
5. Paste your **Client ID** and **Client Secret** from Google
6. Click **Save**

### GitHub OAuth (Optional)

1. Go to **Authentication** → **Providers** in your Supabase dashboard
2. Find **GitHub** and click to expand
3. Toggle **Enable Sign in with GitHub**
4. Follow the Supabase guide to:
   - Go to GitHub Settings → Developer settings → OAuth Apps
   - Click "New OAuth App"
   - Fill in the form with Authorization callback URL: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Get your Client ID and Client Secret
5. Paste credentials into Supabase
6. Click **Save**

## Step 4: Configure Email Settings (Optional)

For production, you'll want to configure custom email templates:

1. Go to **Authentication** → **Email Templates**
2. Customize templates for:
   - Confirm signup
   - Magic Link
   - Change Email Address
   - Reset Password

For development, the default templates work fine!

## Step 5: Get Your Project Credentials

1. Go to **Settings** → **API** in your Supabase dashboard
2. You'll need two values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

## Step 6: Configure Your App

1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **IMPORTANT**: Add `.env` to `.gitignore` (should already be there):
   ```
   .env
   .env.local
   ```

## Step 7: Run the App

1. Install dependencies (if not already done):
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open the app in your browser
4. Click "Sign In / Sign Up" in the settings panel
5. Create an account or sign in with SSO!

## How It Works

### First Sign In
When you sign in for the first time:
1. Your existing localStorage data (progress, metrics, settings) is automatically uploaded to Supabase
2. Your progress is now saved in the cloud
3. All future changes sync automatically

### Subsequent Sign Ins
When you sign in on another device or browser:
1. Cloud data is downloaded and merged with any local data
2. Most recent progress wins (based on timestamps)
3. You can continue where you left off!

### Anonymous Usage
If you don't sign in:
- Everything works as before using localStorage
- Progress is device-specific
- No cloud sync

## Data Privacy & Security

- **Row Level Security (RLS)** ensures users can only access their own data
- All data is encrypted in transit (HTTPS)
- Supabase encrypts data at rest
- You can delete your account and all data anytime
- Export your data using the built-in import/export feature

## Troubleshooting

### "Invalid OAuth token" error
- Make sure your `.env` file has the correct credentials
- Restart your dev server after changing `.env`
- Check that you copied the **anon** key, not the service_role key

### OAuth redirect not working
- Double-check the redirect URI in your OAuth provider settings
- Make sure it matches: `https://<your-project-ref>.supabase.co/auth/v1/callback`
- Replace `<your-project-ref>` with your actual project reference

### Data not syncing
- Check browser console for errors
- Verify your database tables were created (SQL Editor → run `SELECT * FROM question_states LIMIT 1;`)
- Make sure RLS policies are enabled

### Email confirmation not arriving
- Check spam folder
- For development, check **Authentication** → **Users** to manually confirm users
- For production, configure SMTP settings in **Settings** → **Auth**

## Production Deployment

Before deploying to production:

1. **Update redirect URLs** in Supabase:
   - Go to **Authentication** → **URL Configuration**
   - Add your production domain to **Site URL**
   - Add your production domain to **Redirect URLs**

2. **Update OAuth providers**:
   - Add production redirect URIs to Google/GitHub OAuth apps
   - Use format: `https://your-domain.com/auth/callback` (handled by Supabase)

3. **Configure environment variables** in your hosting platform:
   - Add `VITE_SUPABASE_URL`
   - Add `VITE_SUPABASE_ANON_KEY`

4. **Enable email confirmations** (optional):
   - Go to **Authentication** → **Providers** → **Email**
   - Toggle "Confirm email"

## Cost & Limits

Supabase free tier includes:
- 50,000 monthly active users
- 500 MB database space
- 1 GB file storage
- 2 GB bandwidth

This is more than enough for most quiz apps! Paid plans start at $25/month for higher limits.

## Support

If you run into issues:
- Check the [Supabase documentation](https://supabase.com/docs)
- Visit the [Supabase Discord](https://discord.supabase.com)
- Review your browser console for errors

## Next Steps

Now that auth is set up, you can:
- Customize the auth UI in `src/Auth.tsx`
- Add more OAuth providers (Apple, Azure, etc.)
- Implement user profiles or avatars
- Add social features (leaderboards, shared quizzes, etc.)

Enjoy your cloud-synced quiz app! 🎉
