// My-Kids-Hub Login + OAuth functionality
// GitHub Pages + Supabase Auth
document.addEventListener("DOMContentLoaded", async () => {
    "use strict";

    const APP_ORIGIN = "https://a6c6m6.github.io/My-Kids-Hub/";

    const getAppUrl = (page = "index.html") => {
        const url = new URL(page, APP_ORIGIN);
        url.search = "";
        url.hash = "";
        return url.toString();
    };

    const supabase = window.supabaseClient;

    const loginForm = document.getElementById("loginForm");
    const googleLoginBtn = document.getElementById("googleLoginBtn");
    const togglePassword = document.getElementById("togglePassword");
    const password = document.getElementById("password");

    // ------------------------------------------------------------
    // Password show / hide
    // ------------------------------------------------------------
    if (togglePassword && password) {
        togglePassword.addEventListener("click", () => {
            const isPassword = password.type === "password";
            password.type = isPassword ? "text" : "password";
            togglePassword.classList.toggle("fa-eye", !isPassword);
            togglePassword.classList.toggle("fa-eye-slash", isPassword);
        });
    }

    // ------------------------------------------------------------
    // Navigation
    // ------------------------------------------------------------
    const goToDashboard = () => {
        window.location.replace(getAppUrl("dashboard.html"));
    };

    const cleanOAuthUrl = () => {
        window.history.replaceState(
            {},
            document.title,
            getAppUrl("index.html")
        );
    };

    const hasOAuthCallback = () => {
        const hash = window.location.hash || "";
        const search = new URLSearchParams(window.location.search);

        return (
            hash.includes("access_token=") ||
            hash.includes("refresh_token=") ||
            search.has("code")
        );
    };

    // ------------------------------------------------------------
    // OAuth button loading
    // ------------------------------------------------------------
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

    // ------------------------------------------------------------
    // Wait for Supabase to finish processing an OAuth callback.
    //
    // IMPORTANT:
    // Do NOT call setSession() on an access_token returned by
    // Supabase when detectSessionInUrl is enabled. Supabase itself
    // consumes the URL callback and persists the session.
    // ------------------------------------------------------------
    const waitForSession = async (timeoutMs = 12000) => {
        if (!supabase?.auth) return null;

        const started = Date.now();

        while (Date.now() - started < timeoutMs) {
            try {
                const { data, error } = await supabase.auth.getSession();

                if (!error && data?.session) {
                    return data.session;
                }
            } catch (error) {
                console.warn("My-Kids-Hub getSession retry:", error);
            }

            await new Promise((resolve) => setTimeout(resolve, 250));
        }

        return null;
    };

    // ------------------------------------------------------------
    // OAuth callback handler
    // ------------------------------------------------------------
    const handleOAuthCallback = async () => {
        if (!supabase?.auth) return false;

        const hash = window.location.hash || "";
        const search = new URLSearchParams(window.location.search);

        // PKCE callback: ?code=...
        const code = search.get("code");

        if (code) {
            try {
                const { data, error } =
                    await supabase.auth.exchangeCodeForSession(code);

                if (error) throw error;

                if (data?.session) {
                    cleanOAuthUrl();
                    goToDashboard();
                    return true;
                }

                const session = await waitForSession();

                if (session) {
                    cleanOAuthUrl();
                    goToDashboard();
                    return true;
                }

                alert(
                    "Google login succeeded, but the Supabase session could not be created. Please try again."
                );
                return true;
            } catch (error) {
                console.error(
                    "My-Kids-Hub OAuth code exchange error:",
                    error
                );

                alert(
                    error?.message ||
                    "Google login failed. Please try again."
                );

                return true;
            }
        }

        // Implicit callback: #access_token=...
        if (
            hash.includes("access_token=") ||
            hash.includes("refresh_token=")
        ) {
            // Supabase Auth processes this callback automatically when
            // createClient() is initialized with detectSessionInUrl:true.
            const session = await waitForSession();

            if (session) {
                cleanOAuthUrl();
                goToDashboard();
                return true;
            }

            console.error(
                "My-Kids-Hub: OAuth tokens were returned, but no session was restored."
            );

            alert(
                "Google login succeeded, but the Supabase session could not be created. Please try again."
            );

            return true;
        }

        return false;
    };

    // ------------------------------------------------------------
    // Google login
    // ------------------------------------------------------------
    const loginWithOAuth = async (provider, button) => {
        if (!supabase?.auth) {
            alert(
                "Authentication service is not available. Please try again later."
            );
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

            if (
                /provider.*not.*enabled|unsupported.*provider/i.test(
                    message
                )
            ) {
                alert("Google sign-in is not enabled in Supabase.");
            } else if (
                /redirect|url configuration|redirect_to/i.test(message)
            ) {
                alert(
                    "OAuth redirect URL is not configured correctly in Supabase."
                );
            } else {
                alert(
                    message ||
                    "Google login failed. Please try again."
                );
            }
        }
    };

    if (googleLoginBtn) {
        googleLoginBtn.addEventListener("click", () => {
            loginWithOAuth("google", googleLoginBtn);
        });
    }

    // ------------------------------------------------------------
    // AUTH INITIALIZATION
    // ------------------------------------------------------------
    if (supabase?.auth) {
        let callbackHandled = false;

        // First handle callback already present in the URL.
        if (hasOAuthCallback()) {
            callbackHandled = await handleOAuthCallback();

            if (callbackHandled) return;
        }

        // Listen for normal Supabase auth events.
        supabase.auth.onAuthStateChange((event, session) => {
            console.log(
                "My-Kids-Hub Auth Event:",
                event,
                session ? "session=yes" : "session=no"
            );

            if (
                (event === "SIGNED_IN" ||
                    event === "INITIAL_SESSION") &&
                session
            ) {
                // If an OAuth callback was present, remove tokens/code.
                if (hasOAuthCallback()) {
                    cleanOAuthUrl();
                }

                goToDashboard();
            }
        });

        // Final session check for normal email login / remembered session.
        try {
            const { data, error } = await supabase.auth.getSession();

            if (!error && data?.session && !hasOAuthCallback()) {
                goToDashboard();
                return;
            }
        } catch (error) {
            console.error(
                "My-Kids-Hub session check error:",
                error
            );
        }
    }

    // ------------------------------------------------------------
    // Email + password login
    // ------------------------------------------------------------
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

            btn.innerHTML =
                '<i class="fas fa-spinner fa-spin"></i> Processing...';
            btn.disabled = true;

            try {
                if (!supabase?.auth) {
                    throw new Error(
                        "Authentication service is not available."
                    );
                }

                const { data, error } =
                    await supabase.auth.signInWithPassword({
                        email,
                        password: pass
                    });

                if (error) throw error;

                if (data?.session) {
                    console.log(
                        "My-Kids-Hub: Email login successful."
                    );

                    goToDashboard();
                    return;
                }

                throw new Error(
                    "Authentication session was not created."
                );
            } catch (error) {
                console.error(
                    "My-Kids-Hub Login Error:",
                    error
                );

                alert(
                    error?.message ||
                    "Invalid email or password. Please try again."
                );

                btn.innerHTML = originalContent;
                btn.disabled = false;
            }
        });
    }
});
