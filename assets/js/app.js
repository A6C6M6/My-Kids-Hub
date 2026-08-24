// My-Kids-Hub Login + OAuth functionality

document.addEventListener("DOMContentLoaded", async () => {
    // ============================================================
    // CONFIGURATION
    // ============================================================
    const APP_ORIGIN = "https://a6c6m6.github.io/My-Kids-Hub/";

    const getAppUrl = (page = "index.html") => {
        const url = new URL(page, APP_ORIGIN);
        url.search = "";
        url.hash = "";
        return url.toString();
    };

    const supabase = window.supabaseClient;

    // ============================================================
    // PASSWORD SHOW / HIDE
    // ============================================================
    const togglePassword = document.getElementById("togglePassword");
    const password = document.getElementById("password");

    if (togglePassword && password) {
        togglePassword.addEventListener("click", () => {
            const type = password.getAttribute("type") === "password" ? "text" : "password";
            password.setAttribute("type", type);
            togglePassword.classList.toggle("fa-eye");
            togglePassword.classList.toggle("fa-eye-slash");
        });
    }

    // ============================================================
    // LOGIN ELEMENTS
    // ============================================================
    const loginForm = document.getElementById("loginForm");
    const googleLoginBtn = document.getElementById("googleLoginBtn");

    // ============================================================
    // BUTTON LOADING HELPERS
    // ============================================================
    const setOAuthButtonLoading = (button) => {
        if (!button) return () => {};

        const original = button.innerHTML;
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';

        return () => {
            button.disabled = false;
            button.removeAttribute("aria-busy");
            button.innerHTML = original;
        };
    };

    // ============================================================
    // AUTH REDIRECT
    // ============================================================
    const goToDashboard = () => {
        window.location.replace(getAppUrl("dashboard.html"));
    };

    // ============================================================
    // OAUTH CALLBACK HANDLER
    // ============================================================
    // Google/Supabase can return either:
    //   #access_token=...&refresh_token=...
    // or:
    //   ?code=...
    // Supabase normally processes these automatically.  The explicit
    // fallback below makes GitHub Pages reliable when the hash is still
    // present after the OAuth redirect.
    const handleOAuthCallback = async () => {
        if (!supabase?.auth) return false;

        const hash = window.location.hash || "";
        const search = new URLSearchParams(window.location.search);

        // ------------------------------------------------------------
        // IMPLICIT FLOW: access_token + refresh_token in URL hash
        // ------------------------------------------------------------
        if (hash.includes("access_token=")) {
            const params = new URLSearchParams(hash.replace(/^#/, ""));
            const accessToken = params.get("access_token");
            const refreshToken = params.get("refresh_token");

            if (accessToken && refreshToken) {
                try {
                    const { data, error } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken
                    });

                    if (error) throw error;

                    if (data?.session) {
                        // Remove tokens from the visible URL immediately.
                        window.history.replaceState(
                            {},
                            document.title,
                            getAppUrl("index.html")
                        );

                        goToDashboard();
                        return true;
                    }
                } catch (error) {
                    console.error("My-Kids-Hub OAuth hash session error:", error);
                    alert("Google login succeeded, but the Supabase session could not be created. Please try again.");
                    return true;
                }
            }
        }

        // ------------------------------------------------------------
        // PKCE FLOW: ?code=...
        // ------------------------------------------------------------
        const code = search.get("code");
        if (code) {
            try {
                const { data, error } = await supabase.auth.exchangeCodeForSession(code);

                if (error) throw error;

                if (data?.session) {
                    window.history.replaceState(
                        {},
                        document.title,
                        getAppUrl("index.html")
                    );
                    goToDashboard();
                    return true;
                }
            } catch (error) {
                console.error("My-Kids-Hub OAuth code exchange error:", error);
                alert(error?.message || "Google login failed. Please try again.");
                return true;
            }
        }

        return false;
    };

    // ============================================================
    // GOOGLE LOGIN
    // ============================================================
    const loginWithOAuth = async (provider, button) => {
        if (!supabase?.auth) {
            alert("Authentication service is not available. Please try again later.");
            return;
        }

        const restore = setOAuthButtonLoading(button);

        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: getAppUrl("index.html"),
                    queryParams: provider === "google"
                        ? {
                            access_type: "offline",
                            prompt: "select_account"
                        }
                        : undefined
                }
            });

            if (error) throw error;
        } catch (error) {
            console.error("My-Kids-Hub OAuth Error:", error);
            restore();

            const message = error?.message || "";

            if (/provider.*not.*enabled|unsupported.*provider/i.test(message)) {
                alert("Google sign-in is not enabled in Supabase.");
            } else if (/redirect|url configuration/i.test(message)) {
                alert("OAuth redirect URL is not configured in Supabase.");
            } else {
                alert(message || "Google login failed. Please try again.");
            }
        }
    };

    if (googleLoginBtn) {
        googleLoginBtn.addEventListener("click", () => {
            loginWithOAuth("google", googleLoginBtn);
        });
    }

    // ============================================================
    // AUTH INITIALIZATION
    // ============================================================
    if (supabase?.auth) {
        // First handle a callback already present in the current URL.
        const handledCallback = await handleOAuthCallback();
        if (handledCallback) return;

        // Listen for normal Supabase auth events.
        supabase.auth.onAuthStateChange((event, session) => {
            console.log("My-Kids-Hub Auth Event:", event);

            if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
                const hasOAuthHash = window.location.hash.includes("access_token=");
                const hasOAuthCode = new URLSearchParams(window.location.search).has("code");

                if (hasOAuthHash || hasOAuthCode) {
                    window.history.replaceState({}, document.title, getAppUrl("index.html"));
                }

                // Do not redirect if this page is already being unloaded.
                goToDashboard();
            }
        });

        // Final fallback for sessions restored from local storage.
        try {
            const { data, error } = await supabase.auth.getSession();

            if (!error && data?.session) {
                // Only redirect an already-authenticated user when there
                // is no OAuth callback waiting to be processed.
                const hasCallback =
                    window.location.hash.includes("access_token=") ||
                    window.location.hash.includes("refresh_token=") ||
                    new URLSearchParams(window.location.search).has("code");

                if (!hasCallback) {
                    goToDashboard();
                    return;
                }
            }
        } catch (error) {
            console.error("My-Kids-Hub session check error:", error);
        }
    }

    // ============================================================
    // EMAIL + PASSWORD LOGIN
    // ============================================================
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const btn = document.getElementById("loginBtn");
            const emailInput = document.getElementById("email");
            const passwordInput = document.getElementById("password");

            if (!btn || !emailInput || !passwordInput) return;

            const email = emailInput.value.trim();
            const pass = passwordInput.value;

            if (!email || !pass) {
                alert("Please fill in all fields.");
                return;
            }

            const originalContent = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            btn.disabled = true;

            try {
                if (!supabase) {
                    throw new Error("Authentication service is not available.");
                }

                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password: pass
                });

                if (error) throw error;

                if (data?.session) {
                    console.log("My-Kids-Hub: Email login successful.");
                    goToDashboard();
                    return;
                }

                throw new Error("Authentication session was not created.");
            } catch (error) {
                console.error("My-Kids-Hub Login Error:", error);
                alert(error?.message || "Invalid email or password. Please try again.");
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }
        });
    }
});
