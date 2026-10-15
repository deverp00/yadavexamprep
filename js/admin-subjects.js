
/*
=========================================================
YADAV EXAMPREP
File: js/admin-subjects.js

Firebase Realtime Database Subject Management

Designed and Developed by Yadav Web Technologies

Protected records:
admin/subjects/{subjectId}

Published records:
public/subjects/{subjectId}

No default or sample educational records.
=========================================================
*/

"use strict";

/* =====================================================
   01. IMPORTS
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
        subjects: "admin/subjects",
        publicSubjects: "public/subjects"
    },

    selectors: {

        gate: "#adminAuthGate",
        gateSpinner: "#adminGateSpinner",
        gateTitle: "#adminGateTitle",
        gateDescription: "#adminGateDescription",
        gateLoginLink: "#adminGateLoginLink",

        app: "#adminSubjectsApp",

        sidebar: "#adminSidebar",
        backdrop: "#adminSidebarBackdrop",
        menuToggle: "#adminMenuToggle",
        sidebarClose: "#adminSidebarClose",
        sidebarNavigation: "#adminSidebarNavigation",

        sidebarLogout: "#adminSidebarLogout",
        topbarLogout: "#adminTopbarLogout",
        userEmail: "#adminUserEmail",

        status: "#subjectManagementStatus",
        statusSpinner: "#subjectManagementSpinner",
        statusText: "#subjectManagementStatusText",

        addButton: "#addSubjectButton",

        total: "#subjectTotalCount",
        published: "#subjectPublishedCount",
        drafts: "#subjectDraftCount",
        filtered: "#subjectFilteredCount",

        filterForm: "#subjectFilterForm",
        search: "#subjectSearch",
        examFilter: "#subjectExamFilter",
        statusFilter: "#subjectStatusFilter",
        sort: "#subjectSortFilter",
        reset: "#resetSubjectFilters",

        table: "#subjectTableBody",
        emptyTemplate: "#subjectEmptyStateTemplate",

        pagination: "#subjectPagination",
        paginationInfo: "#subjectPaginationInfo",
        paginationButtons: "#subjectPaginationButtons",

        formModal: "#subjectFormModal",
        formTitle: "#subjectFormModalTitle",
        formDescription: "#subjectFormModalDescription",
        closeForm: "#closeSubjectFormModal",
        cancelForm: "#cancelSubjectForm",

        form: "#subjectForm",
        recordId: "#subjectRecordId",
        parentExam: "#subjectParentExam",
        name: "#subjectName",
        description: "#subjectDescription",
        order: "#subjectDisplayOrder",
        publication: "#subjectPublicationStatus",

        saveButton: "#saveSubjectButton",
        saveText: "#saveSubjectButtonText",
        saveSpinner: "#saveSubjectSpinner",

        deleteModal: "#deleteSubjectModal",
        closeDelete: "#closeDeleteSubjectModal",
        cancelDelete: "#cancelDeleteSubject",
        confirmDelete: "#confirmDeleteSubject",
        deleteName: "#deleteSubjectName",
        deleteText: "#deleteSubjectButtonText",
        deleteSpinner: "#deleteSubjectSpinner",

        year: "#currentYear"

    }

});


/* =====================================================
   03. APPLICATION STATE
===================================================== */

const state = {

    initialized: false,
    authorized: false,
    busy: false,
    signingOut: false,

    examsLoaded: false,
    subjectsLoaded: false,

    exams: [],
    subjects: [],

    page: 1,

    deleteId: null,

    unsubscribers: [],

    activeModal: null,
    returnFocus: null

};

const el = {};


/* =====================================================
   04. GENERAL UTILITIES
===================================================== */

function setText(element, value) {

    if (element) {
        element.textContent = String(value);
    }

}

function createNode(tag, className = "", content) {

    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (content !== undefined) {
        element.textContent = String(content);
    }

    return element;

}

function normalizeCollection(value) {

    if (!value || typeof value !== "object") {
        return [];
    }

    return Object.entries(value)
        .filter(([, record]) => (
            record &&
            typeof record === "object" &&
            !Array.isArray(record)
        ))
        .map(([id, record]) => ({
            ...record,
            id
        }));

}

function findExam(id) {

    return state.exams.find(
        exam => exam.id === id
    ) || null;

}

function findSubject(id) {

    return state.subjects.find(
        subject => subject.id === id
    ) || null;

}

function ready() {

    return state.authorized &&
        state.examsLoaded &&
        state.subjectsLoaded &&
        !state.busy;

}

function formatDate(value) {

    if (value === null || value === undefined || value === "") {
        return "—";
    }

    const parsed = typeof value === "number" && value < 100000000000
        ? value * 1000
        : value;

    const date = new Date(parsed);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(date);

}

function getTimestamp(value) {

    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === "string") {
        return Date.parse(value) || 0;
    }

    return 0;

}


/* =====================================================
   05. AUTHENTICATION GATE
===================================================== */

function isAdministrator(user) {

    return Boolean(
        user &&
        user.uid === CONFIG.adminUID
    );

}

function showGate(title, description, showLogin = false) {

    el.app.hidden = true;
    el.gate.hidden = false;

    setText(el.gateTitle, title);
    setText(el.gateDescription, description);

    el.gateSpinner.hidden = showLogin;
    el.gateLoginLink.hidden = !showLogin;

}

function stopSubscriptions() {

    state.unsubscribers.forEach(unsubscribe => {

        if (typeof unsubscribe === "function") {
            unsubscribe();
        }

    });

    state.unsubscribers = [];

}

function setControlsEnabled(enabled) {

    [
        el.addButton,
        el.search,
        el.examFilter,
        el.statusFilter,
        el.sort,
        el.reset
    ].forEach(control => {

        control.disabled = !enabled;

    });

    /*
     * A subject cannot be created until
     * at least one parent exam exists.
     */

    el.addButton.disabled =
        !enabled || state.exams.length === 0;

}

function showStatus(message, type = "loading") {

    el.status.hidden = false;

    el.status.classList.remove(
        "is-success",
        "is-error",
        "is-warning"
    );

    if (type !== "loading") {
        el.status.classList.add(`is-${type}`);
    }

    el.statusSpinner.hidden = type !== "loading";

    setText(el.statusText, message);

}


/* =====================================================
   06. BUSY STATE
===================================================== */

function setBusy(busy, action = "save") {

    state.busy = busy;

    el.saveButton.disabled = busy;
    el.confirmDelete.disabled = busy;

    el.saveSpinner.hidden = !(busy && action === "save");
    el.deleteSpinner.hidden = !(busy && action === "delete");

    if (busy) {

        setText(
            el.saveText,
            action === "save" ? "Saving..." : "Save Subject"
        );

        setText(
            el.deleteText,
            action === "delete" ? "Deleting..." : "Delete Subject"
        );

    } else {

        setText(
            el.saveText,
            el.recordId.value ? "Update Subject" : "Save Subject"
        );

        setText(el.deleteText, "Delete Subject");

    }

    setControlsEnabled(
        !busy &&
        state.examsLoaded &&
        state.subjectsLoaded &&
        state.authorized
    );

}


/* =====================================================
   07. AUTHENTICATION OBSERVER
===================================================== */

function observeSession() {

    onAuthStateChanged(

        auth,

        async user => {

            if (!isAdministrator(user)) {

                state.authorized = false;
                state.examsLoaded = false;
                state.subjectsLoaded = false;

                stopSubscriptions();
                setControlsEnabled(false);
                closeModal(true);

                showGate(
                    user ? "Access Denied" : "Sign In Required",
                    user
                        ? "This account is not authorized to manage subjects."
                        : "Sign in with your administrator account to continue.",
                    true
                );

                if (user) {

                    try {
                        await signOut(auth);
                    } catch (error) {
                        console.error(
                            "[Subject Manager] Unauthorized sign-out:",
                            error?.code
                        );
                    }

                }

                return;

            }

            state.authorized = true;

            setText(
                el.userEmail,
                user.email || "Administrator"
            );

            el.gate.hidden = true;
            el.app.hidden = false;

            if (!isDatabaseConfigured() || !database) {

                setControlsEnabled(false);

                showStatus(
                    "Firebase Realtime Database is not configured. Add your actual databaseURL to js/firebase-config.js.",
                    "error"
                );

                showTableMessage(
                    "Database configuration is required."
                );

                return;

            }

            subscribeCollections();

        },

        error => {

            state.authorized = false;

            stopSubscriptions();
            setControlsEnabled(false);

            console.error(
                "[Subject Manager] Authentication error:",
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
   08. FIREBASE SUBSCRIPTIONS
===================================================== */

function subscribeCollections() {

    stopSubscriptions();

    state.examsLoaded = false;
    state.subjectsLoaded = false;

    setControlsEnabled(false);

    showStatus(
        "Loading examination and subject records..."
    );

    const examUnsubscribe = onValue(

        ref(database, CONFIG.paths.exams),

        snapshot => {

            if (!state.authorized) {
                return;
            }

            state.exams = normalizeCollection(snapshot.val());

            state.examsLoaded = true;

            populateExamSelectors();

            finishLoading();

        },

        error => handleReadError("exams", error)

    );

    const subjectUnsubscribe = onValue(

        ref(database, CONFIG.paths.subjects),

        snapshot => {

            if (!state.authorized) {
                return;
            }

            state.subjects = normalizeCollection(snapshot.val());

            state.subjectsLoaded = true;

            finishLoading();

        },

        error => handleReadError("subjects", error)

    );

    state.unsubscribers.push(
        examUnsubscribe,
        subjectUnsubscribe
    );

}

function handleReadError(collection, error) {

    console.error(
        `[Subject Manager] ${collection} read error:`,
        error?.code
    );

    if (collection === "exams") {
        state.examsLoaded = false;
    } else {
        state.subjectsLoaded = false;
    }

    setControlsEnabled(false);

    showStatus(
        "Unable to load Firebase records. Check database configuration and Security Rules.",
        "error"
    );

    showTableMessage(
        "Subject records could not be loaded."
    );

}

function finishLoading() {

    if (!state.examsLoaded || !state.subjectsLoaded) {
        return;
    }

    setControlsEnabled(!state.busy);

    render();

    if (state.exams.length === 0) {

        showStatus(
            "No examinations exist yet. Create an examination in Exam Manager before adding subjects.",
            "warning"
        );

    } else {

        showStatus(
            "Subject records are synchronized with Firebase Realtime Database.",
            "success"
        );

    }

}


/* =====================================================
   09. PARENT EXAM SELECTORS
===================================================== */

function populateExamSelectors() {

    const previousFilter = el.examFilter.value;
    const previousParent = el.parentExam.value;

    el.examFilter.replaceChildren(
        new Option("All Exams", "all")
    );

    el.parentExam.replaceChildren(
        new Option("Select an examination", "")
    );

    const exams = [...state.exams].sort((a, b) =>

        String(a.name || "").localeCompare(
            String(b.name || "")
        )

    );

    exams.forEach(exam => {

        const label = exam.name || "Untitled exam";

        el.examFilter.add(
            new Option(label, exam.id)
        );

        el.parentExam.add(
            new Option(
                exam.published === true
                    ? label
                    : `${label} (Draft)`,
                exam.id
            )
        );

    });

    if ([...el.examFilter.options].some(
        option => option.value === previousFilter
    )) {
        el.examFilter.value = previousFilter;
    }

    if ([...el.parentExam.options].some(
        option => option.value === previousParent
    )) {
        el.parentExam.value = previousParent;
    }

}


/* =====================================================
   10. FILTER AND SORT
===================================================== */

function getFilteredSubjects() {

    const search = el.search.value.trim().toLowerCase();

    const examId = el.examFilter.value;

    const publication = el.statusFilter.value;

    const sort = el.sort.value;

    const results = state.subjects.filter(subject => {

        const exam = findExam(subject.examId);

        const searchable = [

            subject.name,
            subject.description,
            exam?.name

        ].map(value =>
            typeof value === "string" ? value : ""
        ).join(" ").toLowerCase();

        if (search && !searchable.includes(search)) {
            return false;
        }

        if (examId !== "all" && subject.examId !== examId) {
            return false;
        }

        if (
            publication === "published" &&
            subject.published !== true
        ) {
            return false;
        }

        if (
            publication === "draft" &&
            subject.published === true
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

        const first = getTimestamp(a.createdAt);
        const second = getTimestamp(b.createdAt);

        return sort === "oldest"
            ? first - second
            : second - first;

    });

    return results;

}


/* =====================================================
   11. STATISTICS
===================================================== */

function renderStatistics(results) {

    const published = state.subjects.filter(
        subject => subject.published === true
    ).length;

    setText(el.total, state.subjects.length);
    setText(el.published, published);
    setText(el.drafts, state.subjects.length - published);
    setText(el.filtered, results.length);

}


/* =====================================================
   12. TABLE RENDERING
===================================================== */

function showTableMessage(message) {

    const row = createNode("tr");

    const cell = createNode("td");

    cell.colSpan = 6;

    const empty = createNode(
        "div",
        "admin-empty-state"
    );

    empty.append(
        createNode("p", "", message)
    );

    cell.append(empty);
    row.append(cell);

    el.table.replaceChildren(row);

    el.pagination.hidden = true;

}

function createAction(label, action, id, danger = false) {

    const button = createNode(

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

    button.setAttribute(
        "aria-label",
        label
    );

    return button;

}

function renderTable(records) {

    el.table.replaceChildren();

    if (records.length === 0) {

        el.table.append(
            el.emptyTemplate.content.cloneNode(true)
        );

        el.pagination.hidden = true;

        return;

    }

    const fragment = document.createDocumentFragment();

    records.forEach(subject => {

        const exam = findExam(subject.examId);

        const row = createNode("tr");

        const nameCell = createNode(
            "td",
            "admin-table-title",
            subject.name || "Untitled subject"
        );

        const examCell = createNode(
            "td",
            "",
            exam?.name || "Parent exam unavailable"
        );

        const descriptionCell = createNode(
            "td",
            "",
            subject.description || "—"
        );

        const statusCell = createNode("td");

        statusCell.append(
            createNode(
                "span",
                subject.published === true
                    ? "admin-status-badge is-published"
                    : "admin-status-badge is-draft",
                subject.published === true
                    ? "Published"
                    : "Draft"
            )
        );

        const updatedCell = createNode(
            "td",
            "",
            formatDate(
                subject.updatedAt || subject.createdAt
            )
        );

        const actionCell = createNode("td");

        const actions = createNode(
            "div",
            "admin-table-actions"
        );

        actions.append(

            createAction(
                "Edit",
                "edit",
                subject.id
            ),

            createAction(
                subject.published === true
                    ? "Unpublish"
                    : "Publish",
                "toggle",
                subject.id
            ),

            createAction(
                "Delete",
                "delete",
                subject.id,
                true
            )

        );

        actionCell.append(actions);

        row.append(
            nameCell,
            examCell,
            descriptionCell,
            statusCell,
            updatedCell,
            actionCell
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

    setText(
        el.paginationInfo,
        `Showing ${start}–${end} of ${total}`
    );

    el.paginationButtons.replaceChildren();

    function addButton(label, page, disabled = false) {

        const button = createNode(
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

    addButton(
        "Previous",
        state.page - 1,
        state.page === 1
    );

    for (let page = 1; page <= pages; page++) {

        addButton(
            String(page),
            page
        );

    }

    addButton(
        "Next",
        state.page + 1,
        state.page === pages
    );

}

function render() {

    if (!state.examsLoaded || !state.subjectsLoaded) {
        return;
    }

    const results = getFilteredSubjects();

    const pages = Math.max(
        1,
        Math.ceil(results.length / CONFIG.pageSize)
    );

    state.page = Math.min(state.page, pages);

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
   14. MODAL CONTROLLER
===================================================== */

function openModal(modal, focusTarget) {

    if (state.activeModal) {
        closeModal(true);
    }

    state.returnFocus = document.activeElement;
    state.activeModal = modal;

    modal.hidden = false;

    document.body.style.overflow = "hidden";

    focusTarget?.focus();

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
        state.returnFocus?.isConnected &&
        !el.app.hidden
    ) {
        state.returnFocus.focus();
    }

    state.returnFocus = null;

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

    if (
        event.shiftKey &&
        document.activeElement === first
    ) {

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
   15. OPEN ADD / EDIT FORM
===================================================== */

function openSubjectForm(id = null) {

    if (!ready()) {
        return;
    }

    if (state.exams.length === 0) {

        showStatus(
            "Create a parent examination before adding subjects.",
            "warning"
        );

        return;

    }

    const subject = id ? findSubject(id) : null;

    if (id && !subject) {

        showStatus(
            "The selected subject could not be found.",
            "error"
        );

        return;

    }

    el.form.reset();

    populateExamSelectors();

    el.recordId.value = subject?.id || "";

    el.parentExam.value = subject?.examId || "";

    el.name.value = subject?.name || "";

    el.description.value = subject?.description || "";

    el.order.value = Number.isInteger(subject?.order)
        ? String(subject.order)
        : "0";

    el.publication.value = subject?.published === true
        ? "true"
        : "false";

    setText(
        el.formTitle,
        subject ? "Edit Subject" : "Add New Subject"
    );

    setText(
        el.formDescription,
        subject
            ? "Update the selected subject and its examination relationship."
            : "Select a parent examination and enter the subject details."
    );

    setText(
        el.saveText,
        subject ? "Update Subject" : "Save Subject"
    );

    openModal(
        el.formModal,
        el.parentExam
    );

}


/* =====================================================
   16. VALIDATE SUBJECT
===================================================== */

function validateSubjectForm() {

    const examId = el.parentExam.value.trim();

    const name = el.name.value.trim();

    const description = el.description.value.trim();

    const order = Number(el.order.value);

    const published = el.publication.value === "true";

    const exam = findExam(examId);

    if (!exam) {

        el.parentExam.focus();

        showStatus(
            "Select an existing parent examination.",
            "error"
        );

        return null;

    }

    if (!name || name.length > 120) {

        el.name.focus();

        showStatus(
            "Enter a subject name of up to 120 characters.",
            "error"
        );

        return null;

    }

    if (description.length > 600) {

        el.description.focus();

        showStatus(
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

        showStatus(
            "Display order must be a whole number between 0 and 99999.",
            "error"
        );

        return null;

    }

    if (published && exam.published !== true) {

        el.publication.focus();

        showStatus(
            "Publish the parent examination before publishing this subject.",
            "warning"
        );

        return null;

    }

    const currentId = el.recordId.value.trim();

    const duplicate = state.subjects.some(subject => (

        subject.id !== currentId &&

        subject.examId === examId &&

        String(subject.name || "")
            .trim()
            .toLowerCase() === name.toLowerCase()

    ));

    if (duplicate) {

        el.name.focus();

        showStatus(
            "A subject with this name already exists under the selected examination.",
            "error"
        );

        return null;

    }

    return {
        examId,
        name,
        description,
        order,
        published
    };

}


/* =====================================================
   17. SAVE SUBJECT
===================================================== */

async function handleSave(event) {

    event.preventDefault();

    if (!ready()) {
        return;
    }

    const values = validateSubjectForm();

    if (!values) {
        return;
    }

    const existingId = el.recordId.value.trim();

    const existing = existingId
        ? findSubject(existingId)
        : null;

    if (existingId && !existing) {

        showStatus(
            "This subject no longer exists. Refresh the page.",
            "error"
        );

        return;

    }

    const id = existingId || push(
        ref(database, CONFIG.paths.subjects)
    ).key;

    if (!id) {

        showStatus(
            "Unable to generate a subject identifier.",
            "error"
        );

        return;

    }

    setBusy(true, "save");

    try {

        /*
         * Recheck the parent exam immediately before
         * writing, rather than relying only on the
         * earlier live subscription.
         */

        const parentSnapshot = await get(
            ref(database, `${CONFIG.paths.exams}/${values.examId}`)
        );

        if (!parentSnapshot.exists()) {

            throw new Error(
                "The selected parent examination no longer exists."
            );

        }

        if (
            values.published &&
            parentSnapshot.val()?.published !== true
        ) {

            throw new Error(
                "The parent examination must be published first."
            );

        }

        const now = Date.now();

        const record = {

            examId: values.examId,

            name: values.name,

            description: values.description,

            order: values.order,

            published: values.published,

            createdAt: existing?.createdAt || now,

            updatedAt: now

        };

        const changes = {};

        changes[`${CONFIG.paths.subjects}/${id}`] = record;

        changes[`${CONFIG.paths.publicSubjects}/${id}`] =
            values.published ? record : null;

        await update(
            ref(database),
            changes
        );

        closeModal(true);

        showStatus(
            existing
                ? "Subject updated successfully."
                : "Subject created successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "[Subject Manager] Save error:",
            error?.code || error?.message
        );

        showStatus(
            error?.code
                ? "Unable to save the subject. Check Firebase permissions and your connection."
                : error.message,
            "error"
        );

    } finally {

        setBusy(false);

    }

}


/* =====================================================
   18. QUICK PUBLISH / UNPUBLISH
===================================================== */

async function togglePublication(id) {

    if (!ready()) {
        return;
    }

    const subject = findSubject(id);

    if (!subject) {
        return;
    }

    const published = subject.published !== true;

    setBusy(true);

    try {

        const parentSnapshot = await get(
            ref(
                database,
                `${CONFIG.paths.exams}/${subject.examId}`
            )
        );

        if (!parentSnapshot.exists()) {

            throw new Error(
                "The parent examination is unavailable."
            );

        }

        if (
            published &&
            parentSnapshot.val()?.published !== true
        ) {

            throw new Error(
                "Publish the parent examination before publishing this subject."
            );

        }

        const record = {

            examId: subject.examId,

            name: subject.name || "",

            description: subject.description || "",

            order: Number.isInteger(subject.order)
                ? subject.order
                : 0,

            published,

            createdAt: subject.createdAt || Date.now(),

            updatedAt: Date.now()

        };

        const changes = {};

        changes[`${CONFIG.paths.subjects}/${id}`] = record;

        changes[`${CONFIG.paths.publicSubjects}/${id}`] =
            published ? record : null;

        await update(
            ref(database),
            changes
        );

        showStatus(
            published
                ? "Subject published successfully."
                : "Subject unpublished successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "[Subject Manager] Publication error:",
            error?.code || error?.message
        );

        showStatus(
            error?.code
                ? "Unable to change publication status. Check database permissions."
                : error.message,
            "error"
        );

    } finally {

        setBusy(false);

    }

}


/* =====================================================
   19. DELETE CONFIRMATION
===================================================== */

function openDeleteConfirmation(id) {

    if (!ready()) {
        return;
    }

    const subject = findSubject(id);

    if (!subject) {
        return;
    }

    state.deleteId = id;

    setText(
        el.deleteName,
        subject.name || "Untitled subject"
    );

    openModal(
        el.deleteModal,
        el.cancelDelete
    );

}


/* =====================================================
   20. DEPENDENCY CHECK
===================================================== */

async function hasDependencies(subjectId) {

    const paths = [

        "admin/topics",
        "admin/lessons",
        "admin/questions",
        "admin/tests",

        "public/topics",
        "public/lessons",
        "public/questions",
        "public/tests"

    ];

    const snapshots = await Promise.all(
        paths.map(path => get(ref(database, path)))
    );

    return snapshots.some(snapshot => {

        const records = normalizeCollection(
            snapshot.val()
        );

        return records.some(record =>
            record.subjectId === subjectId
        );

    });

}


/* =====================================================
   21. DELETE SUBJECT
===================================================== */

async function handleDelete() {

    if (!ready() || !state.deleteId) {
        return;
    }

    const id = state.deleteId;

    if (!findSubject(id)) {

        closeModal(true);
        state.deleteId = null;

        showStatus(
            "The selected subject no longer exists.",
            "error"
        );

        return;

    }

    setBusy(true, "delete");

    try {

        const dependent = await hasDependencies(id);

        if (dependent) {

            closeModal(true);

            state.deleteId = null;

            showStatus(
                "Deletion blocked. Existing topics, lessons, questions, or mock tests still reference this subject.",
                "warning"
            );

            return;

        }

        const changes = {};

        changes[`${CONFIG.paths.subjects}/${id}`] = null;

        changes[`${CONFIG.paths.publicSubjects}/${id}`] = null;

        await update(
            ref(database),
            changes
        );

        closeModal(true);

        state.deleteId = null;

        showStatus(
            "Subject deleted successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "[Subject Manager] Delete error:",
            error?.code || error?.message
        );

        showStatus(
            "Unable to delete this subject. Verify database access and try again.",
            "error"
        );

    } finally {

        setBusy(false);

    }

}


/* =====================================================
   22. TABLE ACTIONS
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

            openSubjectForm(id);
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
   23. RESPONSIVE SIDEBAR
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

async function handleLogout() {

    if (state.signingOut) {
        return;
    }

    state.signingOut = true;

    el.sidebarLogout.disabled = true;
    el.topbarLogout.disabled = true;

    try {

        stopSubscriptions();

        await signOut(auth);

        window.location.replace("index.html");

    } catch (error) {

        state.signingOut = false;

        el.sidebarLogout.disabled = false;
        el.topbarLogout.disabled = false;

        showStatus(
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
        () => openSubjectForm()
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
        el.examFilter,
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
        el.examFilter.value = "all";
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

    el.sidebarNavigation.addEventListener(
        "click",
        event => {

            if (
                event.target.closest(".admin-nav-link") &&
                el.sidebar.classList.contains("is-open")
            ) {
                setSidebar(false);
            }

        }
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
        handleLogout
    );

    el.topbarLogout.addEventListener(
        "click",
        handleLogout
    );

}


/* =====================================================
   26. INITIALIZATION
===================================================== */

function initialize() {

    if (
        state.initialized ||
        document.body.dataset.page !== "admin-subjects"
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
            "[Subject Manager] Missing HTML elements:",
            missing
        );

        return;

    }

    state.initialized = true;

    setText(
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
   27. APPLICATION START
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
   END OF ADMIN-SUBJECTS.JS
===================================================== */
