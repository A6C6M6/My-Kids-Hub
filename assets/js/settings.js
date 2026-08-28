(async () => {
    "use strict";

    const client = window.supabaseClient;
    if (!client?.auth) return;
    const $ = id => document.getElementById(id);
    const state = { user: null, profile: {}, preferences: {}, factorId: null, factorType: null };

    const show = (message, type = "success") => {
        const el = $("settingsMessage");
        if (!el) return;
        el.textContent = message || "";
        el.className = message ? `module-message ${type}` : "module-message";
    };

    const initials = name => String(name || "User").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(v => v[0]).join("").toUpperCase() || "US";

    const setAvatar = (el, name, url) => {
        if (!el) return;
        const fallback = initials(name);
        el.textContent = fallback;
        el.style.overflow = "hidden";
        if (url) {
            const img = document.createElement("img");
            img.src = url;
            img.alt = name || "Profile";
            img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;";
            img.addEventListener("error", () => { el.textContent = fallback; }, { once: true });
            el.textContent = "";
            el.appendChild(img);
        }
    };

    const applyHeader = () => {
        const name = state.profile.full_name || state.user?.user_metadata?.full_name || state.user?.user_metadata?.name || state.user?.email || "User";
        const role = state.profile.role === "admin" ? "Administrator" : state.profile.role === "staff" ? "Staff" : state.profile.role === "parent" ? "Parent" : "Administrator";
        document.querySelectorAll(".user-info strong,.profile-text strong").forEach(e => e.textContent = name);
        document.querySelectorAll(".user-info span:not(.status-dot),.profile-text span").forEach(e => e.textContent = role);
        document.querySelectorAll(".avatar").forEach(e => setAvatar(e, name, state.profile.avatar_url));
        const preview = $("profileAvatarPreview");
        if (preview) setAvatar(preview, name, state.profile.avatar_url);
    };

    const loadProfile = async () => {
        const { data, error } = await client.from("profiles")
            .select("full_name,mobile,avatar_url,role,school_name,school_phone,school_email,school_address,is_active,preferences")
            .eq("id", state.user.id).single();
        if (error) throw error;
        state.profile = data || {};
        state.preferences = data?.preferences || {};

        $("profileName").value = data?.full_name || state.user.user_metadata?.full_name || "";
        $("profileMobile").value = data?.mobile || "";
        $("profileEmail").value = state.user.email || "";
        $("profileUserId").value = state.user.id || "";
        $("profileRole").value = data?.role === "admin" ? "Administrator" : data?.role === "staff" ? "Staff" : data?.role === "parent" ? "Parent" : "Administrator";
        $("profileAddress").value = data?.address || "";
        $("schoolName").value = data?.school_name || "";
        $("schoolPhone").value = data?.school_phone || "";
        $("schoolEmail").value = data?.school_email || "";
        $("schoolAddress").value = data?.school_address || "";

        $("emailNotifications").checked = state.preferences.email_notifications !== false;
        $("smsNotifications").checked = state.preferences.sms_notifications === true;
        $("themePreference").value = state.preferences.theme || localStorage.getItem("mykidshub-theme") || "light";
        $("preferenceLanguage").value = state.preferences.language || localStorage.getItem("mykidshub-language") || "en";
        $("dateFormat").value = state.preferences.date_format || "en-IN";
        $("timeFormat").value = state.preferences.time_format || "12";
        $("accountStatus").textContent = data?.is_active === false ? "Account is inactive." : "Account is active.";
        $("accountEmail").textContent = `Email: ${state.user.email || "—"}`;
        $("accountRole").textContent = `Role: ${$("profileRole").value}`;
        applyHeader();
    };

    const updateProfile = async () => {
        const name = $("profileName").value.trim();
        const mobile = $("profileMobile").value.trim();
        const address = $("profileAddress").value.trim();
        if (!name) return show("Name is required.", "error");
        if (mobile && !/^[6-9]\d{9}$/.test(mobile)) return show("Enter a valid 10-digit mobile number.", "error");
        const file = $("profileAvatar").files?.[0];
        if (file) {
            if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return show("Use PNG, JPEG or WebP for the profile photo.", "error");
            if (file.size > 2 * 1024 * 1024) return show("Profile photo must be 2 MB or smaller.", "error");
        }
        const button = $("saveProfileBtn");
        button.disabled = true; button.textContent = "Saving...";
        try {
            let avatarUrl = state.profile.avatar_url || null;
            if (file) {
                const ext = file.name.split(".").pop().toLowerCase();
                const path = `${state.user.id}/avatar-${Date.now()}.${ext}`;
                const upload = await client.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
                if (upload.error) throw upload.error;
                const publicUrl = client.storage.from("avatars").getPublicUrl(path).data.publicUrl;
                avatarUrl = publicUrl;
            }
            const { error } = await client.from("profiles").update({ full_name: name, mobile: mobile || null, avatar_url: avatarUrl, address: address || null }).eq("id", state.user.id);
            if (error) throw error;
            const { error: authError } = await client.auth.updateUser({ data: { full_name: name, mobile } });
            if (authError) throw authError;
            state.profile = { ...state.profile, full_name: name, mobile: mobile || null, avatar_url: avatarUrl, address: address || null };
            applyHeader();
            show("Profile updated successfully.");
            $("profileAvatar").value = "";
        } catch (error) {
            console.error(error);
            show("Unable to update profile. Please try again.", "error");
        } finally { button.disabled = false; button.textContent = "Save Changes"; }
    };

    const updatePasswordRules = () => {
        const p = $("newPassword").value, c = $("confirmPassword").value;
        const rules = {
            length: p.length >= 8,
            upper: /[A-Z]/.test(p),
            lower: /[a-z]/.test(p),
            number: /\d/.test(p),
            special: /[^A-Za-z0-9]/.test(p),
            match: p.length > 0 && p === c
        };
        Object.entries(rules).forEach(([key, ok]) => {
            const el = document.querySelector(`[data-rule="${key}"]`);
            if (el) el.textContent = `${ok ? "✓" : "✗"} ${el.textContent.replace(/^[✓✗]\s*/, "")}`;
            if (el) el.classList.toggle("valid", ok);
        });
        return rules;
    };

    const changePassword = async () => {
        const current = $("currentPassword").value, p = $("newPassword").value, c = $("confirmPassword").value;
        const rules = updatePasswordRules();
        if (!Object.values(rules).every(Boolean)) return show("Please satisfy all password requirements.", "error");
        const button = $("savePasswordBtn");
        button.disabled = true; button.textContent = "Changing Password...";
        try {
            // Re-authenticate with the current password before changing it.
            const { error: signInError } = await client.auth.signInWithPassword({ email: state.user.email, password: current });
            if (signInError) throw new Error("Current password is incorrect.");
            const { error } = await client.auth.updateUser({ password: p });
            if (error) throw error;
            $("passwordForm").reset(); updatePasswordRules();
            try {
                await client.from("notifications").insert({
                    owner_id: state.user.id,
                    title: "Password changed",
                    message: "Your My-Kids-Hub account password was changed successfully.",
                    notification_type: "success"
                });
            } catch (_) {}
            show("Password changed successfully.");
        } catch (error) {
            console.error(error);
            show(error.message === "Current password is incorrect." ? error.message : "Password change failed.", "error");
        } finally { button.disabled = false; button.textContent = "Change Password"; }
    };

    const savePreferences = async () => {
        const preferences = {
            ...state.preferences,
            email_notifications: $("emailNotifications").checked,
            sms_notifications: $("smsNotifications").checked,
            theme: $("themePreference").value,
            language: $("preferenceLanguage").value,
            date_format: $("dateFormat").value,
            time_format: $("timeFormat").value
        };
        const button = $("savePreferencesBtn");
        button.disabled = true; button.textContent = "Saving...";
        try {
            const { error } = await client.from("profiles").update({ preferences }).eq("id", state.user.id);
            if (error) throw error;
            state.preferences = preferences;
            localStorage.setItem("mykidshub-theme", preferences.theme);
            localStorage.setItem("mykidshub-language", preferences.language);
            document.body.classList.toggle("theme-dark", preferences.theme === "dark");
            window.dispatchEvent(new CustomEvent("mykidshub:theme-changed", { detail: { theme: preferences.theme } }));
            show("Preferences saved successfully.");
        } catch (error) { console.error(error); show("Unable to update account settings.", "error"); }
        finally { button.disabled = false; button.textContent = "Save Account Settings"; }
    };

    const saveSchool = async event => {
        event.preventDefault();
        const button = $("saveSchoolBtn"); button.disabled = true; button.textContent = "Saving...";
        try {
            const { error } = await client.from("profiles").update({
                school_name: $("schoolName").value.trim() || null,
                school_phone: $("schoolPhone").value.trim() || null,
                school_email: $("schoolEmail").value.trim() || null,
                school_address: $("schoolAddress").value.trim() || null
            }).eq("id", state.user.id);
            if (error) throw error;
            show("School information saved successfully.");
        } catch (error) { console.error(error); show("Unable to update school information.", "error"); }
        finally { button.disabled = false; button.textContent = "Save School Information"; }
    };

    const load2FA = async () => {
        try {
            const { data, error } = await client.auth.mfa.listFactors();
            if (error) throw error;
            const verified = (data?.totp || []).find(f => f.status === "verified");
            state.factorId = verified?.id || null; state.factorType = verified?.factor_type || null;
            $("twoFactorStatus").textContent = verified ? "Status: Enabled" : "Status: Disabled";
            $("twoFactorBtn").textContent = verified ? "Manage / Disable 2FA" : "Enable 2FA";
        } catch (error) {
            $("twoFactorStatus").textContent = "2FA status unavailable.";
            console.warn("2FA unavailable:", error);
        }
    };

    const manage2FA = async () => {
        try {
            if (state.factorId) {
                const code = prompt("Enter your current authenticator code to disable 2FA.");
                if (!code) return;
                const challenge = await client.auth.mfa.challenge({ factorId: state.factorId });
                if (challenge.error) throw challenge.error;
                const verify = await client.auth.mfa.verify({ factorId: state.factorId, challengeId: challenge.data.id, code });
                if (verify.error) throw verify.error;
                const unenroll = await client.auth.mfa.unenroll({ factorId: state.factorId });
                if (unenroll.error) throw unenroll.error;
                show("Two-factor authentication disabled.");
                await load2FA();
                return;
            }
            const enroll = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "My-Kids-Hub Authenticator" });
            if (enroll.error) throw enroll.error;
            state.factorId = enroll.data.id;
            $("twoFactorModalText").textContent = "Scan the QR code with your authenticator app, then enter the 6-digit code.";
            $("twoFactorQr").innerHTML = `<img src="${enroll.data.totp.qr_code}" alt="Authenticator QR code" style="max-width:220px;width:100%;">`;
            $("twoFactorCode").value = "";
            $("twoFactorModal").hidden = false;
            $("twoFactorConfirmBtn").onclick = async () => {
                const code = $("twoFactorCode").value.trim();
                if (!/^\d{6}$/.test(code)) return show("Enter the 6-digit verification code.", "error");
                const challenge = await client.auth.mfa.challenge({ factorId: state.factorId });
                if (challenge.error) throw challenge.error;
                const verify = await client.auth.mfa.verify({ factorId: state.factorId, challengeId: challenge.data.id, code });
                if (verify.error) throw verify.error;
                $("twoFactorModal").hidden = true;
                show("Two-factor authentication enabled.");
                await load2FA();
            };
        } catch (error) { console.error(error); show("Unable to update two-factor authentication.", "error"); }
    };

    const logoutOthers = async () => {
        const ok = window.confirm("Log out of all other active sessions?");
        if (!ok) return;
        const button = $("logoutOtherSessionsBtn"); button.disabled = true; button.textContent = "Logging out...";
        try {
            const { error } = await client.auth.signOut({ scope: "others" });
            if (error) throw error;
            show("Other sessions were logged out successfully.");
        } catch (error) { console.error(error); show("Unable to log out other sessions.", "error"); }
        finally { button.disabled = false; button.textContent = "Logout Other Sessions"; }
    };

    try {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (!data?.session?.user) { window.location.replace("index.html"); return; }
        state.user = data.session.user;
        await loadProfile();
        await load2FA();
    } catch (error) {
        console.error(error); show("Unable to load account settings.", "error");
    }

    $("profileForm")?.addEventListener("submit", e => { e.preventDefault(); updateProfile(); });
    $("schoolForm")?.addEventListener("submit", saveSchool);
    $("passwordForm")?.addEventListener("submit", e => { e.preventDefault(); changePassword(); });
    $("newPassword")?.addEventListener("input", updatePasswordRules);
    $("confirmPassword")?.addEventListener("input", updatePasswordRules);
    $("profileAvatar")?.addEventListener("change", event => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
            event.target.value = "";
            return show("Use PNG, JPEG or WebP and keep the photo within 2 MB.", "error");
        }
        const url = URL.createObjectURL(file);
        const preview = $("profileAvatarPreview");
        const img = document.createElement("img");
        img.src = url; img.alt = "Profile preview";
        img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;";
        preview.textContent = ""; preview.appendChild(img);
        img.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
    });
    $("saveAccountBtn")?.addEventListener("click", savePreferences);
    $("savePreferencesBtn")?.addEventListener("click", async () => {
        const lang = $("preferenceLanguage").value;
        localStorage.setItem("mykidshub-language", lang);
        if (window.location.hash !== "#preferencesSettingsSection") history.replaceState(null, "", "#preferencesSettingsSection");
        await savePreferences();
    });
    $("twoFactorBtn")?.addEventListener("click", manage2FA);
    $("logoutOtherSessionsBtn")?.addEventListener("click", logoutOthers);
    document.querySelectorAll("[data-close-modal]").forEach(btn => btn.addEventListener("click", () => { const id = btn.dataset.closeModal; if ($(id)) $(id).hidden = true; }));
})();
