// My-Kids-Hub Login + OAuth functionality
// GitHub Pages + Supabase Auth

document.addEventListener("DOMContentLoaded", async () => {
    "use strict";

    const APP_ORIGIN = "https://a6c6m6.github.io/My-Kids-Hub/";
    const supabase = window.supabaseClient;

    const loginForm = document.getElementById("loginForm");
    const googleLoginBtn = document.getElementById("googleLoginBtn");
    const togglePassword = document.getElementById("togglePassword");
    const password = document.getElementById("password");

    let redirecting = false;

    const getAppUrl = (page = "index.html") => {
        const url = new URL(page, APP_ORIGIN);
        url.search = "";
        url.hash = "";
        return url.toString();
    };

    const goToDashboard = () => {
        if (redirecting) return;
        redirecting = true;
        window.location.replace(getAppUrl("dashboard.html"));
    };

    const cleanOAuthUrl = () => {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.search = "";
        cleanUrl.hash = "";
        window.history.replaceState({}, document.title, cleanUrl.toString());
    };

    const getOAuthCallback = () => {
        const search = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));

        return {
            code: search.get("code"),
            accessToken: hash.get("access_token"),
            refreshToken: hash.get("refresh_token"),
            error: search.get("error") || hash.get("error"),
            errorDescription:
                search.get("error_description") || hash.get("error_description")
        };
    };

    const hasOAuthCallback = () => {
        const callback = getOAuthCallback();
        return Boolean(
            callback.code ||
            callback.accessToken ||
            callback.refreshToken ||
            callback.error
        );
    };

    if (togglePassword && password) {
        togglePassword.addEventListener("click", () => {
            const isPassword = password.type === "password";
            password.type = isPassword ? "text" : "password";
            togglePassword.classList.toggle("fa-eye", !isPassword);
            togglePassword.classList.toggle("fa-eye-slash", isPassword);
        });
    }

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

    // Explicit PKCE callback exchange. This prevents the previous race where
    // automatic URL detection completed (or failed) before app.js could read
    // the returned authorization code.
    const handleOAuthCallback = async () => {
        if (!supabase?.auth) return false;

        const callback = getOAuthCallback();

        if (callback.error) {
            console.error("My-Kids-Hub OAuth callback error:", callback.error, callback.errorDescription);
            cleanOAuthUrl();
            alert(callback.errorDescription || callback.error || "Google login was cancelled.");
            return true;
        }

        if (callback.code) {
            try {
                console.log("My-Kids-Hub: exchanging Google OAuth code for Supabase session...");

                const { data, error } = await supabase.auth.exchangeCodeForSession(callback.code);
                if (error) throw error;

                if (data?.session?.user) {
                    console.log("My-Kids-Hub: Google OAuth session created successfully.");
                    cleanOAuthUrl();
                    goToDashboard();
                    return true;
                }

                const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
                if (!sessionError && sessionData?.session?.user) {
                    cleanOAuthUrl();
                    goToDashboard();
                    return true;
                }

                throw new Error("Supabase returned no authenticated session after OAuth code exchange.");
            } catch (error) {
                console.error("My-Kids-Hub OAuth code exchange error:", error);
                cleanOAuthUrl();
                alert(error?.message || "Google login completed, but the Supabase session could not be created. Please try again.");
                return true;
            }
        }

        // Legacy implicit-flow support for old #access_token callbacks.
        if (callback.accessToken && callback.refreshToken) {
            try {
                const { data, error } = await supabase.auth.setSession({
                    access_token: callback.accessToken,
                    refresh_token: callback.refreshToken
                });
                if (error) throw error;
                if (data?.session?.user) {
                    cleanOAuthUrl();
                    goToDashboard();
                    return true;
                }
                throw new Error("Supabase returned no authenticated session.");
            } catch (error) {
                console.error("My-Kids-Hub legacy OAuth session error:", error);
                cleanOAuthUrl();
                alert(error?.message || "Google login failed while creating the session.");
                return true;
            }
        }

        return false;
    };

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
                    queryParams:
                        provider === "google"
                            ? { access_type: "offline", prompt: "select_account" }
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
            } else if (/redirect|url configuration|redirect_to/i.test(message)) {
                alert("OAuth redirect URL is not configured correctly in Supabase.");
            } else {
                alert(message || "Google login failed. Please try again.");
            }
        }
    };

    if (googleLoginBtn) {
        googleLoginBtn.addEventListener("click", () => loginWithOAuth("google", googleLoginBtn));
    }

    if (supabase?.auth) {
        if (hasOAuthCallback()) {
            const handled = await handleOAuthCallback();
            if (handled) return;
        }

        try {
            const { data, error } = await supabase.auth.getSession();
            if (!error && data?.session?.user && !hasOAuthCallback()) {
                goToDashboard();
                return;
            }
        } catch (error) {
            console.error("My-Kids-Hub session check error:", error);
        }

        supabase.auth.onAuthStateChange((event, session) => {
            console.log("My-Kids-Hub Auth Event:", event, session ? "session=yes" : "session=no");
            if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user && !redirecting) {
                goToDashboard();
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();

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
                if (!supabase?.auth) throw new Error("Authentication service is not available.");

                const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
                if (error) throw error;

                if (data?.session?.user) {
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
