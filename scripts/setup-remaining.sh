#!/bin/bash
# === Manual Setup Steps for Security Hardening ===
# Run this after adding SUPABASE_SERVICE_ROLE_KEY to Vercel.
#
# STEP 1: Get your service role key from Supabase Dashboard:
#   Dashboard → Settings → API → service_role key (NOT anon key)
#
# STEP 2: Add it to Vercel:
#   echo "<your-service-role-key>" | npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
#
# STEP 3: Run the RLS migration:
#   Copy contents of supabase-migration-rls-tighten.sql
#   Paste into Supabase Dashboard → SQL Editor → New query → Run
#
# STEP 4: Set yourself as admin:
#   Run in Supabase SQL Editor:
#   UPDATE user_profiles SET user_role = 'admin' WHERE id = '<your-user-id>';
#
#   To find your user ID:
#   SELECT id, email FROM auth.users WHERE email = 'maxmeetsmusiccity@gmail.com';
#
# STEP 5: Redeploy to pick up new env vars:
#   npx vercel --prod
#
# STEP 6: Verify:
#   - Visit https://maxmeetsmusiccity.com/newmusicfriday
#   - Confirm Nashville releases load (scan-artists now requires auth)
#   - Confirm admin features work (Push to Playlist visible when signed in)
#   - Check cron: Vercel Dashboard → Crons tab → verify next scheduled run
echo "Read the steps above. This script is documentation, not automation."
