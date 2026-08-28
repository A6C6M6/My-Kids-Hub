// My-Kids-Hub Students management.
// Keeps the existing authentication client and Supabase students table intact.
(async () => {
    "use strict";

    const state = {
        client: null,
        user: null,
        students: [],
        editingId: null,
        selectedPhotoFile: null,
        readOnly: false
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

    const calculateAge = (dob) => {
        if (!dob) return "—";
        const birth = new Date(`${dob}T00:00:00`);
        if (Number.isNaN(birth.getTime())) return "—";
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const beforeBirthday = today.getMonth() < birth.getMonth() ||
            (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
        if (beforeBirthday) age -= 1;
        return age >= 0 ? String(age) : "—";
    };

    const formatDateTime = (value) => {
        if (!value) return "—";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "—";
        return date.toLocaleString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    };

    const updateStats = (students = state.students) => {
        const total = $("studentCount");
        const schools = $("schoolCount");
        const active = $("activeCount");
        const inactive = $("inactiveCount");
        const left = $("leftCount");
        if (total) total.textContent = String(state.students.length);
        if (schools) schools.textContent = String(new Set(state.students.map(s => (s.school_name || "").trim()).filter(Boolean)).size);
        if (active) active.textContent = String(state.students.filter(s => formatStatus(s.status) === "active").length);
        if (inactive) inactive.textContent = String(state.students.filter(s => formatStatus(s.status) === "inactive").length);
        if (left) left.textContent = String(state.students.filter(s => formatStatus(s.status) === "left").length);
        return students;
    };

    const populateFilters = () => {
        const classFilter = $("studentClassFilter");
        const schoolFilter = $("studentSchoolFilter");
        if (!classFilter || !schoolFilter) return;
        const currentClass = classFilter.value;
        const currentSchool = schoolFilter.value;
        const classes = [...new Set(state.students.map(s => (s.class_name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        const schools = [...new Set(state.students.map(s => (s.school_name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        classFilter.innerHTML = `<option value="">All Classes</option>${classes.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
        schoolFilter.innerHTML = `<option value="">All Schools</option>${schools.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
        classFilter.value = classes.includes(currentClass) ? currentClass : "";
        schoolFilter.value = schools.includes(currentSchool) ? currentSchool : "";
    };

    const filteredStudents = () => {
        const query = ($( "studentSearch")?.value || "").trim().toLowerCase();
        const classValue = $("studentClassFilter")?.value || "";
        const schoolValue = $("studentSchoolFilter")?.value || "";
        const statusValue = $("studentStatusFilter")?.value || "";
        return state.students.filter(student => {
            const searchable = [
                fullName(student),
                student.admission_number,
                student.school_name
            ].filter(Boolean).join(" ").toLowerCase();
            return (!query || searchable.includes(query)) &&
                (!classValue || (student.class_name || "") === classValue) &&
                (!schoolValue || (student.school_name || "") === schoolValue) &&
                (!statusValue || formatStatus(student.status) === statusValue);
        });
    };

    const renderStudents = () => {
        const body = $("studentsTableBody");
        const empty = $("studentEmptyState");
        const count = $("studentCount");
        const resultCount = $("studentResultCount");
        if (!body || !empty || !count) return;

        const filtered = filteredStudents();
        updateStats();
        if (resultCount) resultCount.textContent = `${filtered.length} shown`;

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
            const photo = student.photo_url
                ? `<img src="${escapeHtml(student.photo_url)}" alt="${escapeHtml(name)}" class="student-avatar-image">`
                : `<span class="student-avatar">${escapeHtml(initials(student))}</span>`;
            const restoreAction = statusValue !== "active"
                ? `<button class="table-action restore" type="button" data-action="activate" data-id="${escapeHtml(student.id)}" title="Set Active"><i class="fa-solid fa-rotate-left"></i></button>`
                : "";
            return `
                <tr>
                    <td>${escapeHtml(student.admission_number || "—")}</td>
                    <td>
                        <div class="student-name">
                            ${photo}
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
                            ${restoreAction}
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
            const fields = "id, owner_id, admission_number, first_name, last_name, date_of_birth, gender, class_name, division, school_name, parent_name, parent_mobile, parent_email, address, status, created_at, updated_at, photo_url";
            let response = await state.client.from("students").select(fields).order("created_at", { ascending: false });
            if (response.error && /photo_url|column/i.test(response.error.message || "")) {
                response = await state.client.from("students").select(fields.replace(", photo_url", "")).order("created_at", { ascending: false });
                showMessage("Student photo storage needs the supplied database migration.", "error");
            }
            if (response.error) throw response.error;
            state.students = response.data || [];
            populateFilters();
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

    const resetPhotoPreview = () => {
        const preview = $("studentPhotoPreview");
        if (!preview) return;
        preview.innerHTML = '<span class="student-photo-placeholder"><i class="fa-solid fa-user"></i></span>';
        state.selectedPhotoFile = null;
        if ($("studentPhoto")) $("studentPhoto").value = "";
    };

    const setPhotoPreview = (student = null) => {
        const preview = $("studentPhotoPreview");
        if (!preview) return;
        if (student?.photo_url) {
            preview.innerHTML = `<img src="${escapeHtml(student.photo_url)}" alt="${escapeHtml(fullName(student) || "Student")}" class="student-photo-preview-image">`;
        } else {
            preview.innerHTML = '<span class="student-photo-placeholder"><i class="fa-solid fa-user"></i></span>';
        }
    };

    const resetForm = () => {
        $("studentForm")?.reset();
        $("studentId").value = "";
        $("status").value = "active";
        $("age").value = "";
        $("createdDate").value = "";
        $("updatedDate").value = "";
        showFormError("");
        setPhotoPreview();
        state.selectedPhotoFile = null;
    };

    const openModal = (student = null, readOnly = false) => {
        const modal = $("studentModal");
        if (!modal) return;
        state.editingId = student?.id || null;
        state.readOnly = readOnly;
        resetForm();

        $("studentModalKicker").textContent = readOnly ? "STUDENT DETAILS" : (student ? "EDIT STUDENT" : "NEW STUDENT");
        $("studentModalTitle").textContent = readOnly ? "Student Details" : (student ? "Edit Student" : "Add Student");

        if (student) {
            $("studentId").value = student.id || "";
            $("firstName").value = student.first_name || "";
            $("lastName").value = student.last_name || "";
            $("admissionNumber").value = student.admission_number || "";
            $("dateOfBirth").value = student.date_of_birth || "";
            $("age").value = calculateAge(student.date_of_birth);
            $("gender").value = student.gender || "";
            $("className").value = student.class_name || "";
            $("division").value = student.division || "";
            $("schoolName").value = student.school_name || "";
            $("parentName").value = student.parent_name || "";
            $("parentMobile").value = student.parent_mobile || "";
            $("parentEmail").value = student.parent_email || "";
            $("status").value = student.status || "active";
            $("address").value = student.address || "";
            $("createdDate").value = formatDateTime(student.created_at);
            $("updatedDate").value = formatDateTime(student.updated_at);
            setPhotoPreview(student);
        }

        setFormDisabled(readOnly);
        if (readOnly && $("studentPhoto")) $("studentPhoto").disabled = false;
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
        state.readOnly = false;
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

    const uploadStudentPhoto = async (studentId, file) => {
        if (!file) return null;
        if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Student photo must be PNG, JPG/JPEG, or WebP.");
        if (file.size > 2 * 1024 * 1024) throw new Error("Student photo must be 2 MB or smaller.");
        const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
        const path = `${state.user.id}/${studentId}.${extension}`;
        const { error: uploadError } = await state.client.storage.from("student-photos").upload(path, file, {
            upsert: true,
            contentType: file.type,
            cacheControl: "3600"
        });
        if (uploadError) throw uploadError;
        const { data } = state.client.storage.from("student-photos").getPublicUrl(path);
        return data?.publicUrl || null;
    };

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

            let savedStudent = response.data;
            if (state.selectedPhotoFile) {
                const photoUrl = await uploadStudentPhoto(savedStudent.id, state.selectedPhotoFile);
                if (photoUrl) {
                    const photoUpdate = await state.client.from("students").update({ photo_url: photoUrl }).eq("id", savedStudent.id).select().single();
                    if (photoUpdate.error) throw photoUpdate.error;
                    savedStudent = photoUpdate.data;
                }
            }

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

    // Retained for backward compatibility with the existing Student management flow.
    // The Delete action is intentionally no longer rendered in the Students table.
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
            showMessage(error.message || "Unable to load student.", "error");
        }
    };

    const activateStudent = async (student) => {
        if (!student || formatStatus(student.status) === "active") return;
        try {
            const { error } = await state.client.from("students").update({ status: "active" }).eq("id", student.id);
            if (error) throw error;
            await loadStudents();
            showMessage(`${fullName(student) || "Student"} marked Active.`);
        } catch (error) {
            console.error("My-Kids-Hub student status update failed:", error);
            showMessage(error.message || "Unable to update student status.", "error");
        }
    };

    const updateAge = () => {
        const dob = $("dateOfBirth")?.value || "";
        if ($("age")) $("age").value = calculateAge(dob);
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
            $("dateOfBirth")?.addEventListener("change", updateAge);
            $("studentPhoto")?.addEventListener("change", event => {
                    const file = event.target.files?.[0] || null;
                state.selectedPhotoFile = file;
                if (file) {
                    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024) {
                        showFormError("Student photo must be PNG, JPG/JPEG, or WebP and 2 MB or smaller.");
                        event.target.value = "";
                        state.selectedPhotoFile = null;
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                        $("studentPhotoPreview").innerHTML = `<img src="${escapeHtml(reader.result)}" alt="Student photo preview" class="student-photo-preview-image">`;
                    };
                    reader.readAsDataURL(file);

                    if (state.readOnly && state.editingId) {
                        (async () => {
                            try {
                                const photoUrl = await uploadStudentPhoto(state.editingId, file);
                                if (!photoUrl) return;
                                const { error } = await state.client.from("students").update({ photo_url: photoUrl }).eq("id", state.editingId);
                                if (error) throw error;
                                const student = state.students.find(item => item.id === state.editingId);
                                if (student) student.photo_url = photoUrl;
                                state.selectedPhotoFile = null;
                                showMessage("Student photo updated successfully.");
                                await loadStudents();
                            } catch (error) {
                                console.error("My-Kids-Hub student photo update failed:", error);
                                showFormError(error.message || "Unable to update student photo.");
                            }
                        })();
                    }
                }
            });
            $("studentModal")?.addEventListener("click", (event) => {
                if (event.target === $("studentModal")) closeModal();
            });
            document.addEventListener("keydown", (event) => {
                if (event.key === "Escape" && !$('studentModal').hidden) closeModal();
            });

            ["studentSearch", "studentClassFilter", "studentSchoolFilter", "studentStatusFilter"].forEach(id => {
                $(id)?.addEventListener(id === "studentSearch" ? "input" : "change", renderStudents);
            });
            $("clearStudentFilters")?.addEventListener("click", () => {
                $("studentSearch").value = "";
                $("studentClassFilter").value = "";
                $("studentSchoolFilter").value = "";
                $("studentStatusFilter").value = "";
                renderStudents();
            });

            $("studentsTableBody")?.addEventListener("click", (event) => {
                const button = event.target.closest("button[data-action]");
                if (!button) return;
                const student = state.students.find(item => item.id === button.dataset.id);
                if (!student) return;
                if (button.dataset.action === "view") openModal(student, true);
                if (button.dataset.action === "edit") openModal(student, false);
                if (button.dataset.action === "activate") activateStudent(student);
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
