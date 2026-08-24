const SUPABASE_URL =
"https://ibsqupjmuytjxoybstdw.supabase.co";

const SUPABASE_ANON_KEY =
"sb_publishable_4wk7hLvO7ZYE5Xo2j-K1Iw_ja4Pu5RZ";

/*
 * Global Supabase client.
 *
 * Explicit auth settings are important for GitHub Pages OAuth:
 * - persistSession keeps the login across page navigation.
 * - autoRefreshToken refreshes the session automatically.
 * - detectSessionInUrl lets Supabase process the OAuth callback.
 * - flowType "implicit" matches the #access_token callback used
 *   by the current Google OAuth flow.
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
                flowType: "implicit"
            }
        }
    );
