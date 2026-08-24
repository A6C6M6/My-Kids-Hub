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
        window.history.replaceState({}, document.title, getAppUrl("index.html"));
    };

    const hasOAuthCallback = () => {
        const hash = window.location.hash || "";
        const search = new URLSearchParams(window.location.search);

        return (
            search.has("code") ||
            hash.includes("access_token=") ||
            hash.includes("refresh_token=")
        );
    };

    const waitForSession = async (timeoutMs = 15000) => {
        if (!supabase?.auth) return null;

        const started = Date.now();

        while (Date.now() - started < timeoutMs) {
            try {
                const { data, error } = await supabase.auth.getSession();

                if (!error && data?.session) return data.session;
                if (error) console.warn("My-Kids-Hub getSession:", error);
            } catch (error) {
                console.warn("My-Kids-Hub getSession retry:", error);
            }

            await new Promise((resolve) => setTimeout(resolve, 300));
        }

        return null;
    };

    // Password show / hide
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
        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';

        return () => {
            button.disabled = false;
            button.removeAttribute("aria-busy");
            button.innerHTML = original;
        };
    };

    // OAuth callback handler.
    // New callbacks use PKCE (?code=...). Supabase is configured with
    // detectSessionInUrl:true, so it automatically completes the code
    // exchange and persists the session. We do not call
    // exchangeCodeForSession() here because that can race with the
    // client's automatic callback processing.
    //
    // A legacy implicit-flow fallback is retained for an old tab that
    // still returns #access_token=... from the previous deployment.
    const handleOAuthCallback = async () => {
        if (!supabase?.auth) return false;

        const search = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(
            (window.location.hash || "").replace(/^#/, "")
        );

        const hasCode = search.has("code");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (!hasCode && !accessToken && !refreshToken) return false;

        // Give Supabase Auth time to finish its automatic initialization.
        const session = await waitForSession(15000);

        if (session) {
            cleanOAuthUrl();
            goToDashboard();
            return true;
        }

        // Legacy implicit-flow fallback.
        if (accessToken && refreshToken) {
            try {
                const { data, error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken
                });

                if (error) throw error;

                if (data?.session) {
                    cleanOAuthUrl();
                    goToDashboard();
                    return true;
                }
            } catch (error) {
                console.error("My-Kids-Hub legacy OAuth session error:", error);
                alert(
                    error?.message ||
                    "Google login failed while creating the session. Please start the login again."
                );
                return true;
            }
        }

        console.error(
            "My-Kids-Hub: OAuth callback was received, but no Supabase session was created."
        );

        alert(
            "Google login completed, but the Supabase session was not created. Please start Google login again."
        );

        return true;
    };

    // Google login
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
            } else if (/redirect|url configuration|redirect_to/i.test(message)) {
                alert("OAuth redirect URL is not configured correctly in Supabase.");
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

    if (supabase?.auth) {
        // Register immediately so the post-redirect event is not missed.
        supabase.auth.onAuthStateChange((event, session) => {
            console.log(
                "My-Kids-Hub Auth Event:",
                event,
                session ? "session=yes" : "session=no"
            );

            if (
                (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
                session &&
                !redirecting
            ) {
                if (hasOAuthCallback()) cleanOAuthUrl();
                goToDashboard();
            }
        });

        if (hasOAuthCallback()) {
            const callbackHandled = await handleOAuthCallback();
            if (callbackHandled) return;
        }

        try {
            const { data, error } = await supabase.auth.getSession();

            if (!error && data?.session && !hasOAuthCallback()) {
                goToDashboard();
                return;
            }
        } catch (error) {
            console.error("My-Kids-Hub session check error:", error);
        }
    }

    // Email + password login
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
                if (!supabase?.auth) {
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
