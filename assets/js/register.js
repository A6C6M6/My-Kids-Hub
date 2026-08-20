document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registerForm");
    const messageBox = document.getElementById("formMessage");
    const registerBtn = document.getElementById("registerBtn");
    const fullNameInput = document.getElementById("fullName");
    const emailInput = document.getElementById("email");
    const mobileInput = document.getElementById("mobile");
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirmPassword");
    const termsAccepted = document.getElementById("termsAccepted");

    if (!form || !messageBox) return;

    const emailFeedback = document.getElementById("emailFeedback");
    const mobileFeedback = document.getElementById("mobileFeedback");
    const fullNameFeedback = document.getElementById("fullNameFeedback");
    const confirmFeedback = document.getElementById("confirmPasswordFeedback");
    const strengthWrap = document.getElementById("passwordStrengthWrap");
    const strengthBar = document.getElementById("passwordStrengthBar");
    const strengthText = document.getElementById("passwordStrengthText");

    const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
    const isValidMobile = (value) => /^[6-9]\d{9}$/.test(value);

    const setFeedback = (element, message, state = "") => {
        if (!element) return;
        element.textContent = message;
        element.className = `field-feedback${state ? ` ${state}` : ""}`;
    };

    const setInputState = (input, state) => {
        if (!input) return;
        input.classList.toggle("is-valid", state === "valid");
        input.classList.toggle("is-invalid", state === "invalid");
    };

    const showMessage = (text, type = "") => {
        messageBox.textContent = text;
        messageBox.className = `form-message${type ? ` ${type}` : ""}`;
    };

    const passwordStrength = (password) => {
        let score = 0;
        if (password.length >= 6) score++;
        if (password.length >= 10) score++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
        if (/\d/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        return Math.min(score, 5);
    };

    const updatePasswordStrength = () => {
        const password = passwordInput.value;
        if (!password) {
            strengthWrap.hidden = true;
            return;
        }
        strengthWrap.hidden = false;
        const score = passwordStrength(password);
        const labels = ["Very Weak", "Weak", "Fair", "Good", "Strong", "Strong"];
        const widths = [10, 25, 45, 65, 85, 100];
        strengthBar.style.width = `${widths[score]}%`;
        strengthText.textContent = labels[score];
        strengthBar.style.background = score <= 1 ? "#df5555" : score === 2 ? "#e5a72f" : score === 3 ? "#4c9ed9" : "#25a269";
    };

    const validateEmail = () => {
        const value = emailInput.value.trim();
        if (!value) {
            setFeedback(emailFeedback, "Email address is required.", "invalid");
            setInputState(emailInput, "invalid");
            return false;
        }
        if (!isValidEmail(value)) {
            setFeedback(emailFeedback, "Please enter a valid email address.", "invalid");
            setInputState(emailInput, "invalid");
            return false;
        }
        setFeedback(emailFeedback, "Valid email address.", "valid");
        setInputState(emailInput, "valid");
        return true;
    };

    const validateMobile = () => {
        const value = mobileInput.value.trim();
        if (!value) {
            setFeedback(mobileFeedback, "Mobile number is required.", "invalid");
            setInputState(mobileInput, "invalid");
            return false;
        }
        if (!isValidMobile(value)) {
            setFeedback(mobileFeedback, "Enter a valid 10-digit Indian mobile number.", "invalid");
            setInputState(mobileInput, "invalid");
            return false;
        }
        setFeedback(mobileFeedback, "Valid mobile number.", "valid");
        setInputState(mobileInput, "valid");
        return true;
    };

    const validateFullName = () => {
        const valid = fullNameInput.value.trim().length >= 2;
        setFeedback(fullNameFeedback, valid ? "" : "Full name is required.", valid ? "" : "invalid");
        return valid;
    };

    const validateConfirmPassword = () => {
        const value = confirmPasswordInput.value;
        if (!value) {
            setFeedback(confirmFeedback, "Confirm password is required.", "invalid");
            setInputState(confirmPasswordInput, "invalid");
            return false;
        }
        if (value !== passwordInput.value) {
            setFeedback(confirmFeedback, "Passwords do not match.", "invalid");
            setInputState(confirmPasswordInput, "invalid");
            return false;
        }
        setFeedback(confirmFeedback, "Passwords match.", "valid");
        setInputState(confirmPasswordInput, "valid");
        return true;
    };

    [emailInput].forEach(input => input.addEventListener("input", () => { messageBox.textContent = ""; validateEmail(); }));
    mobileInput.addEventListener("input", () => {
        mobileInput.value = mobileInput.value.replace(/\D/g, "").slice(0, 10);
        messageBox.textContent = "";
        validateMobile();
    });
    fullNameInput.addEventListener("input", validateFullName);
    passwordInput.addEventListener("input", () => { updatePasswordStrength(); validateConfirmPassword(); });
    confirmPasswordInput.addEventListener("input", validateConfirmPassword);

    document.querySelectorAll(".password-toggle").forEach(toggle => {
        toggle.addEventListener("click", () => {
            const target = document.getElementById(toggle.dataset.target);
            if (!target) return;
            const showing = target.type === "password";
            target.type = showing ? "text" : "password";
            toggle.innerHTML = `<i class="fa-solid ${showing ? "fa-eye-slash" : "fa-eye"}"></i>`;
            toggle.setAttribute("aria-label", showing ? "Hide password" : "Show password");
        });
    });

    const oauthSignup = async (provider) => {
        showMessage("", "");
        if (!window.supabaseClient?.auth) {
            showMessage("Authentication service is not available.", "error");
            return;
        }
        try {
            const redirectTo = `${window.location.origin}${window.location.pathname.replace(/register\.html$/, "index.html")}`;
            const { error } = await window.supabaseClient.auth.signInWithOAuth({
                provider,
                options: { redirectTo }
            });
            if (error) throw error;
        } catch (error) {
            console.error(`My Kids Hub ${provider} OAuth Error:`, error);
            showMessage(error?.message || `${provider} sign-up is not available. Please use email registration.`, "error");
        }
    };

    document.getElementById("googleSignupBtn")?.addEventListener("click", () => oauthSignup("google"));
    document.getElementById("appleSignupBtn")?.addEventListener("click", () => oauthSignup("apple"));

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        showMessage("");

        const fullName = fullNameInput.value.trim();
        const email = emailInput.value.trim();
        const mobile = mobileInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        const valid = validateFullName() && validateEmail() && validateMobile() && password.length >= 6 && validateConfirmPassword() && termsAccepted.checked;

        if (!fullName) {
            showMessage("Please enter your full name.", "error");
            fullNameInput.focus();
            return;
        }
        if (!validateEmail()) { emailInput.focus(); return; }
        if (!validateMobile()) { mobileInput.focus(); return; }
        if (password.length < 6) {
            showMessage("Password must be at least 6 characters.", "error");
            passwordInput.focus();
            return;
        }
        if (!validateConfirmPassword()) { confirmPasswordInput.focus(); return; }
        if (!termsAccepted.checked) {
            showMessage("Please agree to the Terms & Privacy Policy before creating your account.", "error");
            termsAccepted.focus();
            return;
        }
        if (!valid) return;

        if (!window.supabaseClient?.auth) {
            showMessage("Authentication service is not available. Please try again later.", "error");
            return;
        }

        const originalContent = registerBtn.innerHTML;
        registerBtn.disabled = true;
        registerBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating Account...';

        try {
            const { data: authData, error: authError } = await window.supabaseClient.auth.signUp({
                email,
                password
            });

            if (authError) throw authError;

            const { error: insertError } = await window.supabaseClient
                .from("users")
                .insert([{ full_name: fullName, email: email, mobile: mobile }]);

            if (insertError) console.error("My Kids Hub users insert warning:", insertError);

            showMessage("Registration successful. Please check your email to verify your account.", "success");

            setTimeout(() => {
                window.location.href = "index.html";
            }, 2200);
        } catch (error) {
            console.error("My Kids Hub Registration Error:", error);
            showMessage(error?.message || "Registration failed. Please try again.", "error");
            registerBtn.disabled = false;
            registerBtn.innerHTML = originalContent;
        }
    });
});
