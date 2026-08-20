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

    // OAuth cannot complete back to a file:// page. When the app is opened
    // locally, use the deployed My-Kids-Hub origin as the OAuth callback.
    // On HTTP/HTTPS deployments, preserve the current app origin and page.
    const getAppUrl = (page) => {
        const current = new URL(window.location.href);
        const base = current.protocol === "file:"
            ? "https://a6c6m6.github.io/My-Kids-Hub/"
            : current.href;
        const url = new URL(base);
        url.pathname = url.pathname.replace(/[^/]*$/, page);
        url.search = "";
        url.hash = "";
        return url.toString();
    };

    const setOAuthButtonLoading = (button, provider) => {
        if (!button) return () => {};
        const original = button.innerHTML;
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Connecting...`;
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

        const restore = setOAuthButtonLoading(button, provider);

        try {
            const { error } = await window.supabaseClient.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: getAppUrl("index.html")
                }
            });

            if (error) throw error;
        } catch (error) {
            console.error(`My Kids Hub ${provider} OAuth Error:`, error);
            restore();
            alert(error?.message || `${provider} login is not available. Please use email and password.`);
        }
    };

    googleLoginBtn?.addEventListener("click", () => loginWithOAuth("google", googleLoginBtn));

    // Supabase returns to this page after OAuth. Complete the existing login flow.
    const hasOAuthCallback = /(^|[?&])code=/.test(window.location.search) ||
        window.location.hash.includes("access_token=") ||
        window.location.hash.includes("error=");

    if (hasOAuthCallback && window.supabaseClient?.auth) {
        try {
            const { data, error } = await window.supabaseClient.auth.getSession();
            if (error) throw error;

            if (data?.session) {
                window.location.replace("dashboard.html");
                return;
            }

            if (window.location.hash.includes("error=")) {
                const params = new URLSearchParams(window.location.hash.substring(1));
                const description = params.get("error_description");
                if (description) {
                    alert(decodeURIComponent(description.replace(/\+/g, " ")));
                }
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
