document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("resetForm");
    const resetBtn = document.getElementById("resetBtn");
    const resendBtn = document.getElementById("resendBtn");
    const resendText = document.getElementById("resendText");
    const emailInput = document.getElementById("email");
    const emailFeedback = document.getElementById("emailFeedback");
    const resetMessage = document.getElementById("resetMessage");

    if (!form || !resetBtn || !emailInput) return;

    resetBtn.disabled = true;

    const RESEND_DELAY = 60;
    let resendTimer = null;
    let lastSubmittedEmail = "";

    const isValidEmail = (value) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
    };

    const setEmailFeedback = (message, state = "") => {
        emailFeedback.textContent = message;
        emailFeedback.className = "field-feedback" + (state ? ` is-${state}` : "");
        emailInput.classList.toggle("is-valid", state === "valid");
        emailInput.classList.toggle("is-invalid", state === "invalid");
        emailInput.setAttribute("aria-invalid", state === "invalid" ? "true" : "false");
    };

    const showMessage = (message, type) => {
        resetMessage.hidden = false;
        resetMessage.textContent = message;
        resetMessage.className = `reset-message ${type}`;
    };

    const clearMessage = () => {
        resetMessage.hidden = true;
        resetMessage.textContent = "";
        resetMessage.className = "reset-message";
    };

    const updateSubmitState = (isValid) => {
        resetBtn.disabled = !isValid;
    };

    const validateEmail = (showRequiredMessage = true) => {
        const email = emailInput.value.trim();

        if (!email) {
            setEmailFeedback(showRequiredMessage ? "Email address is required." : "", "invalid");
            updateSubmitState(false);
            return false;
        }

        if (!isValidEmail(email)) {
            setEmailFeedback("Please enter a valid email address.", "invalid");
            updateSubmitState(false);
            return false;
        }

        setEmailFeedback("Valid email address.", "valid");
        updateSubmitState(true);
        return true;
    };

    const stopResendTimer = () => {
        if (resendTimer) {
            clearInterval(resendTimer);
            resendTimer = null;
        }
    };

    const startResendTimer = () => {
        stopResendTimer();

        let remaining = RESEND_DELAY;
        resendBtn.hidden = false;
        resendBtn.disabled = true;
        resendText.textContent = `Resend Link (${remaining}s)`;

        resendTimer = setInterval(() => {
            remaining -= 1;

            if (remaining <= 0) {
                stopResendTimer();
                resendBtn.disabled = false;
                resendText.textContent = "Resend Link";
                return;
            }

            resendText.textContent = `Resend Link (${remaining}s)`;
        }, 1000);
    };

    const sendResetLink = async (email) => {
        if (!window.supabaseClient || !window.supabaseClient.auth) {
            throw new Error("Authentication service is not available. Please try again later.");
        }

        // Keep the existing Supabase recovery flow. The redirect target remains
        // relative to the current application location.
        const resetUrl = "https://a6c6m6.github.io/My-Kids-Hub/reset-password.html";

        const { error } = await window.supabaseClient.auth.resetPasswordForEmail(
            email,
            { redirectTo: resetUrl }
        );

        if (error) throw error;
    };

    const submitReset = async (email) => {
        resetBtn.disabled = true;
        clearMessage();

        try {
            await sendResetLink(email);
            lastSubmittedEmail = email;

            showMessage(
                "Reset link sent to your email! Please check your inbox and spam/junk folder.",
                "success"
            );
            startResendTimer();
        } catch (error) {
            console.error("My Kids Hub Password Recovery Error:", error);
            showMessage(
                error?.message || "Unable to send password reset link. Please try again.",
                "error"
            );
            resendBtn.hidden = true;
            stopResendTimer();
        } finally {
            resetBtn.disabled = false;
        }
    };

    emailInput.addEventListener("input", () => {
        clearMessage();
        validateEmail(false);
    });

    emailInput.addEventListener("blur", () => {
        validateEmail(true);
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!validateEmail(true)) {
            emailInput.focus();
            return;
        }

        const email = emailInput.value.trim();
        await submitReset(email);
    });

    resendBtn?.addEventListener("click", async () => {
        const email = lastSubmittedEmail || emailInput.value.trim();

        if (!isValidEmail(email)) {
            validateEmail(true);
            emailInput.focus();
            return;
        }

        await submitReset(email);
    });

    window.addEventListener("beforeunload", stopResendTimer);
});
