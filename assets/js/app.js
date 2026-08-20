// Password Toggle Functionality
document.addEventListener("DOMContentLoaded", () => {
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
