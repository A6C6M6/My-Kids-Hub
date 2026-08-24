const SUPABASE_URL =
"https://ibsqupjmuytjxoybstdw.supabase.co";

const SUPABASE_ANON_KEY =
"sb_publishable_4wk7hLvO7ZYE5Xo2j-K1Iw_ja4Pu5RZ";

/*
 * Global Supabase client.
 * Explicit Auth settings are used for GitHub Pages OAuth.
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
