// My-Kids-Hub Login + OAuth functionality

document.addEventListener("DOMContentLoaded", async () => {
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

    const loginForm = document.getElementById("loginForm");
    const googleLoginBtn = document.getElementById("googleLoginBtn");

    // Google/Supabase OAuth must return to a URL that is actually reachable.
    // Always use the deployed GitHub Pages application URL so OAuth does not
    // redirect to localhost:3000 when the project is tested from a local server.
    const APP_ORIGIN = "https://a6c6m6.github.io/My-Kids-Hub/";

    const getAppUrl = (page = "index.html") => {
        const url = new URL(page, APP_ORIGIN);
        url.search = "";
        url.hash = "";
        return url.toString();
    };

    const getOAuthError = () => {
        const url = new URL(window.location.href);
        const params = new URLSearchParams(url.search);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        return {
            code: params.get("error_code") || hash.get("error_code"),
            description: params.get("error_description") || hash.get("error_description") || params.get("error") || hash.get("error")
        };
    };

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

    const loginWithOAuth = async (provider, button) => {
        if (!window.supabaseClient?.auth) {
            alert("Authentication service is not available. Please try again later.");
            return;
        }

        const restore = setOAuthButtonLoading(button);

        try {
            const { error } = await window.supabaseClient.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: getAppUrl("index.html"),
                    queryParams: provider === "google"
                        ? { access_type: "offline", prompt: "select_account" }
                        : undefined
                }
            });

            if (error) throw error;
        } catch (error) {
            console.error(`My Kids Hub ${provider} OAuth Error:`, error);
            restore();
            const message = error?.message || "";
            if (/provider.*not.*enabled|unsupported.*provider/i.test(message)) {
                alert("Google sign-in is not enabled in Supabase yet. Enable the provider and add the OAuth redirect URL, then try again.");
            } else if (/redirect|url configuration/i.test(message)) {
                alert("OAuth redirect URL is not configured in Supabase. Add the My-Kids-Hub callback URL and try again.");
            } else {
                alert(message || "Google login is not available. Please use email and password.");
            }
        }
    };

    googleLoginBtn?.addEventListener("click", () => loginWithOAuth("google", googleLoginBtn));

    // Supabase returns to the GitHub Pages index page after OAuth.
    const hasOAuthCallback = /(^|[?&])code=/.test(window.location.search) ||
        window.location.hash.includes("access_token=") ||
        window.location.hash.includes("error=") ||
        window.location.search.includes("error=");

    if (hasOAuthCallback && window.supabaseClient?.auth) {
        try {
            const oauthError = getOAuthError();
            if (oauthError.description) {
                alert(decodeURIComponent(oauthError.description.replace(/\+/g, " ")));
            }

            const { data, error } = await window.supabaseClient.auth.getSession();
            if (error) throw error;

            if (data?.session) {
                window.location.replace("dashboard.html");
                return;
            }
        } catch (error) {
            console.error("My Kids Hub OAuth callback error:", error);
            alert("Unable to complete social login. Please try again.");
        }
    }

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
                if (!window.supabaseClient) {
                    throw new Error("Authentication service is not available.");
                }

                const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                    email,
                    password: pass
                });

                if (error) throw error;

                if (data && data.session) {
                    window.location.href = "dashboard.html";
                } else {
                    throw new Error("Authentication session was not created.");
                }
            } catch (error) {
                console.error("My Kids Hub Auth Error:", error);
                alert("Invalid email or password. Please try again.");
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }
        });
    }
});
