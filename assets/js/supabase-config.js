const SUPABASE_URL =
"https://icdppzjhqpskmtertrbv.supabase.co";

const SUPABASE_ANON_KEY =
"sb_publishable_4wk7hLvO7ZYE5Xo2j-K1Iw_ja4Pu5RZ";

/* Create global client */

window.supabaseClient =
window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);
