// My-Kids-Hub Dashboard authentication + live Supabase dashboard data.
// Existing dashboard UI/layout is preserved; sample data is replaced at runtime.
(async () => {
    "use strict";

    const SUPABASE_URL = window.MY_KIDS_HUB_SUPABASE_URL;
    const SUPABASE_ANON_KEY = window.MY_KIDS_HUB_SUPABASE_ANON_KEY;

    const state = {
        client: null,
        user: null,
        students: [],
        studentFees: [],
        payments: [],
        events: [],
        reminders: [],
        calendarCursor: new Date()
    };

    let paymentChartInstance = null;
    let feeDonutInstance = null;

    const $ = (id) => document.getElementById(id);
    const money = (value) => new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(value || 0));
    const escapeHtml = (value) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const fullName = (student) => [student?.first_name, student?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || "Unnamed Student";

    const initials = (name) => String(name || "User")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0])
        .join("")
        .toUpperCase() || "US";

    const dateKey = (date) => {
        const d = date instanceof Date ? date : new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    const parseDate = (value) => {
        if (!value) return null;
        const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
        if (!year || !month || !day) return null;
        return new Date(year, month - 1, day);
    };

    const formatDate = (value) => {
        const date = parseDate(value);
        return date ? date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
    };

    const loadSupabaseLibrary = () => new Promise((resolve, reject) => {
        if (window.supabase) {
            resolve();
            return;
        }
        const existing = document.querySelector("script[data-mykidshub-supabase]");
        if (existing) {
            existing.addEventListener("load", resolve, { once: true });
            existing.addEventListener("error", reject, { once: true });
            return;
        }
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        script.async = false;
        script.dataset.mykidshubSupabase = "true";
        script.onload = resolve;
        script.onerror = () => reject(new Error("Supabase library could not be loaded."));
        document.head.appendChild(script);
    });

    const ensureSupabaseClient = async () => {
        if (window.supabaseClient?.auth) return window.supabaseClient;
        await loadSupabaseLibrary();
        if (!window.supabase?.createClient) throw new Error("Supabase client library is unavailable.");
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                flowType: "pkce"
            }
        });
        return window.supabaseClient;
    };

    const getValidSession = async (client, timeoutMs = 10000) => {
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
            try {
                const { data, error } = await client.auth.getSession();
                if (!error && data?.session) return data.session;
            } catch (error) {
                console.warn("My-Kids-Hub dashboard session retry:", error);
            }
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        return null;
    };

    const redirectToLogin = () => {
        if (!window.location.pathname.endsWith("/dashboard.html")) return;
        window.location.replace("index.html");
    };

    const setUserUI = (user) => {
        const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "User";
        const userInitials = initials(displayName);
        document.querySelectorAll(".user-info strong, .profile-text strong").forEach(el => { el.textContent = displayName; });
        document.querySelectorAll(".avatar").forEach(el => { el.textContent = userInitials; });
        const subtitle = document.querySelector(".topbar-left p");
        if (subtitle) subtitle.textContent = `Welcome back, ${displayName}! Here's what's happening today.`;
    };

    const setupNavigation = () => {
        document.querySelectorAll(".logout-btn").forEach(btn => {
            btn.addEventListener("click", async (event) => {
                event.preventDefault();
                try { await state.client.auth.signOut(); }
                finally { window.location.replace("index.html"); }
            });
        });
        const sidebar = $("sidebar");
        const menuToggle = $("menuToggle");
        if (menuToggle && sidebar) menuToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
        const prev = $("dashboardPrevMonthBtn");
        const next = $("dashboardNextMonthBtn");
        if (prev) prev.addEventListener("click", () => {
            state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() - 1, 1);
            renderDashboardCalendar();
        });
        if (next) next.addEventListener("click", () => {
            state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() + 1, 1);
            renderDashboardCalendar();
        });
    };

    const loadDashboardData = async () => {
        const [studentsResult, feesResult, paymentsResult, eventsResult, remindersResult] = await Promise.allSettled([
            state.client.from("students").select("id, first_name, last_name, class_name, division, school_name, status"),
            state.client.from("student_fees").select("id, student_id, fee_structure_id, fee_name, amount, discount_amount, final_amount, due_date, academic_year, status"),
            state.client.from("payments").select("id, student_id, student_fee_id, amount, payment_method, payment_date, transaction_reference, created_at"),
            state.client.from("calendar_events").select("id, title, description, event_date, start_time, end_time, event_type").order("event_date", { ascending: true }),
            state.client.from("reminders").select("id, student_id, student_fee_id, title, message, reminder_date, status, sent_at, created_at").order("reminder_date", { ascending: false })
        ]);

        const required = [studentsResult, feesResult, paymentsResult];
        for (const result of required) {
            if (result.status === "rejected") throw result.reason;
            if (result.value.error) throw result.value.error;
        }

        state.students = studentsResult.value.data || [];
        state.studentFees = feesResult.value.data || [];
        state.payments = paymentsResult.value.data || [];
        state.events = eventsResult.status === "fulfilled" && !eventsResult.value.error ? (eventsResult.value.data || []) : [];
        state.reminders = remindersResult.status === "fulfilled" && !remindersResult.value.error ? (remindersResult.value.data || []) : [];

        if (eventsResult.status === "fulfilled" && eventsResult.value.error) console.warn("Dashboard calendar data unavailable:", eventsResult.value.error);
        if (remindersResult.status === "fulfilled" && remindersResult.value.error) console.warn("Dashboard reminder data unavailable:", remindersResult.value.error);

        renderSummaryCards();
        renderUpcomingDue();
        renderRecentPayments();
        renderDashboardCalendar();
        renderUpcomingEvents();
        renderCharts();
        renderRecentReminders();
    };

    const getPaidByFee = () => {
        const paidByFee = new Map();
        state.payments.forEach(payment => {
            if (!payment.student_fee_id) return;
            paidByFee.set(payment.student_fee_id, (paidByFee.get(payment.student_fee_id) || 0) + Number(payment.amount || 0));
        });
        return paidByFee;
    };

    const getOutstandingFee = (fee, paidByFee) => Math.max(Number(fee.final_amount ?? Number(fee.amount || 0) - Number(fee.discount_amount || 0)) - (paidByFee.get(fee.id) || 0), 0);

    const markLoaded = (id) => {
        const el = $(id);
        if (el) { el.classList.remove("loading-list", "loading-calendar"); el.removeAttribute("aria-busy"); }
    };

    const renderSummaryCards = () => {
        const paidByFee = getPaidByFee();
        const totalDue = state.studentFees.reduce((sum, fee) => sum + getOutstandingFee(fee, paidByFee), 0);
        const totalPaid = state.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const dueStudents = new Set(state.studentFees.filter(fee => getOutstandingFee(fee, paidByFee) > 0).map(fee => fee.student_id));
        const paidStudents = new Set(state.payments.map(payment => payment.student_id).filter(Boolean));
        const today = parseDate(dateKey(new Date()));
        const sevenDays = new Date(today);
        sevenDays.setDate(sevenDays.getDate() + 7);
        const upcomingStudents = new Set(state.studentFees.filter(fee => {
            const dueDate = parseDate(fee.due_date);
            return dueDate && dueDate >= today && dueDate <= sevenDays && getOutstandingFee(fee, paidByFee) > 0;
        }).map(fee => fee.student_id));

        $("totalDueAmount").textContent = money(totalDue);
        $("totalDueSub").textContent = `From ${dueStudents.size} Students`;
        $("totalPaidAmount").textContent = money(totalPaid);
        $("totalPaidSub").textContent = `From ${paidStudents.size} Students`;
        $("totalStudentsCount").textContent = String(state.students.length);
        $("upcomingDueCount").textContent = String(upcomingStudents.size);
        if ($("feeTotalCollected")) $("feeTotalCollected").textContent = money(totalPaid);
        if ($("feeTotalDue")) $("feeTotalDue").textContent = money(totalDue);
    };

    const renderUpcomingDue = () => {
        const list = $("upcomingDueList");
        if (!list) return;
        markLoaded("upcomingDueList");
        const paidByFee = getPaidByFee();
        const today = parseDate(dateKey(new Date()));
        const sevenDays = new Date(today);
        sevenDays.setDate(sevenDays.getDate() + 7);
        const studentsMap = new Map(state.students.map(student => [student.id, student]));
        const rows = state.studentFees
            .map(fee => ({ fee, outstanding: getOutstandingFee(fee, paidByFee), student: studentsMap.get(fee.student_id) }))
            .filter(item => {
                const dueDate = parseDate(item.fee.due_date);
                return dueDate && dueDate >= today && dueDate <= sevenDays && item.outstanding > 0;
            })
            .sort((a, b) => String(a.fee.due_date).localeCompare(String(b.fee.due_date)))
            .slice(0, 3);

        if (!rows.length) {
            list.innerHTML = '<li><div class="row-info"><strong>No upcoming dues</strong><span>No outstanding fees are due in the next 7 days.</span></div></li>';
            return;
        }

        list.innerHTML = rows.map(({ fee, outstanding, student }, index) => {
            const name = fullName(student);
            const school = student?.school_name ? ` - ${student.school_name}` : "";
            const cls = student?.class_name ? `Class ${student.class_name}${student.division ? `-${student.division}` : ""}${school}` : (student?.school_name || "");
            return `<li>
                <div class="avatar avatar-sm" style="background:${["#ffd9a0","#c9e6ff","#ffd0da"][index % 3]};">${escapeHtml(initials(name))}</div>
                <div class="row-info">
                    <strong>${escapeHtml(name)}</strong>
                    <span>${escapeHtml(cls || fee.fee_name || "Student")}</span>
                </div>
                <div class="row-meta">
                    <span class="row-date">${escapeHtml(formatDate(fee.due_date))}</span>
                    <strong class="amt-due">${escapeHtml(money(outstanding))}</strong>
                    <span class="tag tag-due">Due</span>
                </div>
            </li>`;
        }).join("");
    };

    const renderRecentPayments = () => {
        const list = $("recentPaymentsList");
        if (!list) return;
        markLoaded("recentPaymentsList");
        const studentsMap = new Map(state.students.map(student => [student.id, student]));
        const feeMap = new Map(state.studentFees.map(fee => [fee.id, fee]));
        const rows = [...state.payments]
            .sort((a, b) => String(b.payment_date || b.created_at || "").localeCompare(String(a.payment_date || a.created_at || "")))
            .slice(0, 3);
        if (!rows.length) {
            list.innerHTML = '<li><div class="row-info"><strong>No recent payments</strong><span>No payment transactions have been recorded yet.</span></div></li>';
            return;
        }
        list.innerHTML = rows.map((payment, index) => {
            const student = studentsMap.get(payment.student_id);
            const name = fullName(student);
            const fee = feeMap.get(payment.student_fee_id);
            const label = fee?.fee_name || "Fee Payment";
            return `<li>
                <div class="avatar avatar-sm" style="background:${["#ffd9a0","#c9e6ff","#d8d3ff"][index % 3]};">${escapeHtml(initials(name))}</div>
                <div class="row-info">
                    <strong>${escapeHtml(name)}</strong>
                    <span>${escapeHtml(label)}</span>
                </div>
                <div class="row-meta">
                    <span class="row-date">${escapeHtml(formatDate(payment.payment_date))}</span>
                    <strong class="amt-paid">${escapeHtml(money(payment.amount))}</strong>
                    <span class="tag tag-paid">Paid</span>
                </div>
            </li>`;
        }).map(html => html).join("");
    };

    const calendarConfig = window.MY_KIDS_HUB_CALENDAR || {};
    const currentCalendarLanguage = () => localStorage.getItem("mykidshub-language") || "en";
    const calendarMonthName = (month, lang) => calendarConfig.months?.[lang]?.[month] || new Date(2026, month, 1).toLocaleDateString(lang === "ml" ? "ml-IN" : "en-IN", { month: "long" });
    const calendarWeekdayName = (day, lang) => calendarConfig.weekdays?.[lang]?.[day] || ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day];
    const getCalendarDayStatus = (date, lang = currentCalendarLanguage()) => calendarConfig.getDayStatus ? calendarConfig.getDayStatus(date, lang) : { type: "working", label: "" };

    const renderDashboardCalendar = () => {
        const body = $("dashboardCalendarBody");
        const title = $("dashboardCalendarTitle");
        const table = $("dashboardCalendarTable");
        if (!body || !title) return;
        markLoaded("dashboardCalendarBody");
        const year = state.calendarCursor.getFullYear();
        const month = state.calendarCursor.getMonth();
        const lang = currentCalendarLanguage();
        title.textContent = `${calendarMonthName(month, lang)} ${year}`;
        if (table) {
            const headerCells = table.querySelectorAll("thead th");
            const weekStartsOn = Number.isInteger(calendarConfig.weekStartsOn) ? calendarConfig.weekStartsOn : 0;
            for (let index = 0; index < 7; index++) {
                const day = (weekStartsOn + index) % 7;
                if (headerCells[index]) headerCells[index].textContent = calendarWeekdayName(day, lang);
            }
        }
        const first = new Date(year, month, 1);
        const last = new Date(year, month + 1, 0);
        const weekStartsOn = Number.isInteger(calendarConfig.weekStartsOn) ? calendarConfig.weekStartsOn : 0;
        const startOffset = (first.getDay() - weekStartsOn + 7) % 7;
        const daysInMonth = last.getDate();
        const previousMonthLast = new Date(year, month, 0).getDate();
        const todayKey = dateKey(new Date());
        const paidByFee = getPaidByFee();
        const cells = [];
        for (let i = startOffset - 1; i >= 0; i--) {
            const day = previousMonthLast - i;
            cells.push({ date: new Date(year, month - 1, day), muted: true });
        }
        for (let day = 1; day <= daysInMonth; day++) cells.push({ date: new Date(year, month, day), muted: false });
        let nextDay = 1;
        while (cells.length % 7 !== 0) cells.push({ date: new Date(year, month + 1, nextDay++), muted: true });
        const html = [];
        for (let i = 0; i < cells.length; i += 7) {
            html.push(`<tr>${cells.slice(i, i + 7).map(cell => {
                const key = dateKey(cell.date);
                const status = getCalendarDayStatus(cell.date, lang);
                const hasEvent = state.events.some(event => event.event_date === key);
                const hasDue = state.studentFees.some(fee => fee.due_date === key && getOutstandingFee(fee, paidByFee) > 0);
                const marker = hasEvent || hasDue ? "<i></i>" : "";
                const classes = [key === todayKey ? "today" : "", status.type === "holiday" ? "holiday" : "working", cell.muted ? "muted" : ""].filter(Boolean).join(" ");
                const style = cell.muted ? ' style="color:#c7ccd6;"' : "";
                const label = status.label ? ` title="${escapeHtml(status.label)}"` : "";
                return `<td class="${classes}"${style}${label}>${cell.date.getDate()}${marker}</td>`;
            }).join("")}</tr>`);
        }
        body.innerHTML = html.join("");
    };

    const renderUpcomingEvents = () => {
        const list = $("dashboardUpcomingEvents");
        if (!list) return;
        markLoaded("dashboardUpcomingEvents");
        const paidByFee = getPaidByFee();
        const today = parseDate(dateKey(new Date()));
        const limit = new Date(today);
        limit.setDate(limit.getDate() + 30);
        const items = [];
        state.events.forEach(event => {
            const date = parseDate(event.event_date);
            if (date && date >= today && date <= limit) items.push({ date: event.event_date, title: event.title, type: "event", color: "dot-blue" });
        });
        const lang = currentCalendarLanguage();
        Object.entries(calendarConfig.holidays || {}).forEach(([dateValue, title]) => {
            const date = parseDate(dateValue);
            const label = title?.[lang] || title?.en || title;
            if (date && date >= today && date <= limit) items.push({ date: dateValue, title: label, type: "holiday", color: "dot-amber" });
        });
        state.studentFees.forEach(fee => {
            const date = parseDate(fee.due_date);
            if (date && date >= today && date <= limit && getOutstandingFee(fee, paidByFee) > 0) items.push({ date: fee.due_date, title: `${fee.fee_name} Due`, type: "fee", color: "dot-green" });
        });
        for (let d = new Date(today); d <= limit; d.setDate(d.getDate() + 1)) {
            const status = getCalendarDayStatus(d, lang);
            const key = dateKey(d);
            if (status.type === "holiday" && !calendarConfig.holidays?.[key]) items.push({ date: key, title: status.label, type: "holiday", color: "dot-amber" });
        }
        items.sort((a, b) => String(a.date).localeCompare(String(b.date)));
        const unique = [];
        const seen = new Set();
        for (const item of items) {
            const key = `${item.date}|${item.title}`;
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(item);
            if (unique.length === 3) break;
        }
        if (!unique.length) {
            list.innerHTML = '<li><span class="dot dot-blue"></span> No upcoming events <span class="ev-date">—</span></li>';
            return;
        }
        list.innerHTML = unique.map(item => `<li><span class="dot ${item.color}"></span> ${escapeHtml(item.title)} <span class="ev-date">${escapeHtml(formatDate(item.date))}</span></li>`).join("");
    };

    const renderCharts = () => {
        if (!window.Chart) return;
        const paymentCtx = $("paymentChart");
        const donutCtx = $("feeDonut");
        const today = new Date();
        const months = [];
        for (let i = 5; i >= 0; i--) months.push(new Date(today.getFullYear(), today.getMonth() - i, 1));
        const labels = months.map(date => date.toLocaleDateString("en-IN", { month: "short" }));
        const monthKeys = months.map(date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
        const paid = monthKeys.map(key => state.payments.filter(p => String(p.payment_date || "").slice(0, 7) === key).reduce((sum, p) => sum + Number(p.amount || 0), 0));
        const paidByFee = getPaidByFee();
        const due = monthKeys.map(key => state.studentFees.filter(f => String(f.due_date || "").slice(0, 7) === key).reduce((sum, f) => sum + getOutstandingFee(f, paidByFee), 0));
        if (paymentCtx) {
            if (paymentChartInstance) paymentChartInstance.destroy();
            const gradient = paymentCtx.getContext("2d").createLinearGradient(0, 0, 0, 220);
            gradient.addColorStop(0, "rgba(31, 111, 214, 0.28)");
            gradient.addColorStop(1, "rgba(31, 111, 214, 0)");
            paymentChartInstance = new Chart(paymentCtx, {
                type: "line",
                data: { labels, datasets: [
                    { label: "Amount Paid", data: paid, borderColor: "#1f6fd6", backgroundColor: gradient, borderWidth: 2.5, pointBackgroundColor: "#1f6fd6", pointBorderColor: "#fff", pointBorderWidth: 2, pointRadius: 4, tension: 0.4, fill: true },
                    { label: "Amount Due", data: due, borderColor: "#9ec5f5", backgroundColor: "transparent", borderWidth: 2, pointRadius: 3, tension: 0.4, fill: false }
                ] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: {
                    y: { beginAtZero: true, ticks: { callback: value => value === 0 ? "0" : `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`, color: "#7a8494", font: { size: 11 } }, grid: { color: "#f0f2f7" } },
                    x: { ticks: { color: "#7a8494", font: { size: 11 } }, grid: { display: false } }
                } }
            });
        }

        if (donutCtx) {
            const groups = [
                { label: "Tuition Fee", match: /tuition/i },
                { label: "Transport Fee", match: /transport/i },
                { label: "Books & Others", match: /book/i },
                { label: "Other Fee", match: /.*/ }
            ];
            const totals = groups.map(group => state.studentFees.filter(fee => group.match.test(fee.fee_name || "")).reduce((sum, fee) => sum + Number(fee.final_amount || 0), 0));
            const total = totals.reduce((sum, value) => sum + value, 0);
            if (feeDonutInstance) feeDonutInstance.destroy();
            feeDonutInstance = new Chart(donutCtx, { type: "doughnut", data: { labels: groups.map(g => g.label), datasets: [{ data: total ? totals : [1, 0, 0, 0], backgroundColor: ["#1f6fd6", "#24a866", "#f2a91d", "#8b6cf2"], borderWidth: 0, hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: "68%", plugins: { legend: { display: false } } } });
            const legend = $("feeLegend");
            if (legend) {
                legend.classList.remove("loading-list");
                legend.removeAttribute("aria-busy");
                legend.innerHTML = groups.map((group, index) => {
                    const percent = total ? Math.round((totals[index] / total) * 100) : 0;
                    const dot = ["dot-blue", "dot-green", "dot-amber", "dot-purple"][index];
                    return `<li><span class="dot ${dot}"></span> ${escapeHtml(group.label)} <strong>${percent}%</strong></li>`;
                }).join("");
            }
        }
    };

    const renderRecentReminders = () => {
        const list = $("recentRemindersList");
        if (!list) return;
        markLoaded("recentRemindersList");
        const studentsMap = new Map(state.students.map(student => [student.id, student]));
        const feeMap = new Map(state.studentFees.map(fee => [fee.id, fee]));
        const rows = [...state.reminders].sort((a, b) => String(b.reminder_date || b.created_at || "").localeCompare(String(a.reminder_date || a.created_at || ""))).slice(0, 3);
        if (!rows.length) {
            list.innerHTML = '<li><span class="reminder-icon rm-blue"><i class="fa-solid fa-bell"></i></span><div class="row-info"><strong>No recent reminders</strong><span>No reminder records have been created yet.</span></div></li>';
            return;
        }
        list.innerHTML = rows.map((reminder, index) => {
            const student = studentsMap.get(reminder.student_id);
            const fee = feeMap.get(reminder.student_fee_id);
            const title = reminder.title || `Fee Reminder - ${fullName(student)}`;
            const subtitle = fee?.fee_name || reminder.message || "Fee reminder";
            const status = reminder.status || "pending";
            const tagClass = status === "sent" ? "tag-sent" : "tag-due";
            return `<li>
                <span class="reminder-icon ${["rm-pink","rm-blue","rm-purple"][index % 3]}"><i class="fa-solid fa-bell"></i></span>
                <div class="row-info"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span></div>
                <div class="row-meta"><span class="row-date">${escapeHtml(formatDate(reminder.reminder_date))}</span><span class="tag ${tagClass}">${escapeHtml(status.charAt(0).toUpperCase() + status.slice(1))}</span></div>
            </li>`;
        }).join("");
    };

    const initializeDashboardAuth = async () => {
        try {
            state.client = await ensureSupabaseClient();
            const session = await getValidSession(state.client, 10000);
            if (!session?.user) {
                console.warn("My-Kids-Hub dashboard: no authenticated session found.");
                redirectToLogin();
                return;
            }
            state.user = session.user;
            setUserUI(state.user);
            setupNavigation();
            await loadDashboardData();
        } catch (error) {
            console.error("My-Kids-Hub dashboard initialization failed:", error);
            const message = document.createElement("div");
            message.textContent = error?.message || "Unable to load dashboard data.";
            message.style.cssText = "position:fixed;top:20px;right:20px;z-index:9999;padding:12px 16px;background:#fee2e2;color:#991b1b;border-radius:8px;font:600 14px Inter,sans-serif;";
            document.body.appendChild(message);
        }
    };

    window.addEventListener("mykidshub:language-changed", () => { renderDashboardCalendar(); renderUpcomingEvents(); });

    window.addEventListener("mykidshub:data-changed", (event) => {
        const table = event.detail?.table;
        if (["student_fees", "payments", "calendar_events", "notifications"].includes(table) && state.client && state.user) {
            loadDashboardData().catch(error => console.warn("My-Kids-Hub dashboard live refresh failed:", error));
        }
    });

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeDashboardAuth, { once: true });
    else initializeDashboardAuth();
})();
