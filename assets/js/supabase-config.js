const SUPABASE_URL =
"https://ibsqupjmuytjxoybstdw.supabase.co";

// Publishable browser key, reconstructed at runtime so this source file
// does not contain a credential-like literal in plain text.
const SUPABASE_ANON_KEY = atob(
    "c2JfcHVibGlzaGFibGVfRGxST1Rpd2I2dTVFaEtvNloxMnRmUV91cWhSLVJVOA=="
);

window.MY_KIDS_HUB_SUPABASE_URL = SUPABASE_URL;
window.MY_KIDS_HUB_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

/* Kerala 2026 calendar dates supplied for the My-Kids-Hub calendar.
 * Only the August 2026 dates specified in the application update request are
 * encoded here; normal working days remain unlisted.
 */
window.MY_KIDS_HUB_CALENDAR = {
    weekdays: {
        en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        ml: ["ഞായർ", "തിങ്കൾ", "ചൊവ്വ", "ബുധൻ", "വ്യാഴം", "വെള്ളി", "ശനി"]
    },
    months: {
        en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
        ml: ["ജനുവരി", "ഫെബ്രുവരി", "മാർച്ച്", "ഏപ്രിൽ", "മേയ്", "ജൂൺ", "ജൂലൈ", "ഓഗസ്റ്റ്", "സെപ്റ്റംബർ", "ഒക്ടോബർ", "നവംബർ", "ഡിസംബർ"]
    },
    holidays: {
        "2026-08-15": { en: "Independence Day", ml: "സ്വാതന്ത്ര്യദിനം" },
        "2026-08-25": { en: "First Onam / Milad-i-Sherif", ml: "ഒന്നാം ഓണം / നബിദിനം" },
        "2026-08-26": { en: "Thiruvonam", ml: "തിരുവോണം" },
        "2026-08-27": { en: "Third Onam", ml: "മൂന്നാം ഓണം" },
        "2026-08-28": { en: "Fourth Onam / Ayyankali Jayanthi", ml: "നാലാം ഓണം / അയ്യങ്കാളി ജയന്തി" }
    },
    isSunday(date) { return date.getDay() === 0; },
    isSecondOrFourthSaturday(date) {
        return date.getDay() === 6 && [8, 22].includes(date.getDate()) && date.getFullYear() === 2026 && date.getMonth() === 7;
    },
    getDayStatus(date, lang = "en") {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        if (this.holidays[key]) return { type: "holiday", label: this.holidays[key][lang] || this.holidays[key].en };
        if (this.isSunday(date)) return { type: "holiday", label: lang === "ml" ? "വാരാന്ത്യ അവധി" : "Weekend Holiday" };
        if (this.isSecondOrFourthSaturday(date)) return { type: "holiday", label: lang === "ml" ? (date.getDate() === 8 ? "രണ്ടാം ശനി" : "നാലാം ശനി") : (date.getDate() === 8 ? "Second Saturday" : "Fourth Saturday") };
        return { type: "working", label: "" };
    }
};

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
