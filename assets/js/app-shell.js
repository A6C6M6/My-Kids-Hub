/* My-Kids-Hub shared authenticated application shell. */
(async () => {
    "use strict";

    const client = window.supabaseClient;
    if (!client?.auth) return;

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
    const escapeHtml = (value) => String(value ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    const initials = (name) => String(name || "User").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase() || "US";
    const formatDate = (value) => {
        if (!value) return "—";
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    };

    let session;
    try {
        const result = await client.auth.getSession();
        if (result.error) throw result.error;
        session = result.data?.session;
    } catch (error) {
        console.error("My-Kids-Hub shell session error:", error);
        return;
    }
    if (!session?.user) {
        window.location.replace("index.html");
        return;
    }

    const user = session.user;
    let profileData = {};
    try {
        const { data } = await client.from("profiles")
            .select("full_name,mobile,avatar_url,role")
            .eq("id", user.id)
            .maybeSingle();
        profileData = data || {};
    } catch (_) {}

    const displayName = profileData.full_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email || "User";
    const role = profileData.role === "admin" ? "Administrator" : (profileData.role === "staff" ? "Staff" : (profileData.role === "parent" ? "Parent" : (user.user_metadata?.role || "Administrator")));
    const avatarUrl = profileData.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || "";

    const renderHeaderIdentity = (name = displayName, roleName = role, imageUrl = avatarUrl) => {
        const safeName = name || user.email || "User";
        const safeInitials = initials(safeName);
        $$(".user-info strong, .profile-text strong").forEach(el => el.textContent = safeName);
        $$(".user-info span:not(.status-dot), .profile-text span").forEach(el => {
            if (["administrator","user","staff","parent"].includes(el.textContent.trim().toLowerCase()) || !el.textContent.trim()) el.textContent = roleName;
        });
        $$(".avatar").forEach(el => {
            el.textContent = safeInitials;
            el.style.background = el.style.background || "#0056b3";
            el.style.overflow = "hidden";
            if (imageUrl) {
                el.innerHTML = `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(safeName)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
                el.querySelector("img")?.addEventListener("error", () => {
                    el.innerHTML = escapeHtml(safeInitials);
                }, { once: true });
            }
        });
    };
    renderHeaderIdentity();
    const pageDescription = $(".topbar-left p");
    if (pageDescription && document.title.startsWith("Dashboard")) pageDescription.textContent = `Welcome back, ${displayName}! Here's what's happening today.`;

    const page = window.location.pathname.split("/").pop() || "dashboard.html";
    const navTranslations = {
        en: { Dashboard: "Dashboard", Students: "Students", Parents: "Parents", "Fee Management": "Fee Management", Payments: "Payments", Reports: "Reports", Reminders: "Reminders", Calendar: "Calendar", Settings: "Settings", Logout: "Logout" },
        ml: { Dashboard: "ഡാഷ്ബോർഡ്", Students: "വിദ്യാർത്ഥികൾ", Parents: "രക്ഷിതാക്കൾ", "Fee Management": "ഫീസ് മാനേജ്മെന്റ്", Payments: "പേയ്മെന്റുകൾ", Reports: "റിപ്പോർട്ടുകൾ", Reminders: "റിമൈൻഡറുകൾ", Calendar: "കലണ്ടർ", Settings: "സെറ്റിംഗ്സ്", Logout: "ലോഗൗട്ട്" }
    };

    const language = localStorage.getItem("mykidshub-language") || "en";
    const applyLanguage = (lang) => {
        const dictionary = navTranslations[lang] || navTranslations.en;
        $$(".sidebar-nav .nav-item").forEach(item => {
            const textNode = Array.from(item.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
            if (!textNode) return;
            const key = item.dataset.shellLabel || textNode.textContent.trim();
            item.dataset.shellLabel = key;
            textNode.textContent = ` ${dictionary[key] || key}`;
        });
        const logout = $(".logout-btn");
        if (logout) {
            const textNode = Array.from(logout.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
            if (textNode) {
                logout.dataset.shellLabel = "Logout";
                textNode.textContent = ` ${dictionary.Logout}`;
            }
        }
        document.documentElement.lang = lang === "ml" ? "ml" : "en";
        localStorage.setItem("mykidshub-language", lang);
    };

    const insertShellControls = () => {
        const topRight = $(".topbar-right");
        if (!topRight || $("#shellControls")) return;
        const controls = document.createElement("div");
        controls.id = "shellControls";
        controls.className = "shell-control-group";
        controls.innerHTML = `
            <button class="shell-control" id="shellThemeToggle" type="button" title="Toggle Theme" aria-label="Toggle Theme"><i class="fa-solid fa-moon"></i></button>
            <select class="shell-language" id="shellLanguage" title="Language" aria-label="Language"><option value="en">English</option><option value="ml">മലയാളം</option></select>`;
        topRight.prepend(controls);

        const bell = $(".bell-btn");
        if (bell) {
            const wrap = document.createElement("div");
            wrap.className = "shell-bell-wrap";
            bell.parentNode.insertBefore(wrap, bell);
            wrap.appendChild(bell);
            bell.id = "shellBellBtn";
            if (!bell.querySelector(".shell-badge")) bell.insertAdjacentHTML("beforeend", '<span class="shell-badge" id="shellNotificationBadge" hidden>0</span>');
        }

        const profile = $(".profile-chip");
        if (profile) profile.id = "shellProfileChip";
    };

    insertShellControls();
    applyLanguage(language);
    if ($("#shellLanguage")) $("#shellLanguage").value = language;

    const overlayClose = () => $(".shell-overlay")?.remove();
    const closePopovers = () => {
        overlayClose();
        $(".shell-popover")?.remove();
        $("#shellProfileChip")?.setAttribute("aria-expanded", "false");
    };

    const sidebar = $("#sidebar");
    const menuToggle = $("#menuToggle");
    const setSidebarState = (collapsed) => {
        document.body.classList.toggle("sidebar-collapsed", collapsed);
        localStorage.setItem("mykidshub-sidebar-collapsed", collapsed ? "1" : "0");
        if (menuToggle) {
            menuToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
            menuToggle.setAttribute("title", collapsed ? "Expand Sidebar" : "Collapse Sidebar");
            menuToggle.setAttribute("aria-label", collapsed ? "Expand Sidebar" : "Collapse Sidebar");
        }
    };
    if (localStorage.getItem("mykidshub-sidebar-collapsed") === "1" && window.innerWidth > 860) setSidebarState(true);
    else if (menuToggle) {
        menuToggle.setAttribute("aria-expanded", "true");
        menuToggle.setAttribute("title", "Collapse Sidebar");
        menuToggle.setAttribute("aria-label", "Collapse Sidebar");
    }
    menuToggle?.addEventListener("click", () => {
        if (window.innerWidth <= 860) return;
        setSidebarState(!document.body.classList.contains("sidebar-collapsed"));
    });
    window.addEventListener("resize", () => {
        if (window.innerWidth <= 860) {
            document.body.classList.remove("sidebar-collapsed");
            if (menuToggle) {
                menuToggle.setAttribute("aria-expanded", sidebar?.classList.contains("open") ? "true" : "false");
                menuToggle.setAttribute("title", "Open / Close Sidebar");
                menuToggle.setAttribute("aria-label", "Open / Close Sidebar");
            }
        } else {
            const saved = localStorage.getItem("mykidshub-sidebar-collapsed") === "1";
            setSidebarState(saved);
            sidebar?.classList.remove("open");
        }
    });

    const theme = localStorage.getItem("mykidshub-theme") || "light";
    if (theme === "dark") document.body.classList.add("theme-dark");
    const updateThemeIcon = () => {
        const icon = $("#shellThemeToggle i");
        if (icon) icon.className = `fa-solid ${document.body.classList.contains("theme-dark") ? "fa-sun" : "fa-moon"}`;
    };
    updateThemeIcon();
    $("#shellThemeToggle")?.addEventListener("click", () => {
        document.body.classList.toggle("theme-dark");
        localStorage.setItem("mykidshub-theme", document.body.classList.contains("theme-dark") ? "dark" : "light");
        updateThemeIcon();
    });
    $("#shellLanguage")?.addEventListener("change", event => applyLanguage(event.target.value));

    const createPopover = (className = "") => {
        closePopovers();
        const popover = document.createElement("div");
        popover.className = `shell-popover ${className}`;
        document.body.appendChild(popover);
        return popover;
    };
    const positionPopover = (popover, anchor, align = "right") => {
        const r = anchor.getBoundingClientRect();
        const width = Math.min(popover.offsetWidth || 300, window.innerWidth - 20);
        let left = align === "left" ? r.left : r.right - width;
        left = Math.max(10, Math.min(left, window.innerWidth - width - 10));
        popover.style.left = `${left}px`;
        popover.style.top = `${Math.min(window.innerHeight - 20, r.bottom + 10)}px`;
    };

    const confirmLogout = async () => {
        const ok = window.confirm("Are you sure you want to logout?");
        if (!ok) return false;
        try {
            const { error } = await client.auth.signOut();
            if (error) throw error;
        } catch (error) {
            console.error("Logout failed:", error);
            alert("Unable to logout. Please try again.");
            return false;
        }
        try {
            sessionStorage.clear();
            localStorage.removeItem("mykidshub-current-user");
        } catch (_) {}
        window.location.replace("index.html");
        return true;
    };

    const buildProfileMenu = () => {
        const chip = $("#shellProfileChip");
        if (!chip) return;
        chip.setAttribute("role", "button");
        chip.setAttribute("tabindex", "0");
        chip.setAttribute("aria-haspopup", "menu");
        chip.setAttribute("aria-expanded", "false");

        const toggle = (event) => {
            event?.stopPropagation();
            const existing = $(".shell-profile-menu");
            if (existing) {
                closePopovers();
                chip.setAttribute("aria-expanded", "false");
                return;
            }
            const popover = createPopover("shell-profile-menu");
            popover.setAttribute("role", "menu");
            popover.innerHTML = `<div class="shell-profile-summary">
                    <div class="shell-profile-summary-avatar">${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)}">` : escapeHtml(initials(displayName))}</div>
                    <div><strong>${escapeHtml(displayName)}</strong><span>${escapeHtml(role)}</span><small>${escapeHtml(user.email || "")}</small></div>
                </div>
                <ul class="shell-popover-list">
                    <li><a href="settings.html#profileSettingsSection"><i class="fa-solid fa-user"></i><span>Profile Settings</span></a></li>
                    <li><a href="settings.html#accountSettingsSection"><i class="fa-solid fa-shield-halved"></i><span>Account Settings</span></a></li>
                    <li><a href="settings.html#passwordSettingsSection"><i class="fa-solid fa-key"></i><span>Change Password</span></a></li>
                    <li><a href="settings.html#preferencesSettingsSection"><i class="fa-solid fa-sliders"></i><span>Preferences</span></a></li>
                    <li class="shell-menu-divider"><button id="shellLogoutBtn" type="button" class="shell-logout-item"><i class="fa-solid fa-arrow-right-from-bracket"></i><span>Logout</span></button></li>
                </ul>`;
            positionPopover(popover, chip);
            chip.setAttribute("aria-expanded", "true");
            $("#shellLogoutBtn")?.addEventListener("click", confirmLogout);
        };
        chip.addEventListener("click", toggle);
        chip.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(event); }
            if (event.key === "Escape") { closePopovers(); chip.setAttribute("aria-expanded", "false"); }
        });
    };
    buildProfileMenu();
    $$(".logout-btn").forEach(btn => btn.addEventListener("click", event => { event.preventDefault(); confirmLogout(); }));

    const getFeeNotifications = async () => {
        const today = new Date();
        const start = today.toISOString().slice(0, 10);
        const endDate = new Date(today); endDate.setDate(endDate.getDate() + 7);
        const end = endDate.toISOString().slice(0, 10);
        const [feesResult, paymentsResult, studentResult] = await Promise.all([
            client.from("student_fees").select("id, student_id, fee_name, final_amount, due_date, status").not("due_date", "is", null).lte("due_date", end).gte("due_date", start),
            client.from("payments").select("student_fee_id, amount"),
            client.from("students").select("id, first_name, last_name")
        ]);
        if (feesResult.error) throw feesResult.error;
        const payments = paymentsResult.data || [];
        const students = new Map((studentResult.data || []).map(s => [s.id, [s.first_name, s.last_name].filter(Boolean).join(" ") || "Student"]));
        const paid = new Map();
        payments.forEach(p => paid.set(p.student_fee_id, (paid.get(p.student_fee_id) || 0) + Number(p.amount || 0)));
        return (feesResult.data || []).map(f => ({
            title: `${f.fee_name || "Fee"} due`,
            message: `${students.get(f.student_id) || "Student"} — due ${formatDate(f.due_date)}`,
            date: f.due_date,
            severity: Number(f.final_amount || 0) - (paid.get(f.id) || 0) > 0 ? "due" : "paid"
        })).filter(n => n.severity === "due");
    };

    const loadNotifications = async () => {
        const items = [];
        try {
            const { data, error } = await client.from("notifications").select("id, title, message, created_at, read_at").order("created_at", { ascending: false }).limit(10);
            if (!error) (data || []).forEach(n => items.push({ title: n.title || "School Alert", message: n.message || "", date: n.created_at, unread: !n.read_at }));
        } catch (error) {
            console.warn("My-Kids-Hub notifications table unavailable:", error);
        }
        try { items.push(...(await getFeeNotifications()).map(n => ({ ...n, unread: true }))); } catch (error) { console.warn("My-Kids-Hub fee notifications unavailable:", error); }
        items.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
        const badge = $("#shellNotificationBadge");
        const unread = items.filter(i => i.unread).length;
        if (badge) { badge.textContent = unread > 99 ? "99+" : String(unread); badge.hidden = unread === 0; }
        return items.slice(0, 10);
    };

    const openNotifications = async () => {
        const bell = $("#shellBellBtn");
        if (!bell) return;
        const popover = createPopover();
        popover.innerHTML = `<div class="shell-popover-head"><strong>Notifications</strong><span>Live fee and school alerts</span></div><ul class="shell-popover-list"><li class="shell-empty">Loading...</li></ul>`;
        positionPopover(popover, bell);
        try {
            const items = await loadNotifications();
            const list = $(".shell-popover-list", popover);
            list.innerHTML = items.length ? items.map(item => `<li><div class="shell-notification-item"><span class="shell-notification-dot"></span><div class="shell-notification-text"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.message)}${item.date ? ` · ${escapeHtml(formatDate(item.date))}` : ""}</small></div></div></li>`).join("") : '<li class="shell-empty">No active notifications.</li>';
        } catch (error) {
            $(".shell-popover-list", popover).innerHTML = '<li class="shell-empty">Unable to load notifications.</li>';
        }
    };
    $("#shellBellBtn")?.addEventListener("click", event => { event.stopPropagation(); openNotifications(); });
    $(document).addEventListener("click", event => {
        if (!event.target.closest(".shell-popover") && !event.target.closest("#shellBellBtn") && !event.target.closest("#shellProfileChip")) closePopovers();
    });
    $(document).addEventListener("keydown", event => {
        if (event.key === "Escape") closePopovers();
    });
    window.addEventListener("resize", closePopovers);

    try { await loadNotifications(); } catch (_) {}

    const subscribe = () => {
        try {
            const channel = client.channel("mykidshub-live-shell")
                .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => window.dispatchEvent(new CustomEvent("mykidshub:data-changed", { detail: { table: "notifications" } })))
                .on("postgres_changes", { event: "*", schema: "public", table: "student_fees" }, () => window.dispatchEvent(new CustomEvent("mykidshub:data-changed", { detail: { table: "student_fees" } })))
                .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => window.dispatchEvent(new CustomEvent("mykidshub:data-changed", { detail: { table: "payments" } })))
                .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, () => window.dispatchEvent(new CustomEvent("mykidshub:data-changed", { detail: { table: "calendar_events" } })))
                .subscribe(status => { if (status === "CHANNEL_ERROR") console.warn("My-Kids-Hub realtime channel unavailable."); });
            window.addEventListener("beforeunload", () => client.removeChannel(channel), { once: true });
        } catch (error) { console.warn("My-Kids-Hub realtime setup unavailable:", error); }
    };
    subscribe();

    // Layered protection for authenticated pages after logout/back navigation.
    const protectHistory = () => {
        try {
            if (window.history && window.history.replaceState) {
                window.history.replaceState({ myKidsHubProtected: true }, document.title, window.location.href);
            }
            window.addEventListener("pageshow", async event => {
                if (!event.persisted) return;
                const { data } = await client.auth.getSession();
                if (!data?.session?.user) window.location.replace("index.html");
            });
            window.addEventListener("popstate", async () => {
                const { data } = await client.auth.getSession();
                if (!data?.session?.user) window.location.replace("index.html");
            });
        } catch (_) {}
    };
    protectHistory();

    client.auth.onAuthStateChange((event, nextSession) => {
        if ((event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") && !nextSession) window.location.replace("index.html");
    });

})();
