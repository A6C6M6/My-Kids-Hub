// My-Kids-Hub Dashboard authentication + profile binding.
// This page must work independently from index.html on GitHub Pages.

(async () => {
    "use strict";

    const SUPABASE_URL = "https://ibsqupjmuytjxoybstdw.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_4wk7hLvO7ZYE5Xo2j-K1Iw_ja4Pu5RZ";

    // dashboard.html historically did not load supabase-config.js.
    // Initialize the Supabase browser client here as a safe fallback so
    // navigation to dashboard.html never immediately sends the user back
    // to index.html just because window.supabaseClient is missing.
    const loadSupabaseLibrary = () => new Promise((resolve, reject) => {
        if (window.supabase) {
            resolve();
            return;
        }

        const existing = document.querySelector('script[data-mykidshub-supabase]');
        if (existing) {
            existing.addEventListener("load", resolve, { once: true });
            existing.addEventListener("error", reject, { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        script.async = false;
        script.dataset.mykidshubSupabase = "true";
        script.onload = resolve;
        script.onerror = () => reject(new Error("Supabase library could not be loaded."));
        document.head.appendChild(script);
    });

    const ensureSupabaseClient = async () => {
        if (window.supabaseClient?.auth) return window.supabaseClient;

        await loadSupabaseLibrary();

        if (!window.supabase?.createClient) {
            throw new Error("Supabase client library is unavailable.");
        }

        window.supabaseClient = window.supabase.createClient(
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

        return window.supabaseClient;
    };

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const getValidSession = async (client, timeoutMs = 10000) => {
        const started = Date.now();

        while (Date.now() - started < timeoutMs) {
            try {
                const { data, error } = await client.auth.getSession();
                if (!error && data?.session) return data.session;
            } catch (error) {
                console.warn("My-Kids-Hub dashboard session retry:", error);
            }

            await sleep(250);
        }

        return null;
    };

    const redirectToLogin = () => {
        // Prevent an endless redirect loop while preserving GitHub Pages path.
        if (!window.location.pathname.endsWith("/dashboard.html")) return;
        window.location.replace("index.html");
    };

    const initializeDashboardAuth = async () => {
        let client;

        try {
            client = await ensureSupabaseClient();

            // First allow Supabase Auth to finish restoring the persisted
            // session from localStorage, then read the session.
            const session = await getValidSession(client, 10000);

            if (!session?.user) {
                console.warn("My-Kids-Hub dashboard: no authenticated session found.");
                redirectToLogin();
                return;
            }

            const user = session.user;
            const email = user.email || "User";
            const displayName =
                user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                email;
            const initials = displayName.trim().slice(0, 2).toUpperCase();

            document.querySelectorAll(".user-info strong, .profile-text strong").forEach(el => {
                el.textContent = displayName;
            });

            document.querySelectorAll(".avatar").forEach(el => {
                el.textContent = initials;
            });

            const subtitle = document.querySelector(".topbar-left p");
            if (subtitle) {
                subtitle.textContent = `Welcome back, ${displayName}! Here's what's happening today.`;
            }

            document.querySelectorAll(".logout-btn").forEach(btn => {
                btn.addEventListener("click", async (event) => {
                    event.preventDefault();
                    try {
                        await client.auth.signOut();
                    } finally {
                        window.location.replace("index.html");
                    }
                });
            });
        } catch (error) {
            console.error("My-Kids-Hub dashboard authentication failed:", error);
            alert("Unable to restore your login session. Please sign in again.");
            redirectToLogin();
        }
    };

    // Run auth initialization after the DOM exists.
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeDashboardAuth, { once: true });
    } else {
        initializeDashboardAuth();
    }
})();

// Sidebar toggle (mobile)
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
}

// ============ Payment Overview Line Chart ============
const paymentCtx = document.getElementById('paymentChart');
if (paymentCtx && window.Chart) {
    const gradient = paymentCtx.getContext('2d').createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, 'rgba(31, 111, 214, 0.28)');
    gradient.addColorStop(1, 'rgba(31, 111, 214, 0)');

    new Chart(paymentCtx, {
        type: 'line',
        data: {
            labels: ['May 1', 'May 8', 'May 15', 'May 22', 'May 29'],
            datasets: [{
                label: 'Amount Paid',
                data: [2000, 4200, 18500, 9000, 6500],
                borderColor: '#1f6fd6',
                backgroundColor: gradient,
                borderWidth: 2.5,
                pointBackgroundColor: '#1f6fd6',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 20000,
                    ticks: {
                        stepSize: 5000,
                        callback: (v) => v === 0 ? '0' : (v / 1000) + 'K',
                        color: '#7a8494',
                        font: { size: 11 }
                    },
                    grid: { color: '#f0f2f7' }
                },
                x: {
                    ticks: { color: '#7a8494', font: { size: 11 } },
                    grid: { display: false }
                }
            }
        }
    });
}

// ============ Fee Summary Donut Chart ============
const donutCtx = document.getElementById('feeDonut');
if (donutCtx && window.Chart) {
    new Chart(donutCtx, {
        type: 'doughnut',
        data: {
            labels: ['Tuition Fee', 'Transport Fee', 'Books & Others', 'Other Fee'],
            datasets: [{
                data: [40, 25, 20, 15],
                backgroundColor: ['#1f6fd6', '#24a866', '#f2a91d', '#8b6cf2'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: { legend: { display: false } }
        }
    });
}

// ============ Quick action feedback (demo only) ============
document.querySelectorAll('.qa-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        btn.style.transform = 'scale(0.96)';
        setTimeout(() => { btn.style.transform = ''; }, 120);
    });
});
