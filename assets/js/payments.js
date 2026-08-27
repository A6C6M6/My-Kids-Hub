(async () => {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const state = { client: null, user: null, students: [], studentFees: [], payments: [], editingId: null };

    const money = (value) => `₹ ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
    const displayName = (student) => `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Unnamed Student";
    const methodLabel = (method) => ({cash:"Cash",upi:"UPI",card:"Card",bank_transfer:"Bank Transfer",cheque:"Cheque",online:"Online",other:"Other"}[method] || method || "—");
    const today = () => new Date().toISOString().slice(0,10);

    const showMessage = (message, type = "success") => {
        const el = $("paymentMessage");
        el.textContent = message || "";
        el.className = message ? `payment-message ${type}` : "payment-message";
    };
    const formError = (message = "") => { $("paymentFormError").textContent = message; };

    const ensureClient = async () => {
        if (window.supabaseClient?.auth) return window.supabaseClient;
        if (!window.supabase?.createClient) throw new Error("Authentication service is not available. Please try again later.");
        const url = "https://ibsqupjmuytjxoybstdw.supabase.co";
        const key = atob("c2JfcHVibGlzaGFibGVfRGxST1Rpd2I2dTVFaEtvNloxMnRmUV91cWhSLVJVOA==");
        window.supabaseClient = window.supabase.createClient(url, key, { auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:false, flowType:"pkce" } });
        return window.supabaseClient;
    };

    const setUserUI = (user) => {
        const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email || "User";
        const initials = name.trim().slice(0,2).toUpperCase();
        document.querySelectorAll(".user-info strong, .profile-text strong").forEach(el => el.textContent = name);
        document.querySelectorAll(".avatar").forEach(el => el.textContent = initials);
    };

    const loadStudents = async () => {
        const { data, error } = await state.client.from("students").select("id, first_name, last_name, admission_number, class_name, status").order("first_name", { ascending:true });
        if (error) throw error;
        state.students = data || [];
        const options = state.students.map(s => `<option value="${esc(s.id)}">${esc(displayName(s))}${s.admission_number ? ` — ${esc(s.admission_number)}` : ""}</option>`).join("");
        $("studentFilter").innerHTML = `<option value="">All Students</option>${options}`;
        $("paymentStudent").innerHTML = `<option value="">Select student</option>${options}`;
    };

    const loadStudentFees = async (studentId = "") => {
        let query = state.client.from("student_fees").select("id, student_id, fee_name, amount, discount_amount, final_amount, due_date, academic_year, status").order("created_at", { ascending:false });
        if (studentId) query = query.eq("student_id", studentId);
        const { data, error } = await query;
        if (error) throw error;
        state.studentFees = data || [];
        const options = state.studentFees.map(f => `<option value="${esc(f.id)}">${esc(f.fee_name || "Fee")} — ${money(f.final_amount ?? f.amount)}</option>`).join("");
        $("paymentStudentFee").innerHTML = `<option value="">No linked fee</option>${options}`;
    };

    const loadPayments = async () => {
        const { data, error } = await state.client.from("payments").select("id, owner_id, student_id, student_fee_id, amount, payment_method, payment_date, transaction_reference, remarks, received_by, created_at").order("payment_date", { ascending:false }).order("created_at", { ascending:false });
        if (error) throw error;
        state.payments = data || [];
        renderPayments();
    };

    const renderPayments = () => {
        const studentFilter = $("studentFilter").value;
        const methodFilter = $("methodFilter").value;
        const from = $("fromDateFilter").value;
        const to = $("toDateFilter").value;
        const filtered = state.payments.filter(p => (!studentFilter || p.student_id === studentFilter) && (!methodFilter || p.payment_method === methodFilter) && (!from || p.payment_date >= from) && (!to || p.payment_date <= to));
        const body = $("paymentsTableBody");
        $("paymentCount").textContent = state.payments.length;
        $("totalReceived").textContent = money(state.payments.reduce((sum,p) => sum + Number(p.amount || 0),0));
        const currentDay = today();
        const todayPayments = state.payments.filter(p => p.payment_date === currentDay);
        $("todayPaymentCount").textContent = todayPayments.length;
        $("todayReceived").textContent = money(todayPayments.reduce((sum,p) => sum + Number(p.amount || 0),0));
        $("paymentEmptyState").hidden = filtered.length !== 0;
        if (!filtered.length) {
            body.innerHTML = `<tr><td colspan="7" class="table-state">No payment records match the selected filters.</td></tr>`;
            return;
        }
        body.innerHTML = filtered.map(p => {
            const student = state.students.find(s => s.id === p.student_id);
            return `<tr>
                <td><span class="student-name">${esc(student ? displayName(student) : "Unknown Student")}</span>${student?.class_name ? `<span class="student-meta">${esc(student.class_name)}</span>` : ""}</td>
                <td class="amount-cell">${money(p.amount)}</td>
                <td><span class="method-badge">${esc(methodLabel(p.payment_method))}</span></td>
                <td>${esc(p.payment_date || "—")}</td>
                <td>${esc(p.transaction_reference || "—")}</td>
                <td>${esc(p.received_by || "—")}</td>
                <td><div class="action-group"><button class="table-action" type="button" title="View" data-action="view" data-id="${esc(p.id)}"><i class="fa-regular fa-eye"></i></button><button class="table-action" type="button" title="Edit" data-action="edit" data-id="${esc(p.id)}"><i class="fa-solid fa-pen"></i></button><button class="table-action" type="button" title="Delete" data-action="delete" data-id="${esc(p.id)}"><i class="fa-regular fa-trash-can"></i></button></div></td>
            </tr>`;
        }).join("");
    };

    const openModal = (payment = null, readOnly = false) => {
        state.editingId = payment?.id || null;
        $("paymentModal").hidden = false;
        $("paymentModalTitle").textContent = readOnly ? "View Payment" : (payment ? "Edit Payment" : "Record Payment");
        $("paymentModalKicker").textContent = readOnly ? "PAYMENT DETAILS" : (payment ? "EDIT PAYMENT" : "NEW PAYMENT");
        formError("");
        $("paymentForm").reset();
        $("paymentDate").value = today();
        $("paymentStudentFee").innerHTML = `<option value="">No linked fee</option>`;
        if (payment) {
            $("paymentStudent").value = payment.student_id || "";
            $("paymentAmount").value = payment.amount ?? "";
            $("paymentMethod").value = payment.payment_method || "cash";
            $("paymentDate").value = payment.payment_date || today();
            $("transactionReference").value = payment.transaction_reference || "";
            $("receivedBy").value = payment.received_by || "";
            $("paymentRemarks").value = payment.remarks || "";
        }
        loadStudentFees(payment?.student_id || "").then(() => { if (payment?.student_fee_id) $("paymentStudentFee").value = payment.student_fee_id; }).catch(error => formError(error.message));
        const fields = $("paymentForm").querySelectorAll("input, select, textarea");
        fields.forEach(field => field.disabled = readOnly);
        $("savePaymentBtn").hidden = readOnly;
        $("cancelPaymentBtn").textContent = readOnly ? "Close" : "Cancel";
    };

    const closeModal = () => { $("paymentModal").hidden = true; state.editingId = null; $("paymentForm").querySelectorAll("input, select, textarea").forEach(field => field.disabled = false); $("savePaymentBtn").hidden = false; $("cancelPaymentBtn").textContent = "Cancel"; };

    const savePayment = async (event) => {
        event.preventDefault();
        formError("");
        const studentId = $("paymentStudent").value;
        const amount = Number($("paymentAmount").value);
        if (!studentId) return formError("Please select a student.");
        if (!Number.isFinite(amount) || amount <= 0) return formError("Please enter a valid payment amount.");
        if (!$("paymentDate").value) return formError("Payment date is required.");
        const isEdit = Boolean(state.editingId);
        const payload = { student_id:studentId, student_fee_id:$("paymentStudentFee").value || null, amount, payment_method:$("paymentMethod").value, payment_date:$("paymentDate").value, transaction_reference:$("transactionReference").value.trim() || null, remarks:$("paymentRemarks").value.trim() || null, received_by:$("receivedBy").value.trim() || null };
        const btn = $("savePaymentBtn"); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        try {
            let response;
            if (state.editingId) response = await state.client.from("payments").update(payload).eq("id", state.editingId).select().single();
            else response = await state.client.from("payments").insert({...payload, owner_id:state.user.id}).select().single();
            if (response.error) throw response.error;
            closeModal(); await loadPayments(); showMessage(isEdit ? "Payment updated successfully." : "Payment recorded successfully.");
        } catch (error) { console.error("My-Kids-Hub payment save failed:", error); formError(error.message || "Unable to save payment."); }
        finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Payment'; }
    };

    const deletePayment = async (payment) => {
        if (!confirm(`Delete this payment of ${money(payment.amount)}? This action cannot be undone.`)) return;
        const { error } = await state.client.from("payments").delete().eq("id", payment.id);
        if (error) { showMessage(error.message || "Unable to delete payment.", "error"); return; }
        await loadPayments(); showMessage("Payment deleted successfully.");
    };

    const initialize = async () => {
        try {
            state.client = await ensureClient();
            const { data, error } = await state.client.auth.getSession();
            if (error) throw error;
            if (!data?.session?.user) { window.location.replace("index.html"); return; }
            state.user = data.session.user; setUserUI(state.user);
            document.querySelectorAll(".logout-btn").forEach(btn => btn.addEventListener("click", async (event) => { event.preventDefault(); await state.client.auth.signOut(); window.location.replace("index.html"); }));
            const sidebar = $("sidebar"), menuToggle = $("menuToggle");
            if (menuToggle && sidebar) menuToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
            await loadStudents();
            await loadStudentFees();
            await loadPayments();
        } catch (error) {
            console.error("My-Kids-Hub payments initialization failed:", error);
            showMessage(error.message || "Unable to load payments.", "error");
            $("paymentsTableBody").innerHTML = `<tr><td colspan="7" class="table-state">Unable to load payments.</td></tr>`;
        }
    };

    $("recordPaymentBtn").addEventListener("click", () => openModal());
    $("emptyRecordPaymentBtn").addEventListener("click", () => openModal());
    $("refreshPaymentsBtn").addEventListener("click", async () => { try { showMessage(""); await loadStudents(); await loadStudentFees(); await loadPayments(); showMessage("Payments refreshed."); } catch (error) { showMessage(error.message, "error"); } });
    $("closePaymentModalBtn").addEventListener("click", closeModal);
    $("cancelPaymentBtn").addEventListener("click", closeModal);
    $("paymentForm").addEventListener("submit", savePayment);
    $("paymentStudent").addEventListener("change", async (event) => { try { await loadStudentFees(event.target.value); } catch (error) { formError(error.message); } });
    ["studentFilter","methodFilter","fromDateFilter","toDateFilter"].forEach(id => $(id).addEventListener("change", renderPayments));
    $("paymentsTableBody").addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]"); if (!button) return;
        const payment = state.payments.find(p => p.id === button.dataset.id); if (!payment) return;
        if (button.dataset.action === "view") openModal(payment, true);
        if (button.dataset.action === "edit") openModal(payment, false);
        if (button.dataset.action === "delete") deletePayment(payment).catch(error => showMessage(error.message, "error"));
    });
    $("paymentModal").addEventListener("click", (event) => { if (event.target === $("paymentModal")) closeModal(); });

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once:true }); else initialize();
})();
