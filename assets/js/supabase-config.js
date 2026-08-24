const SUPABASE_URL =
"https://ibsqupjmuytjxoybstdw.supabase.co";

const SUPABASE_ANON_KEY =
"sb_publishable_4wk7hLvO7ZYE5Xo2j-K1Iw_ja4Pu5RZ";

/*
 * Global Supabase client.
 *
 * GitHub Pages is a browser-only app, so PKCE is used for OAuth.
 * Supabase automatically detects the ?code= callback and completes
 * the code exchange when detectSessionInUrl is enabled.
 */
window.supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                flowType: "pkce"
            }
        }
    );
