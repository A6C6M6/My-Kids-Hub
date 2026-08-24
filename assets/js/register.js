document.addEventListener("DOMContentLoaded", async () => {
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
    const googleSignupBtn = document.getElementById("googleSignupBtn");
    const appleSignupBtn = document.getElementById("appleSignupBtn");

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

    // OAuth callback URLs must also be added to Supabase Auth > URL Configuration.
    // When opened locally as file://, use the deployed My-Kids-Hub page because
    // OAuth providers cannot redirect back to a local file URL.
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

    const getOAuthError = () => {
        const url = new URL(window.location.href);
        const params = new URLSearchParams(url.search);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        return {
            code: params.get("error_code") || hash.get("error_code"),
            description: params.get("error_description") || hash.get("error_description") || params.get("error") || hash.get("error")
        };
    };

    const setOAuthButtonsLoading = (activeButton) => {
        const buttons = [googleSignupBtn, appleSignupBtn].filter(Boolean);
        const originals = new Map(buttons.map(button => [button, button.innerHTML]));
        buttons.forEach(button => {
            button.disabled = true;
            button.setAttribute("aria-busy", "true");
        });
        if (activeButton) {
            activeButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Connecting...</span>';
        }
        return () => {
            buttons.forEach(button => {
                button.disabled = false;
                button.removeAttribute("aria-busy");
                button.innerHTML = originals.get(button);
            });
        };
    };

    const oauthSignup = async (provider, button) => {
        showMessage("", "");
        if (!window.supabaseClient?.auth) {
            showMessage("Authentication service is not available.", "error");
            return;
        }

        const restore = setOAuthButtonsLoading(button);
        try {
            const { error } = await window.supabaseClient.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: getAppUrl("register.html"),
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
                showMessage(`${provider === "google" ? "Google" : "Apple"} sign-in is not enabled in Supabase yet. Enable the provider and add the OAuth redirect URL, then try again.`, "error");
            } else if (/redirect|url configuration/i.test(message)) {
                showMessage("OAuth redirect URL is not configured in Supabase. Add the My-Kids-Hub callback URL and try again.", "error");
            } else {
                showMessage(message || `${provider} sign-up is not available. Please use email registration.`, "error");
            }
        }
    };

    googleSignupBtn?.addEventListener("click", () => oauthSignup("google", googleSignupBtn));
    appleSignupBtn?.addEventListener("click", () => oauthSignup("apple", appleSignupBtn));

    // OAuth callback: Supabase restores the session and provider details are
    // used to pre-fill the existing registration form.
    let oauthSession = null;
    if (window.supabaseClient?.auth) {
        try {
            const oauthError = getOAuthError();
            if (oauthError.description) {
                showMessage(decodeURIComponent(oauthError.description.replace(/\+/g, " ")), "error");
            }

            const { data, error } = await window.supabaseClient.auth.getSession();
            if (error) throw error;
            const session = data?.session;
            const user = session?.user;
            const provider = user?.app_metadata?.provider;

            if (session && (provider === "google" || provider === "apple")) {
                oauthSession = session;
                const metadata = user.user_metadata || {};
                const providerName = provider === "google" ? "Google" : "Apple";
                const suggestedName = metadata.full_name || metadata.name || metadata.user_name || "";
                const email = user.email || metadata.email || "";

                if (suggestedName && !fullNameInput.value) fullNameInput.value = suggestedName;
                if (email) {
                    emailInput.value = email;
                    emailInput.readOnly = true;
                    emailInput.setAttribute("aria-readonly", "true");
                }

                validateFullName();
                validateEmail();
                showMessage(`${providerName} account connected. Complete your mobile number and accept the Terms & Privacy Policy to finish registration.`, "success");
            }
        } catch (error) {
            console.error("My Kids Hub OAuth registration callback error:", error);
            showMessage("Unable to read the social account details. Please try again.", "error");
        }
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        showMessage("");

        const fullName = fullNameInput.value.trim();
        const email = emailInput.value.trim();
        const mobile = mobileInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        const valid = validateFullName() && validateEmail() && validateMobile() &&
            (oauthSession || password.length >= 6) &&
            (oauthSession || validateConfirmPassword()) && termsAccepted.checked;

        if (!fullName) {
            showMessage("Please enter your full name.", "error");
            fullNameInput.focus();
            return;
        }
        if (!validateEmail()) { emailInput.focus(); return; }
        if (!validateMobile()) { mobileInput.focus(); return; }
        if (!oauthSession && password.length < 6) {
            showMessage("Password must be at least 6 characters.", "error");
            passwordInput.focus();
            return;
        }
        if (!oauthSession && !validateConfirmPassword()) { confirmPasswordInput.focus(); return; }
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
            if (!oauthSession) {
                const { data, error: authError } = await window.supabaseClient.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            mobile,
                            terms_accepted: true
                        },
                        emailRedirectTo: getAppUrl("index.html")
                    }
                });

                if (authError) throw authError;

                // If email confirmation is disabled and Supabase returned a session,
                // the trigger already created the profile. If confirmation is enabled,
                // the trigger still creates the profile immediately from user metadata.
                if (data?.user) {
                    showMessage("Registration successful. Please check your email to verify your account.", "success");
                }
            } else {
                // OAuth already created/authenticated the Supabase user. Update only
                // the application profile fields collected on this registration page.
                const { data: userData, error: userError } = await window.supabaseClient.auth.getUser();
                if (userError) throw userError;
                if (!userData?.user) throw new Error("Authenticated user was not found.");

                const { error: profileError } = await window.supabaseClient
                    .from("profiles")
                    .update({
                        full_name: fullName,
                        mobile,
                        terms_accepted: true
                    })
                    .eq("id", userData.user.id);

                if (profileError) throw profileError;

                showMessage("Registration completed successfully. Redirecting to your dashboard...", "success");
            }

            setTimeout(() => {
                window.location.href = oauthSession ? "dashboard.html" : "index.html";
            }, oauthSession ? 900 : 2200);
        } catch (error) {
            console.error("My Kids Hub Registration Error:", error);
            showMessage(error?.message || "Registration failed. Please try again.", "error");
            registerBtn.disabled = false;
            registerBtn.innerHTML = originalContent;
        }
    });
});
