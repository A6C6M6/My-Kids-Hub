// My-Kids-Hub Students management.
// Keeps the existing authentication client and Supabase students table intact.
(async () => {
    "use strict";

    const state = {
        client: null,
        user: null,
        students: [],
        editingId: null
    };

    const $ = (id) => document.getElementById(id);

    const sidebar = $("sidebar");
    const menuToggle = $("menuToggle");
    if (menuToggle && sidebar) {
        menuToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
    }

    const showMessage = (message, type = "success") => {
        const el = $("studentMessage");
        if (!el) return;
        el.textContent = message;
        el.className = `student-message show ${type}`;
        window.clearTimeout(showMessage.timer);
        showMessage.timer = window.setTimeout(() => {
            el.className = "student-message";
            el.textContent = "";
        }, 4500);
    };

    const showFormError = (message = "") => {
        const el = $("studentFormError");
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

    const initials = (student) => {
        const first = (student.first_name || "").trim();
        const last = (student.last_name || "").trim();
        return ((first.charAt(0) || "S") + (last.charAt(0) || "")).toUpperCase();
    };

    const fullName = (student) => [student.first_name, student.last_name].filter(Boolean).join(" ").trim();

    const formatStatus = (status) => status || "active";

    const renderStudents = () => {
        const body = $("studentsTableBody");
        const empty = $("studentEmptyState");
        const count = $("studentCount");
        if (!body || !empty || !count) return;

        const filtered = state.students;

        count.textContent = String(state.students.length);

        if (!filtered.length) {
            body.innerHTML = "";
            empty.hidden = false;
            return;
        }

        empty.hidden = true;
        body.innerHTML = filtered.map((student) => {
            const name = fullName(student) || "Unnamed Student";
            const classDivision = [student.class_name, student.division].filter(Boolean).join(" - ") || "—";
            const parent = student.parent_name || "—";
            const mobile = student.parent_mobile || "";
            const school = student.school_name || "—";
            const statusValue = formatStatus(student.status);
            return `
                <tr>
                    <td>${escapeHtml(student.admission_number || "—")}</td>
                    <td>
                        <div class="student-name">
                            <span class="student-avatar">${escapeHtml(initials(student))}</span>
                            <div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(student.parent_email || "")}</span></div>
                        </div>
                    </td>
                    <td>${escapeHtml(classDivision)}</td>
                    <td>${escapeHtml(school)}</td>
                    <td><strong>${escapeHtml(parent)}</strong><br><span class="student-subtle">${escapeHtml(mobile || "—")}</span></td>
                    <td><span class="status-pill ${escapeHtml(statusValue)}"><i class="fa-solid fa-circle" style="font-size:6px"></i>${escapeHtml(statusValue)}</span></td>
                    <td>
                        <div class="action-group">
                            <button class="table-action" type="button" data-action="view" data-id="${escapeHtml(student.id)}" title="View"><i class="fa-regular fa-eye"></i></button>
                            <button class="table-action" type="button" data-action="edit" data-id="${escapeHtml(student.id)}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                            <button class="table-action delete" type="button" data-action="delete" data-id="${escapeHtml(student.id)}" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
                        </div>
                    </td>
                </tr>`;
        }).join("");
    };

    const getSession = async (client) => {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        return data?.session || null;
    };

    const loadStudents = async () => {
        const body = $("studentsTableBody");
        if (body) body.innerHTML = '<tr><td colspan="7" class="table-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading students...</td></tr>';
        try {
            const { data, error } = await state.client
                .from("students")
                .select("id, owner_id, admission_number, first_name, last_name, date_of_birth, gender, class_name, division, school_name, parent_name, parent_mobile, parent_email, address, status, created_at, updated_at")
                .order("created_at", { ascending: false });
            if (error) throw error;
            state.students = data || [];
            renderStudents();
        } catch (error) {
            console.error("My-Kids-Hub students load failed:", error);
            state.students = [];
            renderStudents();
            showMessage(error.message || "Unable to load students.", "error");
        }
    };

    const setFormDisabled = (disabled) => {
        document.querySelectorAll("#studentForm input, #studentForm select, #studentForm textarea, #studentForm button").forEach(el => {
            if (el.id !== "cancelStudentBtn" && el.id !== "closeStudentModalBtn") el.disabled = disabled;
        });
    };

    const resetForm = () => {
        $("studentForm")?.reset();
        $("studentId").value = "";
        $("status").value = "active";
        showFormError("");
    };

    const openModal = (student = null, readOnly = false) => {
        const modal = $("studentModal");
        if (!modal) return;
        state.editingId = student?.id || null;
        resetForm();

        $("studentModalKicker").textContent = readOnly ? "STUDENT DETAILS" : (student ? "EDIT STUDENT" : "NEW STUDENT");
        $("studentModalTitle").textContent = readOnly ? "Student Details" : (student ? "Edit Student" : "Add Student");

        if (student) {
            $("studentId").value = student.id || "";
            $("firstName").value = student.first_name || "";
            $("lastName").value = student.last_name || "";
            $("admissionNumber").value = student.admission_number || "";
            $("dateOfBirth").value = student.date_of_birth || "";
            $("gender").value = student.gender || "";
            $("className").value = student.class_name || "";
            $("division").value = student.division || "";
            $("schoolName").value = student.school_name || "";
            $("parentName").value = student.parent_name || "";
            $("parentMobile").value = student.parent_mobile || "";
            $("parentEmail").value = student.parent_email || "";
            $("status").value = student.status || "active";
            $("address").value = student.address || "";
        }

        setFormDisabled(readOnly);
        $("saveStudentBtn").style.display = readOnly ? "none" : "inline-flex";
        $("cancelStudentBtn").textContent = readOnly ? "Close" : "Cancel";
        modal.hidden = false;
        document.body.classList.add("modal-open");
        if (!readOnly) $("firstName").focus();
    };

    const closeModal = () => {
        const modal = $("studentModal");
        if (!modal) return;
        modal.hidden = true;
        document.body.classList.remove("modal-open");
        state.editingId = null;
        resetForm();
        setFormDisabled(false);
        $("saveStudentBtn").style.display = "inline-flex";
        $("cancelStudentBtn").textContent = "Cancel";
    };

    const collectForm = () => ({
        first_name: $("firstName").value.trim(),
        last_name: $("lastName").value.trim() || null,
        admission_number: $("admissionNumber").value.trim() || null,
        date_of_birth: $("dateOfBirth").value || null,
        gender: $("gender").value || null,
        class_name: $("className").value.trim() || null,
        division: $("division").value.trim() || null,
        school_name: $("schoolName").value.trim() || null,
        parent_name: $("parentName").value.trim() || null,
        parent_mobile: $("parentMobile").value.trim() || null,
        parent_email: $("parentEmail").value.trim() || null,
        address: $("address").value.trim() || null,
        status: $("status").value || "active"
    });

    const saveStudent = async (event) => {
        event.preventDefault();
        showFormError("");
        const payload = collectForm();
        if (!payload.first_name) {
            showFormError("First Name is required.");
            $("firstName").focus();
            return;
        }
        if (payload.parent_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.parent_email)) {
            showFormError("Please enter a valid parent email address.");
            $("parentEmail").focus();
            return;
        }

        const isEdit = Boolean(state.editingId);
        const saveButton = $("saveStudentBtn");
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
            let response;
            if (state.editingId) {
                response = await state.client.from("students").update(payload).eq("id", state.editingId).select().single();
            } else {
                response = await state.client.from("students").insert({ ...payload, owner_id: state.user.id }).select().single();
            }
            if (response.error) throw response.error;
            closeModal();
            await loadStudents();
            showMessage(isEdit ? "Student updated successfully." : "Student added successfully.");
        } catch (error) {
            console.error("My-Kids-Hub student save failed:", error);
            showFormError(error.message || "Unable to save student.");
        } finally {
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Student';
        }
    };

    const deleteStudent = async (student) => {
        const name = fullName(student) || "this student";
        if (!window.confirm(`Delete ${name}? This action cannot be undone.`)) return;
        try {
            const { error } = await state.client.from("students").delete().eq("id", student.id);
            if (error) throw error;
            await loadStudents();
            showMessage("Student deleted successfully.");
        } catch (error) {
            console.error("My-Kids-Hub student delete failed:", error);
            showMessage(error.message || "Unable to delete student.", "error");
        }
    };

    const initialize = async () => {
        try {
            if (!window.supabaseClient?.auth) {
                throw new Error("Authentication service is not available. Please try again later.");
            }
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

            document.querySelectorAll(".logout-btn").forEach(btn => btn.addEventListener("click", async (event) => {
                event.preventDefault();
                try { await state.client.auth.signOut(); } finally { window.location.replace("index.html"); }
            }));

            $("addStudentBtn")?.addEventListener("click", () => openModal());
            $("emptyAddStudentBtn")?.addEventListener("click", () => openModal());
            $("refreshStudentsBtn")?.addEventListener("click", loadStudents);
            $("studentForm")?.addEventListener("submit", saveStudent);
            $("closeStudentModalBtn")?.addEventListener("click", closeModal);
            $("cancelStudentBtn")?.addEventListener("click", closeModal);
            $("studentModal")?.addEventListener("click", (event) => {
                if (event.target === $("studentModal")) closeModal();
            });
            document.addEventListener("keydown", (event) => {
                if (event.key === "Escape" && !$("studentModal").hidden) closeModal();
            });

            $("studentsTableBody")?.addEventListener("click", (event) => {
                const button = event.target.closest("button[data-action]");
                if (!button) return;
                const student = state.students.find(item => item.id === button.dataset.id);
                if (!student) return;
                if (button.dataset.action === "view") openModal(student, true);
                if (button.dataset.action === "edit") openModal(student, false);
                if (button.dataset.action === "delete") deleteStudent(student);
            });

            await loadStudents();
        } catch (error) {
            console.error("My-Kids-Hub students initialization failed:", error);
            showMessage(error.message || "Unable to load the Students page.", "error");
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
})();
