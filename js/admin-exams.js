
/*
=========================================================
YADAV EXAMPREP
File: js/admin-exams.js

Administrator Exam Management Controller

Designed and Developed by Yadav Web Technologies

Database:
admin/exams/{id}  - Protected master records
public/exams/{id} - Published records only

No sample records or default examinations.
=========================================================
*/

"use strict";


/* =====================================================
   01. FIREBASE IMPORTS
===================================================== */

import {
    auth,
    database,
    isDatabaseConfigured
} from "./firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import {
    ref,
    push,
    get,
    onValue,
    update
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";


/* =====================================================
   02. CONFIGURATION
===================================================== */

const CONFIG = Object.freeze({

    adminUID: "6HwAPbqwYBgg5Ih2zWycOZFBCe93",

    pageSize: 10,

    paths: {
        exams: "admin/exams",
        publicExams: "public/exams"
    },

    selectors: {

        gate: "#adminAuthGate",
        gateSpinner: "#adminGateSpinner",
        gateTitle: "#adminGateTitle",
        gateDescription: "#adminGateDescription",
        gateLoginLink: "#adminGateLoginLink",

        app: "#adminExamsApp",

        sidebar: "#adminSidebar",
        backdrop: "#adminSidebarBackdrop",
        menuToggle: "#adminMenuToggle",
        sidebarClose: "#adminSidebarClose",

        sidebarLogout: "#adminSidebarLogout",
        topbarLogout: "#adminTopbarLogout",
        userEmail: "#adminUserEmail",

        status: "#examManagementStatus",
        statusSpinner: "#examManagementSpinner",
        statusText: "#examManagementStatusText",

        addButton: "#addExamButton",

        total: "#examTotalCount",
        published: "#examPublishedCount",
        drafts: "#examDraftCount",
        filtered: "#examFilteredCount",

        filterForm: "#examFilterForm",
        search: "#examSearch",
        statusFilter: "#examStatusFilter",
        sort: "#examSortFilter",
        reset: "#resetExamFilters",

        table: "#examTableBody",
        emptyTemplate: "#examEmptyStateTemplate",

        pagination: "#examPagination",
        paginationInfo: "#examPaginationInfo",
        paginationButtons: "#examPaginationButtons",

        formModal: "#examFormModal",
        formModalTitle: "#examFormModalTitle",
        formModalDescription: "#examFormModalDescription",
        closeForm: "#closeExamFormModal",
        cancelForm: "#cancelExamForm",

        form: "#examForm",
        recordId: "#examRecordId",
        name: "#examName",
        description: "#examDescription",
        order: "#examDisplayOrder",
        publication: "#examPublicationStatus",

        saveButton: "#saveExamButton",
        saveText: "#saveExamButtonText",
        saveSpinner: "#saveExamSpinner",

        deleteModal: "#deleteExamModal",
        closeDelete: "#closeDeleteExamModal",
        cancelDelete: "#cancelDeleteExam",
        confirmDelete: "#confirmDeleteExam",
        deleteName: "#deleteExamName",
        deleteText: "#deleteExamButtonText",
        deleteSpinner: "#deleteExamSpinner",

        year: "#currentYear"

    }

});


/* =====================================================
   03. STATE
===================================================== */

const state = {

    initialized: false,
    authorized: false,
    busy: false,
    signingOut: false,

    loaded: false,
    exams: [],
    page: 1,

    deleteId: null,
    unsubscribe: null,
    activeModal: null,
    modalReturnFocus: null

};

const el = {};


/* =====================================================
   04. HELPERS
===================================================== */

function text(element, value) {

    if (element) {
        element.textContent = String(value);
    }

}

function node(tag, className = "", content) {

    const item = document.createElement(tag);

    if (className) {
        item.className = className;
    }

    if (content !== undefined) {
        item.textContent = String(content);
    }

    return item;

}

function normalize(value) {

    if (!value || typeof value !== "object") {
        return [];
    }

    return Object.entries(value)
        .filter(([, record]) =>
            record &&
            typeof record === "object" &&
            !Array.isArray(record)
        )
        .map(([id, record]) => ({
            ...record,
            id
        }));

}

function findExam(id) {

    return state.exams.find(exam => exam.id === id) || null;

}

function formatDate(value) {

    if (value === undefined || value === null || value === "") {
        return "—";
    }

    const date = new Date(
        typeof value === "number" && value < 100000000000
            ? value * 1000
            : value
    );

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(date);

}

function timestamp(value) {

    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string") {
        return Date.parse(value) || 0;
    }

    return 0;

}


/* =====================================================
   05. ACCESS GATE
===================================================== */

function showGate(title, description, loginLink = false) {

    el.app.hidden = true;
    el.gate.hidden = false;

    text(el.gateTitle, title);
    text(el.gateDescription, description);

    el.gateSpinner.hidden = loginLink;
    el.gateLoginLink.hidden = !loginLink;

}

function authorized(user) {

    return Boolean(
        user &&
        user.uid === CONFIG.adminUID
    );

}

function stopSubscription() {

    if (typeof state.unsubscribe === "function") {

        state.unsubscribe();
        state.unsubscribe = null;

    }

}

function setControlsEnabled(enabled) {

    [
        el.addButton,
        el.search,
        el.statusFilter,
        el.sort,
        el.reset
    ].forEach(control => {

        control.disabled = !enabled;

    });

}

function status(message, type = "loading") {

    el.status.hidden = false;

    el.status.classList.remove(
        "is-error",
        "is-success",
        "is-warning"
    );

    if (type !== "loading") {
        el.status.classList.add(`is-${type}`);
    }

    el.statusSpinner.hidden = type !== "loading";

    text(el.statusText, message);

}


/* =====================================================
   06. LOADING / BUSY STATE
===================================================== */

function setBusy(busy, action = "save") {

    state.busy = busy;

    el.saveButton.disabled = busy;
    el.confirmDelete.disabled = busy;

    el.saveSpinner.hidden = !(busy && action === "save");
    el.deleteSpinner.hidden = !(busy && action === "delete");

    text(
        el.saveText,
        busy && action === "save"
            ? "Saving..."
            : "Save Exam"
    );

    text(
        el.deleteText,
        busy && action === "delete"
            ? "Deleting..."
            : "Delete Exam"
    );

}


/* =====================================================
   07. AUTHENTICATION
===================================================== */

function observeSession() {

    onAuthStateChanged(

        auth,

        async user => {

            if (!authorized(user)) {

                state.authorized = false;
                state.loaded = false;

                stopSubscription();
                setControlsEnabled(false);
                closeModal(true);

                showGate(
                    user ? "Access Denied" : "Sign In Required",
                    user
                        ? "This Firebase account is not authorized to manage examinations."
                        : "Sign in with your administrator account to continue.",
                    true
                );

                if (user) {

                    try {
                        await signOut(auth);
                    } catch (error) {
                        console.error(
                            "[Exam Manager] Unauthorized sign-out:",
                            error?.code
                        );
                    }

                }

                return;

            }

            state.authorized = true;

            text(
                el.userEmail,
                user.email || "Administrator"
            );

            el.gate.hidden = true;
            el.app.hidden = false;

            if (!isDatabaseConfigured() || !database) {

                setControlsEnabled(false);

                status(
                    "Firebase Realtime Database is not configured. Add your actual databaseURL to js/firebase-config.js.",
                    "error"
                );

                showTableMessage(
                    "Database configuration is required."
                );

                return;

            }

            subscribeExams();

        },

        error => {

            state.authorized = false;
            stopSubscription();
            setControlsEnabled(false);

            console.error(
                "[Exam Manager] Authentication error:",
                error?.code
            );

            showGate(
                "Session Verification Failed",
                "Unable to verify your administrator session.",
                true
            );

        }

    );

}


/* =====================================================
   08. FIREBASE LIVE SUBSCRIPTION
===================================================== */

function subscribeExams() {

    stopSubscription();

    state.loaded = false;
    setControlsEnabled(false);

    status("Loading examination records...");

    state.unsubscribe = onValue(

        ref(database, CONFIG.paths.exams),

        snapshot => {

            if (!state.authorized) {
                return;
            }

            state.exams = normalize(snapshot.val());

            state.loaded = true;

            setControlsEnabled(!state.busy);

            render();

            status(
                "Examination records are synchronized with Firebase.",
                "success"
            );

        },

        error => {

            state.loaded = false;
            setControlsEnabled(false);

            console.error(
                "[Exam Manager] Database read error:",
                error?.code
            );

            status(
                "Unable to load exams. Check Firebase Security Rules and database configuration.",
                "error"
            );

            showTableMessage(
                "Examination records could not be loaded."
            );

        }

    );

}


/* =====================================================
   09. FILTERING AND SORTING
===================================================== */

function filteredExams() {

    const query = el.search.value.trim().toLowerCase();

    const publication = el.statusFilter.value;

    const sort = el.sort.value;

    const results = state.exams.filter(exam => {

        const searchable = [
            exam.name,
            exam.description
        ].map(value =>
            typeof value === "string" ? value : ""
        ).join(" ").toLowerCase();

        if (query && !searchable.includes(query)) {
            return false;
        }

        if (
            publication === "published" &&
            exam.published !== true
        ) {
            return false;
        }

        if (
            publication === "draft" &&
            exam.published === true
        ) {
            return false;
        }

        return true;

    });

    results.sort((a, b) => {

        if (sort === "name-asc") {

            return String(a.name || "").localeCompare(
                String(b.name || "")
            );

        }

        if (sort === "name-desc") {

            return String(b.name || "").localeCompare(
                String(a.name || "")
            );

        }

        const first = timestamp(a.createdAt);
        const second = timestamp(b.createdAt);

        if (sort === "oldest") {
            return first - second;
        }

        return second - first;

    });

    return results;

}


/* =====================================================
   10. STATISTICS
===================================================== */

function renderStatistics(results) {

    const published = state.exams.filter(
        exam => exam.published === true
    ).length;

    text(el.total, state.exams.length);
    text(el.published, published);
    text(el.drafts, state.exams.length - published);
    text(el.filtered, results.length);

}


/* =====================================================
   11. TABLE MESSAGES
===================================================== */

function showTableMessage(message) {

    const row = node("tr");
    const cell = node("td");

    cell.colSpan = 5;

    const empty = node(
        "div",
        "admin-empty-state"
    );

    empty.append(
        node("p", "", message)
    );

    cell.append(empty);
    row.append(cell);

    el.table.replaceChildren(row);

    el.pagination.hidden = true;

}


/* =====================================================
   12. EXAM TABLE
===================================================== */

function createAction(label, action, id, danger = false) {

    const button = node(
        "button",
        danger
            ? "admin-icon-button is-danger"
            : "admin-icon-button",
        label
    );

    button.type = "button";
    button.dataset.action = action;
    button.dataset.id = id;
    button.title = label;
    button.setAttribute("aria-label", label);

    return button;

}

function renderTable(records) {

    el.table.replaceChildren();

    if (records.length === 0) {

        const template = el.emptyTemplate.content.cloneNode(true);

        el.table.append(template);
        el.pagination.hidden = true;

        return;

    }

    const fragment = document.createDocumentFragment();

    records.forEach(exam => {

        const row = node("tr");

        const nameCell = node(
            "td",
            "admin-table-title",
            exam.name || "Untitled exam"
        );

        const descriptionCell = node(
            "td",
            "",
            exam.description || "—"
        );

        const statusCell = node("td");

        statusCell.append(
            node(
                "span",
                exam.published === true
                    ? "admin-status-badge is-published"
                    : "admin-status-badge is-draft",
                exam.published === true
                    ? "Published"
                    : "Draft"
            )
        );

        const updatedCell = node(
            "td",
            "",
            formatDate(exam.updatedAt || exam.createdAt)
        );

        const actionsCell = node("td");

        const actions = node(
            "div",
            "admin-table-actions"
        );

        actions.append(

            createAction(
                "Edit",
                "edit",
                exam.id
            ),

            createAction(
                exam.published === true
                    ? "Unpublish"
                    : "Publish",
                "toggle",
                exam.id
            ),

            createAction(
                "Delete",
                "delete",
                exam.id,
                true
            )

        );

        actionsCell.append(actions);

        row.append(
            nameCell,
            descriptionCell,
            statusCell,
            updatedCell,
            actionsCell
        );

        fragment.append(row);

    });

    el.table.append(fragment);

}


/* =====================================================
   13. PAGINATION
===================================================== */

function renderPagination(total) {

    const pages = Math.ceil(total / CONFIG.pageSize);

    el.pagination.hidden = pages <= 1;

    if (pages <= 1) {
        return;
    }

    const start = (state.page - 1) * CONFIG.pageSize + 1;

    const end = Math.min(
        state.page * CONFIG.pageSize,
        total
    );

    text(
        el.paginationInfo,
        `Showing ${start}–${end} of ${total}`
    );

    el.paginationButtons.replaceChildren();

    function addPageButton(label, page, disabled = false) {

        const button = node(
            "button",
            page === state.page && !disabled
                ? "is-active"
                : "",
            label
        );

        button.type = "button";
        button.disabled = disabled;
        button.dataset.page = String(page);

        if (page === state.page && !disabled) {
            button.setAttribute("aria-current", "page");
        }

        el.paginationButtons.append(button);

    }

    addPageButton(
        "Previous",
        state.page - 1,
        state.page === 1
    );

    for (let page = 1; page <= pages; page++) {

        addPageButton(
            String(page),
            page
        );

    }

    addPageButton(
        "Next",
        state.page + 1,
        state.page === pages
    );

}

function render() {

    if (!state.loaded) {
        return;
    }

    const results = filteredExams();

    const totalPages = Math.max(
        1,
        Math.ceil(results.length / CONFIG.pageSize)
    );

    state.page = Math.min(
        state.page,
        totalPages
    );

    const start = (state.page - 1) * CONFIG.pageSize;

    renderStatistics(results);

    renderTable(
        results.slice(
            start,
            start + CONFIG.pageSize
        )
    );

    renderPagination(results.length);

}


/* =====================================================
   14. MODAL MANAGEMENT
===================================================== */

function openModal(modal, focusTarget) {

    if (state.activeModal) {
        closeModal(true);
    }

    state.modalReturnFocus = document.activeElement;
    state.activeModal = modal;

    modal.hidden = false;

    document.body.style.overflow = "hidden";

    if (focusTarget) {
        focusTarget.focus();
    }

}

function closeModal(force = false) {

    if (state.busy && !force) {
        return;
    }

    if (!state.activeModal) {
        return;
    }

    state.activeModal.hidden = true;
    state.activeModal = null;

    document.body.style.overflow = "";

    if (
        state.modalReturnFocus &&
        state.modalReturnFocus.isConnected &&
        !el.app.hidden
    ) {
        state.modalReturnFocus.focus();
    }

    state.modalReturnFocus = null;

}

function handleModalKeyboard(event) {

    if (!state.activeModal) {
        return;
    }

    if (event.key === "Escape") {

        event.preventDefault();
        closeModal();

        return;
    }

    if (event.key !== "Tab") {
        return;
    }

    const controls = Array.from(
        state.activeModal.querySelectorAll(
            'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href]'
        )
    ).filter(item => item.getClientRects().length > 0);

    if (!controls.length) {
        return;
    }

    const first = controls[0];
    const last = controls[controls.length - 1];

    if (event.shiftKey && document.activeElement === first) {

        event.preventDefault();
        last.focus();

    } else if (
        !event.shiftKey &&
        document.activeElement === last
    ) {

        event.preventDefault();
        first.focus();

    }

}


/* =====================================================
   15. ADD / EDIT FORM
===================================================== */

function openExamForm(id = null) {

    if (!state.authorized || !state.loaded || state.busy) {
        return;
    }

    el.form.reset();

    const exam = id ? findExam(id) : null;

    if (id && !exam) {

        status(
            "The selected exam could not be found.",
            "error"
        );

        return;

    }

    el.recordId.value = exam?.id || "";

    el.name.value = exam?.name || "";

    el.description.value = exam?.description || "";

    el.order.value = Number.isInteger(exam?.order)
        ? String(exam.order)
        : "0";

    el.publication.value = exam?.published === true
        ? "true"
        : "false";

    text(
        el.formModalTitle,
        exam ? "Edit Exam" : "Add New Exam"
    );

    text(
        el.formModalDescription,
        exam
            ? "Update the selected examination category."
            : "Complete the details to create an examination category."
    );

    text(
        el.saveText,
        exam ? "Update Exam" : "Save Exam"
    );

    openModal(
        el.formModal,
        el.name
    );

}


/* =====================================================
   16. VALIDATE EXAM
===================================================== */

function validateExamForm() {

    const name = el.name.value.trim();

    const description = el.description.value.trim();

    const order = Number(el.order.value);

    const published = el.publication.value === "true";

    if (!name || name.length > 120) {

        el.name.focus();

        status(
            "Enter an exam name of up to 120 characters.",
            "error"
        );

        return null;

    }

    if (description.length > 600) {

        el.description.focus();

        status(
            "The description cannot exceed 600 characters.",
            "error"
        );

        return null;

    }

    if (
        !Number.isInteger(order) ||
        order < 0 ||
        order > 99999
    ) {

        el.order.focus();

        status(
            "Display order must be a whole number between 0 and 99999.",
            "error"
        );

        return null;

    }

    const currentId = el.recordId.value.trim();

    const duplicate = state.exams.some(exam =>

        exam.name?.trim().toLowerCase() === name.toLowerCase() &&

        exam.id !== currentId

    );

    if (duplicate) {

        el.name.focus();

        status(
            "An exam with this name already exists.",
            "error"
        );

        return null;

    }

    return {
        name,
        description,
        order,
        published
    };

}


/* =====================================================
   17. ATOMIC EXAM SAVE
===================================================== */

async function handleSave(event) {

    event.preventDefault();

    if (
        !state.authorized ||
        !state.loaded ||
        state.busy
    ) {
        return;
    }

    const values = validateExamForm();

    if (!values) {
        return;
    }

    const existingId = el.recordId.value.trim();

    const existing = existingId
        ? findExam(existingId)
        : null;

    if (existingId && !existing) {

        status(
            "This exam no longer exists. Refresh the page.",
            "error"
        );

        return;
    }

    const id = existingId || push(
        ref(database, CONFIG.paths.exams)
    ).key;

    if (!id) {

        status(
            "Unable to generate an exam identifier.",
            "error"
        );

        return;

    }

    setBusy(true, "save");

    try {

        const now = Date.now();

        const record = {

            name: values.name,

            description: values.description,

            order: values.order,

            published: values.published,

            createdAt: existing?.createdAt || now,

            updatedAt: now

        };

        const changes = {};

        changes[`${CONFIG.paths.exams}/${id}`] = record;

        changes[`${CONFIG.paths.publicExams}/${id}`] =
            values.published ? record : null;

        /*
         * Both paths update atomically.
         * Security Rules must authorize the entire operation.
         */

        await update(
            ref(database),
            changes
        );

        closeModal(true);

        status(
            existing
                ? "Examination updated successfully."
                : "Examination created successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "[Exam Manager] Save failed:",
            error?.code
        );

        status(
            "Unable to save the exam. Check your connection and Firebase Security Rules.",
            "error"
        );

    } finally {

        setBusy(false);

    }

}


/* =====================================================
   18. QUICK PUBLICATION TOGGLE
===================================================== */

async function togglePublication(id) {

    if (
        !state.authorized ||
        !state.loaded ||
        state.busy
    ) {
        return;
    }

    const exam = findExam(id);

    if (!exam) {
        return;
    }

    const published = exam.published !== true;

    state.busy = true;
    setControlsEnabled(false);

    try {

        const record = {

            name: exam.name || "",

            description: exam.description || "",

            order: Number.isInteger(exam.order)
                ? exam.order
                : 0,

            published,

            createdAt: exam.createdAt || Date.now(),

            updatedAt: Date.now()

        };

        const changes = {};

        changes[`${CONFIG.paths.exams}/${id}`] = record;

        changes[`${CONFIG.paths.publicExams}/${id}`] =
            published ? record : null;

        await update(
            ref(database),
            changes
        );

        status(
            published
                ? "Exam published successfully."
                : "Exam unpublished successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "[Exam Manager] Publication failed:",
            error?.code
        );

        status(
            "Unable to change publication status. Check database permissions.",
            "error"
        );

    } finally {

        state.busy = false;
        setControlsEnabled(state.loaded && state.authorized);

    }

}


/* =====================================================
   19. DELETE CONFIRMATION
===================================================== */

function openDeleteConfirmation(id) {

    if (
        !state.authorized ||
        !state.loaded ||
        state.busy
    ) {
        return;
    }

    const exam = findExam(id);

    if (!exam) {
        return;
    }

    state.deleteId = id;

    text(
        el.deleteName,
        exam.name || "Untitled exam"
    );

    openModal(
        el.deleteModal,
        el.cancelDelete
    );

}


/* =====================================================
   20. DEPENDENCY CHECK
===================================================== */

async function hasDependencies(examId) {

    /*
     * Read both administrative and public references.
     * This guards against deleting an exam still linked
     * to existing content.
     *
     * Security Rules must allow authorized administrators
     * to read these paths.
     */

    const paths = [

        "admin/subjects",
        "admin/topics",
        "admin/lessons",
        "admin/questions",
        "admin/tests",

        "public/subjects",
        "public/topics",
        "public/lessons",
        "public/questions",
        "public/tests"

    ];

    const snapshots = await Promise.all(

        paths.map(path =>
            get(ref(database, path))
        )

    );

    return snapshots.some(snapshot => {

        const records = normalize(snapshot.val());

        return records.some(record =>
            record.examId === examId
        );

    });

}


/* =====================================================
   21. DELETE EXAM
===================================================== */

async function handleDelete() {

    if (
        !state.authorized ||
        !state.loaded ||
        state.busy ||
        !state.deleteId
    ) {
        return;
    }

    const id = state.deleteId;

    if (!findExam(id)) {

        closeModal(true);
        state.deleteId = null;

        status(
            "This examination no longer exists.",
            "error"
        );

        return;

    }

    setBusy(true, "delete");

    try {

        const dependent = await hasDependencies(id);

        if (dependent) {

            status(
                "Deletion blocked: existing content still references this exam. Remove or reassign its dependent records first.",
                "warning"
            );

            closeModal(true);
            state.deleteId = null;

            return;

        }

        const changes = {};

        changes[`${CONFIG.paths.exams}/${id}`] = null;

        changes[`${CONFIG.paths.publicExams}/${id}`] = null;

        await update(
            ref(database),
            changes
        );

        closeModal(true);

        state.deleteId = null;

        status(
            "Examination deleted successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "[Exam Manager] Delete failed:",
            error?.code
        );

        status(
            "Deletion could not be completed. Verify database access and try again.",
            "error"
        );

    } finally {

        setBusy(false);

    }

}


/* =====================================================
   22. TABLE ACTION HANDLING
===================================================== */

function handleTableAction(event) {

    const button = event.target.closest(
        "button[data-action][data-id]"
    );

    if (!button || !el.table.contains(button)) {
        return;
    }

    const id = button.dataset.id;

    switch (button.dataset.action) {

        case "edit":

            openExamForm(id);
            break;

        case "toggle":

            togglePublication(id);
            break;

        case "delete":

            openDeleteConfirmation(id);
            break;

        default:
            break;

    }

}


/* =====================================================
   23. SIDEBAR
===================================================== */

function setSidebar(open) {

    el.sidebar.classList.toggle(
        "is-open",
        open
    );

    el.backdrop.hidden = !open;

    el.menuToggle.setAttribute(
        "aria-expanded",
        String(open)
    );

    if (open) {
        el.sidebarClose.focus();
    } else {
        el.menuToggle.focus();
    }

}


/* =====================================================
   24. LOGOUT
===================================================== */

async function logout() {

    if (state.signingOut) {
        return;
    }

    state.signingOut = true;

    el.sidebarLogout.disabled = true;
    el.topbarLogout.disabled = true;

    try {

        stopSubscription();

        await signOut(auth);

        window.location.replace("index.html");

    } catch (error) {

        state.signingOut = false;

        el.sidebarLogout.disabled = false;
        el.topbarLogout.disabled = false;

        status(
            "Unable to sign out. Please try again.",
            "error"
        );

    }

}


/* =====================================================
   25. EVENT REGISTRATION
===================================================== */

function registerEvents() {

    el.addButton.addEventListener(
        "click",
        () => openExamForm()
    );

    el.form.addEventListener(
        "submit",
        handleSave
    );

    el.table.addEventListener(
        "click",
        handleTableAction
    );

    el.filterForm.addEventListener(
        "submit",
        event => event.preventDefault()
    );

    [
        el.search,
        el.statusFilter,
        el.sort
    ].forEach(control => {

        control.addEventListener(
            control === el.search ? "input" : "change",
            () => {

                state.page = 1;
                render();

            }
        );

    });

    el.reset.addEventListener("click", () => {

        el.search.value = "";
        el.statusFilter.value = "all";
        el.sort.value = "newest";

        state.page = 1;

        render();

    });

    el.paginationButtons.addEventListener(
        "click",
        event => {

            const button = event.target.closest(
                "button[data-page]"
            );

            if (!button || button.disabled) {
                return;
            }

            state.page = Number(button.dataset.page);

            render();

        }
    );

    [
        el.closeForm,
        el.cancelForm,
        el.closeDelete,
        el.cancelDelete
    ].forEach(button => {

        button.addEventListener(
            "click",
            () => closeModal()
        );

    });

    el.confirmDelete.addEventListener(
        "click",
        handleDelete
    );

    [
        el.formModal,
        el.deleteModal
    ].forEach(modal => {

        modal.addEventListener("click", event => {

            if (event.target === modal) {
                closeModal();
            }

        });

    });

    document.addEventListener(
        "keydown",
        handleModalKeyboard
    );

    el.menuToggle.addEventListener(
        "click",
        () => setSidebar(
            !el.sidebar.classList.contains("is-open")
        )
    );

    el.sidebarClose.addEventListener(
        "click",
        () => setSidebar(false)
    );

    el.backdrop.addEventListener(
        "click",
        () => setSidebar(false)
    );

    document.addEventListener("keydown", event => {

        if (
            event.key === "Escape" &&
            el.sidebar.classList.contains("is-open") &&
            !state.activeModal
        ) {
            setSidebar(false);
        }

    });

    window.matchMedia("(min-width: 901px)")
        .addEventListener("change", event => {

            if (event.matches) {

                el.sidebar.classList.remove("is-open");
                el.backdrop.hidden = true;

                el.menuToggle.setAttribute(
                    "aria-expanded",
                    "false"
                );

            }

        });

    el.sidebarLogout.addEventListener(
        "click",
        logout
    );

    el.topbarLogout.addEventListener(
        "click",
        logout
    );

}


/* =====================================================
   26. INITIALIZATION
===================================================== */

function initialize() {

    if (
        state.initialized ||
        document.body.dataset.page !== "admin-exams"
    ) {
        return;
    }

    Object.entries(CONFIG.selectors).forEach(
        ([key, selector]) => {

            el[key] = document.querySelector(selector);

        }
    );

    const missing = Object.keys(
        CONFIG.selectors
    ).filter(key => !el[key]);

    if (missing.length) {

        console.error(
            "[Exam Manager] Missing HTML elements:",
            missing
        );

        return;

    }

    state.initialized = true;

    text(
        el.year,
        new Date().getFullYear()
    );

    setControlsEnabled(false);

    registerEvents();

    showGate(
        "Verifying Administrator Access",
        "Please wait while your administrator session is being verified."
    );

    observeSession();

}


/* =====================================================
   27. START
===================================================== */

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initialize,
        { once: true }
    );

} else {

    initialize();

}


/* =====================================================
   END OF ADMIN-EXAMS.JS
===================================================== */
