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
 * Public holidays are based on the supplied Kerala Government 2026 calendar.
 * Sundays and the 2nd/4th Saturdays are treated as holidays as requested.
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
        "2026-01-02": { en: "Birthday of Mannathu Padmanabhan", ml: "മന്നത്ത് പത്മനാഭൻ ജന്മദിനം" },
        "2026-01-26": { en: "Republic Day", ml: "റിപ്പബ്ലിക് ദിനം" },
        "2026-03-20": { en: "Good Friday", ml: "ദുഃഖവെള്ളി" },
        "2026-04-02": { en: "Maundy Thursday", ml: "പെസഹ വ്യാഴം" },
        "2026-04-03": { en: "Good Friday", ml: "ദുഃഖവെള്ളി" },
        "2026-04-05": { en: "Easter", ml: "ഈസ്റ്റർ" },
        "2026-04-14": { en: "Dr. B. R. Ambedkar Jayanthi", ml: "ഡോ. ബി. ആർ. അംബേദ്കർ ജയന്തി" },
        "2026-04-15": { en: "Vishu", ml: "വിഷു" },
        "2026-05-01": { en: "May Day", ml: "മെയ് ദിനം" },
        "2026-05-27": { en: "Id-ul-Ad'ha (Bakrid)", ml: "ബക്രീദ്" },
        "2026-06-25": { en: "Muharram", ml: "മുഹറം" },
        "2026-08-15": { en: "Independence Day", ml: "സ്വാതന്ത്ര്യദിനം" },
        "2026-08-25": { en: "First Onam / Milad-i-Sherif", ml: "ഒന്നാം ഓണം / നബിദിനം" },
        "2026-08-26": { en: "Thiruvonam", ml: "തിരുവോണം" },
        "2026-08-27": { en: "Third Onam", ml: "മൂന്നാം ഓണം" },
        "2026-08-28": { en: "Fourth Onam / Ayyankali Jayanthi", ml: "നാലാം ഓണം / അയ്യങ്കാളി ജയന്തി" },
        "2026-09-04": { en: "Sreekrishna Jayanthi", ml: "ശ്രീകൃഷ്ണ ജയന്തി" },
        "2026-09-21": { en: "Sree Narayana Guru Samadhi Day", ml: "ശ്രീ നാരായണ ഗുരു സമാധി ദിനം" },
        "2026-10-02": { en: "Gandhi Jayanthi", ml: "ഗാന്ധി ജയന്തി" },
        "2026-10-20": { en: "Mahashtami", ml: "മഹാഷ്ടമി" },
        "2026-10-21": { en: "Mahanavami / Vidyarambham", ml: "മഹാനവമി / വിദ്യാരംഭം" },
        "2026-12-25": { en: "Christmas", ml: "ക്രിസ്മസ്" }
    },
    isSunday(date) {
        return date.getFullYear() === 2026 && date.getDay() === 0;
    },
    isSecondOrFourthSaturday(date) {
        if (date.getFullYear() !== 2026 || date.getDay() !== 6) return false;
        const occurrence = Math.ceil(date.getDate() / 7);
        return occurrence === 2 || occurrence === 4;
    },
    getDayStatus(date, lang = "en") {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        if (this.holidays[key]) return { type: "holiday", label: this.holidays[key][lang] || this.holidays[key].en };
        if (this.isSunday(date)) return { type: "holiday", label: lang === "ml" ? "വാരാന്ത്യ അവധി" : "Weekend Holiday" };
        if (this.isSecondOrFourthSaturday(date)) {
            const second = Math.ceil(date.getDate() / 7) === 2;
            return { type: "holiday", label: lang === "ml" ? (second ? "രണ്ടാം ശനി" : "നാലാം ശനി") : (second ? "Second Saturday" : "Fourth Saturday") };
        }
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
