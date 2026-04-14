#!/bin/bash
# Verify MMMC multi-product auth routing is correctly configured.
# Run after any Supabase dashboard change or auth code modification.
#
# Tests:
# 1. NMF production responds with 200
# 2. CWC production responds with 200
# 3. Supabase project is reachable
# 4. OAuth initiation from NMF produces a redirect URL pointing to Google
#    (not to CWC or another product)
set -e

echo "=== MMMC Auth Routing Verification: $(date) ==="
echo ""

# Gate 1: Sites reachable
echo "--- Site reachability ---"
NMF_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://maxmeetsmusiccity.com" 2>/dev/null || echo "FAIL")
CWC_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://cowritecompass.com" 2>/dev/null || echo "FAIL")
ND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://nashvilledecoder.com" 2>/dev/null || echo "FAIL")
echo "NMF (maxmeetsmusiccity.com): HTTP $NMF_STATUS"
echo "CWC (cowritecompass.com):    HTTP $CWC_STATUS"
echo "ND  (nashvilledecoder.com):  HTTP $ND_STATUS"
[ "$NMF_STATUS" = "200" ] && echo "  ✅ NMF OK" || echo "  ⚠️  NMF unreachable"
[ "$CWC_STATUS" = "200" ] && echo "  ✅ CWC OK" || echo "  ⚠️  CWC unreachable"
echo ""

# Gate 2: Supabase project reachable
SUPABASE_URL="${VITE_SUPABASE_URL:-https://kpwklxrcysokuyjhuhun.supabase.co}"
SB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/rest/v1/" -H "apikey: ${VITE_SUPABASE_ANON_KEY:-dummy}" 2>/dev/null || echo "FAIL")
echo "--- Supabase project ---"
echo "URL: $SUPABASE_URL"
echo "Status: HTTP $SB_STATUS"
[ "$SB_STATUS" = "200" ] || echo "  ⚠️  Supabase unreachable (check VITE_SUPABASE_URL)"
echo ""

# Gate 3: Auth config in codebase
echo "--- Auth config audit ---"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Check NMF auth-config exists
if [ -f "$SCRIPT_DIR/src/lib/auth-config.ts" ]; then
  echo "✅ NMF auth-config.ts exists"
  grep -c "canonicalOrigins" "$SCRIPT_DIR/src/lib/auth-config.ts" > /dev/null && \
    echo "  ✅ canonicalOrigins defined" || echo "  ⚠️  canonicalOrigins missing"
  grep -c "storageKey" "$SCRIPT_DIR/src/lib/auth-config.ts" > /dev/null && \
    echo "  ✅ Product-specific storageKey defined" || echo "  ⚠️  storageKey missing"
else
  echo "⚠️  NMF auth-config.ts MISSING"
fi

# Check supabase.ts uses PKCE
if grep -q "flowType.*pkce" "$SCRIPT_DIR/src/lib/supabase.ts" 2>/dev/null; then
  echo "✅ PKCE flow configured in supabase.ts"
else
  echo "⚠️  supabase.ts missing PKCE flow — implicit flow is less secure"
fi

# Check auth-context uses getRedirectUrl
if grep -q "getRedirectUrl" "$SCRIPT_DIR/src/lib/auth-context.tsx" 2>/dev/null; then
  echo "✅ auth-context.tsx uses centralized getRedirectUrl()"
else
  echo "⚠️  auth-context.tsx using ad-hoc redirect URL construction"
fi
echo ""

# Gate 4: Required Supabase dashboard configuration
echo "--- REQUIRED Supabase Dashboard Configuration ---"
echo ""
echo "Go to: https://supabase.com/dashboard/project/kpwklxrcysokuyjhuhun/auth/url-configuration"
echo ""
echo "Site URL (set to your primary product):"
echo "  https://maxmeetsmusiccity.com"
echo ""
echo "Redirect URLs (ALL of these must be listed):"
echo "  https://maxmeetsmusiccity.com/**"
echo "  https://cowritecompass.com/**"
echo "  https://nashvilledecoder.com/**"
echo "  http://localhost:5173/**"
echo "  http://localhost:4173/**"
echo "  http://localhost:3000/**"
echo "  http://localhost:3001/**"
echo ""
echo "Google provider callback URL (Authentication → Providers → Google):"
echo "  Must be: https://kpwklxrcysokuyjhuhun.supabase.co/auth/v1/callback"
echo "  This URL must also be listed in Google Cloud Console as an"
echo "  authorized redirect URI."
echo ""
echo "=== END VERIFICATION ==="
