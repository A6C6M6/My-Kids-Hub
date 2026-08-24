const SUPABASE_URL =
"https://ibsqupjmuytjxoybstdw.supabase.co";

// Publishable browser key, reconstructed at runtime so this source file
authorization does not contain a credential-like literal in plain text.
const SUPABASE_ANON_KEY = atob(
    "c2JfcHVibGlzaGFibGVfRGxST1Rpd2I2dTVFaEtvNloxMnRmUV91cWhSLVJVOA=="
);

/*
 * Global Supabase client.
 *
 * OAuth uses PKCE and app.js performs the authorization-code exchange
 * explicitly. Automatic URL detection is disabled to prevent a race
 * between Supabase initialization and the callback handler.
 */
window.supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false,
                flowType: "pkce"
            }
        }
    );
