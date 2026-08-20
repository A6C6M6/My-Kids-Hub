document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("passwordResetForm");
    const newPassword = document.getElementById("newPassword");
    const confirmPassword = document.getElementById("confirmPassword");
    const updateBtn = document.getElementById("updatePasswordBtn");
    const message = document.getElementById("passwordResetMessage");
    const strengthBox = document.getElementById("passwordStrength");
    const strengthBar = document.getElementById("strengthBar");
    const strengthText = document.getElementById("strengthText");
    const matchFeedback = document.getElementById("matchFeedback");
    const recoveryExpired = document.getElementById("recoveryExpired");
    const recoveryEmail = document.getElementById("recoveryEmail");
    const recoveryEmailFeedback = document.getElementById("recoveryEmailFeedback");
    const resendRecoveryBtn = document.getElementById("resendRecoveryBtn");
    const resendRecoveryText = document.getElementById("resendRecoveryText");

    if (!form || !newPassword || !confirmPassword || !updateBtn || !message) return;

    const RESEND_DELAY = 60;
    let resendTimer = null;

    const showMessage = (text, type) => {
        message.hidden = false;
        message.textContent = text;
        message.className = `reset-message ${type}`;
    };

    const clearMessage = () => {
        message.hidden = true;
        message.textContent = "";
        message.className = "reset-message";
    };

    const togglePassword = (input, icon) => {
        if (!input || !icon) return;
        icon.addEventListener("click", () => {
            const isPassword = input.type === "password";
            input.type = isPassword ? "text" : "password";
            icon.classList.toggle("fa-eye", !isPassword);
            icon.classList.toggle("fa-eye-slash", isPassword);
        });
    };

    togglePassword(newPassword, document.getElementById("toggleNewPassword"));
    togglePassword(confirmPassword, document.getElementById("toggleConfirmPassword"));

    const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());

    const updateStrength = () => {
        const value = newPassword.value;
        if (!strengthBox || !strengthBar || !strengthText) return;
        if (!value) {
            strengthBox.style.display = "none";
            return;
        }
        strengthBox.style.display = "block";
        let score = 0;
        if (value.length >= 6) score++;
        if (value.length >= 10) score++;
        if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
        if (/\d/.test(value)) score++;
        if (/[^A-Za-z0-9]/.test(value)) score++;
        const widths = ["10%", "25%", "45%", "65%", "85%", "100%"];
        const labels = ["Very Weak", "Weak", "Fair", "Good", "Strong", "Strong"];
        strengthBar.style.width = widths[Math.min(score, 5)];
        strengthBar.style.backgroundColor =
            score <= 1 ? "#dc2626" : score === 2 ? "#ea580c" : score === 3 ? "#ca8a04" : "#16a34a";
        strengthText.textContent = labels[Math.min(score, 5)];
    };

    const updateMatch = () => {
        if (!matchFeedback) return;
        if (!confirmPassword.value) {
            matchFeedback.textContent = "";
            matchFeedback.className = "match-feedback";
        } else if (newPassword.value === confirmPassword.value) {
            matchFeedback.textContent = "✓ Passwords match.";
            matchFeedback.className = "match-feedback is-valid";
        } else {
            matchFeedback.textContent = "✕ Passwords do not match.";
            matchFeedback.className = "match-feedback is-invalid";
        }
    };

    newPassword.addEventListener("input", () => { clearMessage(); updateStrength(); updateMatch(); });
    confirmPassword.addEventListener("input", () => { clearMessage(); updateMatch(); });

    const setRecoveryEmailFeedback = (state) => {
        if (!recoveryEmail || !recoveryEmailFeedback) return;
        recoveryEmail.classList.toggle("is-valid", state === "valid");
        recoveryEmail.classList.toggle("is-invalid", state === "invalid");
        recoveryEmailFeedback.className = `recovery-email-feedback${state ? ` is-${state}` : ""}`;
        recoveryEmailFeedback.textContent =
            state === "valid" ? "Valid email address." :
            state === "invalid" ? "Please enter a valid email address." : "";
    };

    const stopResendTimer = () => {
        if (resendTimer) {
            clearInterval(resendTimer);
            resendTimer = null;
        }
    };

    const startResendTimer = () => {
        if (!resendRecoveryBtn || !resendRecoveryText) return;
        stopResendTimer();
        let remaining = RESEND_DELAY;
        resendRecoveryBtn.disabled = true;
        resendRecoveryText.textContent = `Resend Reset Link (${remaining}s)`;
        resendTimer = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                stopResendTimer();
                resendRecoveryBtn.disabled = false;
                resendRecoveryText.textContent = "Resend Reset Link";
            } else {
                resendRecoveryText.textContent = `Resend Reset Link (${remaining}s)`;
            }
        }, 1000);
    };

    const sendRecoveryLink = async (email) => {
        if (!window.supabaseClient || !window.supabaseClient.auth) {
            throw new Error("Authentication service is not available. Please try again later.");
        }
        const resetUrl = "https://a6c6m6.github.io/My-Kids-Hub/reset-password.html";
        const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: resetUrl });
        if (error) throw error;
    };

    const showExpiredState = (text) => {
        if (recoveryExpired) recoveryExpired.style.display = "block";
        updateBtn.disabled = true;
        showMessage(text || "This password reset link is invalid or has expired. Please request a new reset link.", "error");
    };

    recoveryEmail?.addEventListener("input", () => {
        const value = recoveryEmail.value.trim();
        setRecoveryEmailFeedback(!value ? "" : (isValidEmail(value) ? "valid" : "invalid"));
    });

    resendRecoveryBtn?.addEventListener("click", async () => {
        const email = recoveryEmail?.value.trim() || "";
        if (!isValidEmail(email)) {
            setRecoveryEmailFeedback("invalid");
            recoveryEmail?.focus();
            return;
        }
        resendRecoveryBtn.disabled = true;
        resendRecoveryText.textContent = "Sending...";
        try {
            await sendRecoveryLink(email);
            showMessage("A new reset link has been sent to your email. Please check your inbox and spam/junk folder.", "success");
            startResendTimer();
        } catch (error) {
            console.error("My Kids Hub Password Recovery Resend Error:", error);
            showMessage(error?.message || "Unable to send a new reset link. Please try again.", "error");
            resendRecoveryBtn.disabled = false;
            resendRecoveryText.textContent = "Resend Reset Link";
        }
    });

    if (!window.supabaseClient || !window.supabaseClient.auth) {
        showMessage("Authentication service is not available. Please try again later.", "error");
        updateBtn.disabled = true;
        return;
    }

    const url = new URL(window.location.href);
    const query = url.searchParams;
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const errorCode = query.get("error_code") || hash.get("error_code");
    const errorDescription = query.get("error_description") || hash.get("error_description");

    if (errorCode === "otp_expired" || /expired|invalid/i.test(errorDescription || "")) {
        showExpiredState();
        return;
    }

    try {
        // Allow Supabase's URL/session processing to complete before checking the session.
        await new Promise(resolve => setTimeout(resolve, 300));
        const { data, error } = await window.supabaseClient.auth.getSession();
        if (error) throw error;
        if (!data?.session) {
            showExpiredState();
            return;
        }
        if (recoveryExpired) recoveryExpired.style.display = "none";
        updateBtn.disabled = false;
        clearMessage();
    } catch (error) {
        console.error("My Kids Hub Password Reset Session Error:", error);
        showExpiredState("Unable to verify this password reset link. Please request a new reset link.");
        return;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearMessage();
        const password = newPassword.value;
        const confirmation = confirmPassword.value;

        if (password.length < 6) {
            showMessage("Password must be at least 6 characters.", "error");
            newPassword.focus();
            return;
        }
        if (password !== confirmation) {
            showMessage("Passwords do not match.", "error");
            confirmPassword.focus();
            return;
        }

        const originalContent = updateBtn.innerHTML;
        updateBtn.disabled = true;
        updateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

        try {
            const { error } = await window.supabaseClient.auth.updateUser({ password });
            if (error) throw error;

            showMessage("Password updated successfully. You can now log in with your new password.", "success");
            form.reset();
            updateStrength();
            updateMatch();

            setTimeout(async () => {
                try { await window.supabaseClient.auth.signOut(); }
                catch (signOutError) { console.warn("My Kids Hub Sign Out Warning:", signOutError); }
                window.location.href = "index.html";
            }, 1800);
        } catch (error) {
            console.error("My Kids Hub Password Update Error:", error);
            showMessage(error?.message || "Unable to update password. Please try again.", "error");
            updateBtn.disabled = false;
            updateBtn.innerHTML = originalContent;
        }
    });

    window.addEventListener("beforeunload", stopResendTimer);
});
