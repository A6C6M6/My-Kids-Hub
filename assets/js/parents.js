// My-Kids-Hub Parents management.
// Uses the existing Supabase parents and student_parents tables without changing the database schema.
(async () => {
    "use strict";

    const state = {
        client: null,
        user: null,
        parents: [],
        students: [],
        links: [],
        editingId: null
    };

    const $ = (id) => document.getElementById(id);

    const sidebar = $("sidebar");
    const menuToggle = $("menuToggle");
    if (menuToggle && sidebar) {
        menuToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
    }

    const showMessage = (message, type = "success") => {
        const el = $("parentMessage");
        if (!el) return;
        el.textContent = message;
        el.className = `parent-message show ${type}`;
        window.clearTimeout(showMessage.timer);
        showMessage.timer = window.setTimeout(() => {
            el.className = "parent-message";
            el.textContent = "";
        }, 4500);
    };

    const showFormError = (message = "") => {
        const el = $("parentFormError");
        if (!el) return;
        el.textContent = message;
        el.classList.toggle("show", Boolean(message));
    };

    const escapeHtml = (value) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const fullStudentName = (student) => [student.first_name, student.last_name].filter(Boolean).join(" ").trim() || "Unnamed Student";
    const initials = (parent) => (parent.full_name || "Parent").trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join("").toUpperCase() || "P";

    const linkedStudents = (parentId) => {
        const ids = new Set(state.links.filter(link => link.parent_id === parentId).map(link => link.student_id));
        return state.students.filter(student => ids.has(student.id));
    };

    const renderStudentsForForm = (selectedIds = []) => {
        const container = $("studentLinkList");
        if (!container) return;
        if (!state.students.length) {
            container.innerHTML = '<div class="student-link-empty">No students are available yet. Add students first from the Students page.</div>';
            return;
        }
        const selected = new Set(selectedIds);
        container.innerHTML = state.students.map(student => {
            const id = escapeHtml(student.id);
            const name = escapeHtml(fullStudentName(student));
            const details = escapeHtml([student.admission_number, student.class_name, student.division].filter(Boolean).join(" • ") || "Student");
            return `<label class="student-link-option"><input type="checkbox" name="student_ids" value="${id}" ${selected.has(student.id) ? "checked" : ""}><span><strong>${name}</strong><small>${details}</small></span></label>`;
        }).join("");
    };

    const renderParents = () => {
        const body = $("parentsTableBody");
        const empty = $("parentEmptyState");
        const count = $("parentCount");
        if (!body || !empty || !count) return;
        count.textContent = String(state.parents.length);
        if (!state.parents.length) {
            body.innerHTML = "";
            empty.hidden = false;
            return;
        }
        empty.hidden = true;
        body.innerHTML = state.parents.map(parent => {
            const students = linkedStudents(parent.id);
            const studentTags = students.length
                ? `<div class="student-tags">${students.map(student => `<span class="student-tag">${escapeHtml(fullStudentName(student))}</span>`).join("")}</div>`
                : '<span class="parent-subtle">Not linked</span>';
            return `<tr>
                <td><div class="parent-name"><span class="parent-avatar">${escapeHtml(initials(parent))}</span><div><strong>${escapeHtml(parent.full_name)}</strong><span>${escapeHtml(parent.email || "")}</span></div></div></td>
                <td><span class="relationship-pill">${escapeHtml(parent.relationship || "—")}</span></td>
                <td><strong>${escapeHtml(parent.mobile || "—")}</strong><br><span class="parent-subtle">${escapeHtml(parent.occupation || "")}</span></td>
                <td>${studentTags}</td>
                <td>${escapeHtml(parent.address || "—")}</td>
                <td><div class="action-group">
                    <button class="table-action" type="button" data-action="view" data-id="${escapeHtml(parent.id)}" title="View"><i class="fa-regular fa-eye"></i></button>
                    <button class="table-action" type="button" data-action="edit" data-id="${escapeHtml(parent.id)}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="table-action delete" type="button" data-action="delete" data-id="${escapeHtml(parent.id)}" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
                </div></td>
            </tr>`;
        }).join("");
    };

    const getSession = async (client) => {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        return data?.session || null;
    };

    const loadData = async () => {
        const body = $("parentsTableBody");
        if (body) body.innerHTML = '<tr><td colspan="6" class="table-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading parents...</td></tr>';
        const [parentsResult, studentsResult, linksResult] = await Promise.all([
            state.client.from("parents").select("id, owner_id, full_name, mobile, email, relationship, occupation, address, created_at, updated_at").order("created_at", { ascending: false }),
            state.client.from("students").select("id, owner_id, first_name, last_name, admission_number, class_name, division").order("first_name", { ascending: true }),
            state.client.from("student_parents").select("id, student_id, parent_id, relationship, is_primary")
        ]);
        if (parentsResult.error) throw parentsResult.error;
        if (studentsResult.error) throw studentsResult.error;
        if (linksResult.error) throw linksResult.error;
        state.parents = parentsResult.data || [];
        state.students = studentsResult.data || [];
        state.links = linksResult.data || [];
        renderParents();
    };

    const setFormDisabled = (disabled) => {
        document.querySelectorAll("#parentForm input, #parentForm select, #parentForm textarea, #parentForm button").forEach(el => {
            if (el.id !== "cancelParentBtn" && el.id !== "closeParentModalBtn") el.disabled = disabled;
        });
    };

    const resetForm = () => {
        $("parentForm")?.reset();
        $("parentId").value = "";
        showFormError("");
        renderStudentsForForm([]);
    };

    const openModal = (parent = null, readOnly = false) => {
        const modal = $("parentModal");
        if (!modal) return;
        state.editingId = parent?.id || null;
        resetForm();
        $("parentModalKicker").textContent = readOnly ? "PARENT DETAILS" : (parent ? "EDIT PARENT" : "NEW PARENT");
        $("parentModalTitle").textContent = readOnly ? "Parent Details" : (parent ? "Edit Parent" : "Add Parent");
        if (parent) {
            $("parentId").value = parent.id || "";
            $("fullName").value = parent.full_name || "";
            $("mobile").value = parent.mobile || "";
            $("email").value = parent.email || "";
            $("relationship").value = parent.relationship || "";
            $("occupation").value = parent.occupation || "";
            $("address").value = parent.address || "";
            const selectedIds = state.links.filter(link => link.parent_id === parent.id).map(link => link.student_id);
            renderStudentsForForm(selectedIds);
        }
        setFormDisabled(readOnly);
        $("saveParentBtn").style.display = readOnly ? "none" : "inline-flex";
        $("cancelParentBtn").textContent = readOnly ? "Close" : "Cancel";
        modal.hidden = false;
        document.body.classList.add("modal-open");
        if (!readOnly) $("fullName").focus();
    };

    const closeModal = () => {
        const modal = $("parentModal");
        if (!modal) return;
        modal.hidden = true;
        document.body.classList.remove("modal-open");
        state.editingId = null;
        resetForm();
        setFormDisabled(false);
        $("saveParentBtn").style.display = "inline-flex";
        $("cancelParentBtn").textContent = "Cancel";
    };

    const collectForm = () => ({
        full_name: $("fullName").value.trim(),
        mobile: $("mobile").value.trim() || null,
        email: $("email").value.trim() || null,
        relationship: $("relationship").value || null,
        occupation: $("occupation").value.trim() || null,
        address: $("address").value.trim() || null,
        studentIds: [...document.querySelectorAll('input[name="student_ids"]:checked')].map(input => input.value)
    });

    const saveLinks = async (parentId, studentIds, relationship) => {
        const { error: deleteError } = await state.client.from("student_parents").delete().eq("parent_id", parentId);
        if (deleteError) throw deleteError;
        if (!studentIds.length) return;
        const rows = studentIds.map(studentId => ({
            student_id: studentId,
            parent_id: parentId,
            relationship: relationship || null,
            is_primary: false
        }));
        const { error: insertError } = await state.client.from("student_parents").insert(rows);
        if (insertError) throw insertError;
    };

    const saveParent = async (event) => {
        event.preventDefault();
        showFormError("");
        const payload = collectForm();
        if (!payload.full_name) {
            showFormError("Full Name is required.");
            $("fullName").focus();
            return;
        }
        if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
            showFormError("Please enter a valid email address.");
            $("email").focus();
            return;
        }
        const isEdit = Boolean(state.editingId);
        const saveButton = $("saveParentBtn");
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        try {
            let parentId = state.editingId;
            if (isEdit) {
                const { error } = await state.client.from("parents").update({
                    full_name: payload.full_name,
                    mobile: payload.mobile,
                    email: payload.email,
                    relationship: payload.relationship,
                    occupation: payload.occupation,
                    address: payload.address
                }).eq("id", parentId);
                if (error) throw error;
            } else {
                const { data, error } = await state.client.from("parents").insert({
                    owner_id: state.user.id,
                    full_name: payload.full_name,
                    mobile: payload.mobile,
                    email: payload.email,
                    relationship: payload.relationship,
                    occupation: payload.occupation,
                    address: payload.address
                }).select("id").single();
                if (error) throw error;
                parentId = data.id;
            }
            await saveLinks(parentId, payload.studentIds, payload.relationship);
            closeModal();
            await loadData();
            showMessage(isEdit ? "Parent updated successfully." : "Parent added successfully.");
        } catch (error) {
            console.error("My-Kids-Hub parent save failed:", error);
            showFormError(error.message || "Unable to save parent.");
        } finally {
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Parent';
        }
    };

    const deleteParent = async (parent) => {
        if (!window.confirm(`Delete ${parent.full_name || "this parent"}? This action cannot be undone.`)) return;
        try {
            const { error } = await state.client.from("parents").delete().eq("id", parent.id);
            if (error) throw error;
            await loadData();
            showMessage("Parent deleted successfully.");
        } catch (error) {
            console.error("My-Kids-Hub parent delete failed:", error);
            showMessage(error.message || "Unable to delete parent.", "error");
        }
    };

    const initialize = async () => {
        try {
            if (!window.supabaseClient?.auth) throw new Error("Authentication service is not available. Please try again later.");
            state.client = window.supabaseClient;
            const session = await getSession(state.client);
            if (!session?.user) {
                window.location.replace("index.html");
                return;
            }
            state.user = session.user;
            const displayName = state.user.user_metadata?.full_name || state.user.user_metadata?.name || state.user.email || "User";
            const userInitials = displayName.trim().slice(0, 2).toUpperCase();
            document.querySelectorAll(".user-info strong, .profile-text strong").forEach(el => el.textContent = displayName);
            document.querySelectorAll(".avatar").forEach(el => el.textContent = userInitials);

            document.querySelectorAll(".logout-btn").forEach(btn => btn.addEventListener("click", async event => {
                event.preventDefault();
                try { await state.client.auth.signOut(); } finally { window.location.replace("index.html"); }
            }));

            $("addParentBtn")?.addEventListener("click", () => openModal());
            $("emptyAddParentBtn")?.addEventListener("click", () => openModal());
            $("refreshParentsBtn")?.addEventListener("click", loadData);
            $("parentForm")?.addEventListener("submit", saveParent);
            $("closeParentModalBtn")?.addEventListener("click", closeModal);
            $("cancelParentBtn")?.addEventListener("click", closeModal);
            $("parentModal")?.addEventListener("click", event => { if (event.target === $("parentModal")) closeModal(); });
            document.addEventListener("keydown", event => { if (event.key === "Escape" && !$('parentModal').hidden) closeModal(); });
            $("parentsTableBody")?.addEventListener("click", event => {
                const button = event.target.closest("button[data-action]");
                if (!button) return;
                const parent = state.parents.find(item => item.id === button.dataset.id);
                if (!parent) return;
                if (button.dataset.action === "view") openModal(parent, true);
                if (button.dataset.action === "edit") openModal(parent, false);
                if (button.dataset.action === "delete") deleteParent(parent);
            });

            await loadData();
        } catch (error) {
            console.error("My-Kids-Hub parents initialization failed:", error);
            showMessage(error.message || "Unable to load the Parents page.", "error");
        }
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
    else initialize();
})();
