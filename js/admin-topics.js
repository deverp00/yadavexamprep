
/*
=========================================================
YADAV EXAMPREP
File: js/admin-topics.js

Administrator Topic Management
Firebase Realtime Database

Designed and Developed by Yadav Web Technologies

Master: admin/topics/{topicId}
Public: public/topics/{topicId}

No sample or default educational records.
=========================================================
*/

"use strict";

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
   01. CONFIGURATION
===================================================== */

const CONFIG = Object.freeze({

    adminUID: "6HwAPbqwYBgg5Ih2zWycOZFBCe93",

    pageSize: 10,

    paths: {
        exams: "admin/exams",
        subjects: "admin/subjects",
        topics: "admin/topics",
        publicTopics: "public/topics"
    },

    selectors: {

        gate: "#adminAuthGate",
        gateSpinner: "#adminGateSpinner",
        gateTitle: "#adminGateTitle",
        gateDescription: "#adminGateDescription",
        gateLoginLink: "#adminGateLoginLink",

        app: "#adminTopicsApp",

        sidebar: "#adminSidebar",
        backdrop: "#adminSidebarBackdrop",
        menuToggle: "#adminMenuToggle",
        sidebarClose: "#adminSidebarClose",
        sidebarNavigation: "#adminSidebarNavigation",

        sidebarLogout: "#adminSidebarLogout",
        topbarLogout: "#adminTopbarLogout",
        userEmail: "#adminUserEmail",

        status: "#topicManagementStatus",
        statusSpinner: "#topicManagementSpinner",
        statusText: "#topicManagementStatusText",

        addButton: "#addTopicButton",

        total: "#topicTotalCount",
        published: "#topicPublishedCount",
        drafts: "#topicDraftCount",
        filtered: "#topicFilteredCount",

        filterForm: "#topicFilterForm",
        search: "#topicSearch",
        examFilter: "#topicExamFilter",
        subjectFilter: "#topicSubjectFilter",
        statusFilter: "#topicStatusFilter",
        sort: "#topicSortFilter",
        reset: "#resetTopicFilters",

        table: "#topicTableBody",
        emptyTemplate: "#topicEmptyStateTemplate",

        pagination: "#topicPagination",
        paginationInfo: "#topicPaginationInfo",
        paginationButtons: "#topicPaginationButtons",

        formModal: "#topicFormModal",
        formTitle: "#topicFormModalTitle",
        formDescription: "#topicFormModalDescription",
        closeForm: "#closeTopicFormModal",
        cancelForm: "#cancelTopicForm",

        form: "#topicForm",
        recordId: "#topicRecordId",
        parentExam: "#topicParentExam",
        parentSubject: "#topicParentSubject",
        name: "#topicName",
        description: "#topicDescription",
        order: "#topicDisplayOrder",
        publication: "#topicPublicationStatus",
        practiceTest: "#topicPracticeTest",

        saveButton: "#saveTopicButton",
        saveText: "#saveTopicButtonText",
        saveSpinner: "#saveTopicSpinner",

        deleteModal: "#deleteTopicModal",
        closeDelete: "#closeDeleteTopicModal",
        cancelDelete: "#cancelDeleteTopic",
        confirmDelete: "#confirmDeleteTopic",
        deleteName: "#deleteTopicName",
        deleteText: "#deleteTopicButtonText",
        deleteSpinner: "#deleteTopicSpinner",

        year: "#currentYear"

    }

});


/* =====================================================
   02. APPLICATION STATE
===================================================== */

const state = {

    initialized: false,
    authorized: false,
    busy: false,
    signingOut: false,

    loaded: {
        exams: false,
        subjects: false,
        topics: false
    },

    exams: [],
    subjects: [],
    topics: [],

    page: 1,
    deleteId: null,

    subscriptions: [],
    sessionVersion: 0,

    activeModal: null,
    returnFocus: null

};

const el = {};


/* =====================================================
   03. UTILITIES
===================================================== */

function setText(element, value) {

    if (element) {
        element.textContent = String(value);
    }

}

function createNode(tag, className = "", value) {

    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (value !== undefined) {
        element.textContent = String(value);
    }

    return element;

}

function normalize(value) {

    if (!value || typeof value !== "object") {
        return [];
    }

    return Object.entries(value)
        .filter(([, item]) =>
            item &&
            typeof item === "object" &&
            !Array.isArray(item)
        )
        .map(([id, item]) => ({
            ...item,
            id
        }));

}

function findExam(id) {

    return state.exams.find(item => item.id === id) || null;

}

function findSubject(id) {

    return state.subjects.find(item => item.id === id) || null;

}

function findTopic(id) {

    return state.topics.find(item => item.id === id) || null;

}

function allLoaded() {

    return Object.values(state.loaded).every(Boolean);

}

function ready() {

    return state.authorized && allLoaded() && !state.busy;

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

function formatDate(value) {

    if (value === undefined || value === null || value === "") {
        return "—";
    }

    const milliseconds =
        typeof value === "number" && value < 100000000000
            ? value * 1000
            : value;

    const date = new Date(milliseconds);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(date);

}


/* =====================================================
   04. AUTHENTICATION GATE
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

    state.subscriptions.forEach(unsubscribe => {
        if (typeof unsubscribe === "function") {
            unsubscribe();
        }
    });

    state.subscriptions = [];

}

function setControlsEnabled(enabled) {

    [
        el.search,
        el.examFilter,
        el.subjectFilter,
        el.statusFilter,
        el.sort,
        el.reset
    ].forEach(control => {
        control.disabled = !enabled;
    });

    el.addButton.disabled =
        !enabled ||
        state.exams.length === 0 ||
        state.subjects.length === 0;

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

function setBusy(busy, action = "save") {

    state.busy = busy;

    el.saveButton.disabled = busy;
    el.confirmDelete.disabled = busy;

    el.saveSpinner.hidden = !(busy && action === "save");
    el.deleteSpinner.hidden = !(busy && action === "delete");

    setText(
        el.saveText,
        busy && action === "save"
            ? "Saving..."
            : el.recordId.value
                ? "Update Topic"
                : "Save Topic"
    );

    setText(
        el.deleteText,
        busy && action === "delete"
            ? "Deleting..."
            : "Delete Topic"
    );

    setControlsEnabled(ready());

}


/* =====================================================
   05. FIREBASE AUTH OBSERVER
===================================================== */

function observeSession() {

    onAuthStateChanged(

        auth,

        async user => {

            const version = ++state.sessionVersion;

            if (!isAdministrator(user)) {

                state.authorized = false;

                stopSubscriptions();
                setControlsEnabled(false);
                closeModal(true);

                Object.keys(state.loaded).forEach(key => {
                    state.loaded[key] = false;
                });

                showGate(
                    user ? "Access Denied" : "Sign In Required",
                    user
                        ? "This Firebase account is not authorized to manage topics."
                        : "Sign in with your administrator account to continue.",
                    true
                );

                if (user) {

                    try {
                        await signOut(auth);
                    } catch (error) {
                        console.error(
                            "[Topic Manager] Unauthorized sign-out:",
                            error?.code
                        );
                    }

                }

                return;

            }

            if (version !== state.sessionVersion) {
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
                    "Firebase Realtime Database is not configured. Add the actual databaseURL to js/firebase-config.js.",
                    "error"
                );

                showTableMessage(
                    "Database configuration is required."
                );

                return;

            }

            subscribeCollections(version);

        },

        error => {

            state.authorized = false;
            ++state.sessionVersion;

            stopSubscriptions();
            setControlsEnabled(false);

            console.error(
                "[Topic Manager] Authentication error:",
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
   06. REALTIME DATABASE SUBSCRIPTIONS
===================================================== */

function subscribeCollections(version) {

    stopSubscriptions();

    Object.keys(state.loaded).forEach(key => {
        state.loaded[key] = false;
    });

    setControlsEnabled(false);

    showStatus(
        "Loading exams, subjects, and topics from Firebase..."
    );

    const collections = [
        ["exams", CONFIG.paths.exams],
        ["subjects", CONFIG.paths.subjects],
        ["topics", CONFIG.paths.topics]
    ];

    collections.forEach(([key, path]) => {

        const unsubscribe = onValue(

            ref(database, path),

            snapshot => {

                if (
                    !state.authorized ||
                    version !== state.sessionVersion
                ) {
                    return;
                }

                state[key] = normalize(snapshot.val());
                state.loaded[key] = true;

                if (key === "exams" || key === "subjects") {
                    populateSelectors();
                }

                finishLoading();

            },

            error => {

                if (version !== state.sessionVersion) {
                    return;
                }

                state.loaded[key] = false;

                setControlsEnabled(false);

                console.error(
                    `[Topic Manager] ${key} read error:`,
                    error?.code
                );

                showStatus(
                    "Unable to load Firebase records. Check your database URL and Security Rules.",
                    "error"
                );

                showTableMessage(
                    "Topic records could not be loaded."
                );

            }

        );

        state.subscriptions.push(unsubscribe);

    });

}

function finishLoading() {

    if (!allLoaded()) {
        return;
    }

    setControlsEnabled(!state.busy);

    render();

    if (!state.exams.length) {

        showStatus(
            "Create an examination before adding topics.",
            "warning"
        );

    } else if (!state.subjects.length) {

        showStatus(
            "Create a subject before adding topics.",
            "warning"
        );

    } else {

        showStatus(
            "Topic records are synchronized with Firebase Realtime Database.",
            "success"
        );

    }

}


/* =====================================================
   07. EXAM AND SUBJECT SELECTORS
===================================================== */

function sortedByName(records) {

    return [...records].sort((a, b) =>
        String(a.name || "").localeCompare(
            String(b.name || "")
        )
    );

}

function populateSelectors() {

    const filterExam = el.examFilter.value;
    const formExam = el.parentExam.value;

    el.examFilter.replaceChildren(
        new Option("All Exams", "all")
    );

    el.parentExam.replaceChildren(
        new Option("Select an examination", "")
    );

    sortedByName(state.exams).forEach(exam => {

        const name = exam.name || "Untitled exam";

        el.examFilter.add(
            new Option(name, exam.id)
        );

        el.parentExam.add(
            new Option(
                exam.published === true
                    ? name
                    : `${name} (Draft)`,
                exam.id
            )
        );

    });

    if (findExam(filterExam)) {
        el.examFilter.value = filterExam;
    }

    if (findExam(formExam)) {
        el.parentExam.value = formExam;
    }

    populateFilterSubjects();
    populateFormSubjects();

}

function populateFilterSubjects() {

    const selected = el.subjectFilter.value;
    const examId = el.examFilter.value;

    el.subjectFilter.replaceChildren(
        new Option("All Subjects", "all")
    );

    sortedByName(state.subjects)
        .filter(subject =>
            examId === "all" || subject.examId === examId
        )
        .forEach(subject => {

            el.subjectFilter.add(
                new Option(
                    subject.name || "Untitled subject",
                    subject.id
                )
            );

        });

    if ([...el.subjectFilter.options].some(
        option => option.value === selected
    )) {
        el.subjectFilter.value = selected;
    }

}

function populateFormSubjects() {

    const selected = el.parentSubject.value;
    const examId = el.parentExam.value;

    el.parentSubject.replaceChildren(
        new Option("Select a subject", "")
    );

    sortedByName(state.subjects)
        .filter(subject => subject.examId === examId)
        .forEach(subject => {

            const name = subject.name || "Untitled subject";

            el.parentSubject.add(
                new Option(
                    subject.published === true
                        ? name
                        : `${name} (Draft)`,
                    subject.id
                )
            );

        });

    if ([...el.parentSubject.options].some(
        option => option.value === selected
    )) {
        el.parentSubject.value = selected;
    }

    el.parentSubject.disabled = !examId;

}


/* =====================================================
   08. FILTERING AND SORTING
===================================================== */

function getFilteredTopics() {

    const query = el.search.value.trim().toLowerCase();

    const examId = el.examFilter.value;
    const subjectId = el.subjectFilter.value;
    const publication = el.statusFilter.value;
    const sort = el.sort.value;

    const results = state.topics.filter(topic => {

        const exam = findExam(topic.examId);
        const subject = findSubject(topic.subjectId);

        const searchable = [
            topic.name,
            topic.description,
            exam?.name,
            subject?.name
        ].map(value =>
            typeof value === "string" ? value : ""
        ).join(" ").toLowerCase();

        if (query && !searchable.includes(query)) {
            return false;
        }

        if (examId !== "all" && topic.examId !== examId) {
            return false;
        }

        if (
            subjectId !== "all" &&
            topic.subjectId !== subjectId
        ) {
            return false;
        }

        if (
            publication === "published" &&
            topic.published !== true
        ) {
            return false;
        }

        if (
            publication === "draft" &&
            topic.published === true
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

        if (sort === "order-asc") {

            const first = Number.isInteger(a.order)
                ? a.order
                : 0;

            const second = Number.isInteger(b.order)
                ? b.order
                : 0;

            return first - second ||
                String(a.name || "").localeCompare(
                    String(b.name || "")
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
   09. STATISTICS
===================================================== */

function renderStatistics(results) {

    const published = state.topics.filter(
        topic => topic.published === true
    ).length;

    setText(el.total, state.topics.length);
    setText(el.published, published);
    setText(el.drafts, state.topics.length - published);
    setText(el.filtered, results.length);

}


/* =====================================================
   10. TABLE RENDERING
===================================================== */

function showTableMessage(message) {

    const row = createNode("tr");
    const cell = createNode("td");

    cell.colSpan = 7;

    const container = createNode(
        "div",
        "admin-empty-state"
    );

    container.append(
        createNode("p", "", message)
    );

    cell.append(container);
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
    button.setAttribute("aria-label", label);

    return button;

}

function renderTable(records) {

    el.table.replaceChildren();

    if (!records.length) {

        el.table.append(
            el.emptyTemplate.content.cloneNode(true)
        );

        el.pagination.hidden = true;
        return;

    }

    const fragment = document.createDocumentFragment();

    records.forEach(topic => {

        const exam = findExam(topic.examId);
        const subject = findSubject(topic.subjectId);

        const row = createNode("tr");

        const nameCell = createNode(
            "td",
            "admin-table-title",
            topic.name || "Untitled topic"
        );

        const examCell = createNode(
            "td",
            "",
            exam?.name || "Exam unavailable"
        );

        const subjectCell = createNode(
            "td",
            "",
            subject?.name || "Subject unavailable"
        );

        const orderCell = createNode(
            "td",
            "",
            Number.isInteger(topic.order)
                ? topic.order
                : "—"
        );

        const statusCell = createNode("td");

        statusCell.append(
            createNode(
                "span",
                topic.published === true
                    ? "admin-status-badge is-published"
                    : "admin-status-badge is-draft",
                topic.published === true
                    ? "Published"
                    : "Draft"
            )
        );

        const updatedCell = createNode(
            "td",
            "",
            formatDate(topic.updatedAt || topic.createdAt)
        );

        const actionsCell = createNode("td");

        const actions = createNode(
            "div",
            "admin-table-actions"
        );

        actions.append(
            createAction("Edit", "edit", topic.id),

            createAction(
                topic.published === true
                    ? "Unpublish"
                    : "Publish",
                "toggle",
                topic.id
            ),

            createAction(
                "Delete",
                "delete",
                topic.id,
                true
            )
        );

        actionsCell.append(actions);

        row.append(
            nameCell,
            examCell,
            subjectCell,
            orderCell,
            statusCell,
            updatedCell,
            actionsCell
        );

        fragment.append(row);

    });

    el.table.append(fragment);

}


/* =====================================================
   11. PAGINATION
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

    function addPage(label, page, disabled = false) {

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

    addPage(
        "Previous",
        state.page - 1,
        state.page === 1
    );

    for (let page = 1; page <= pages; page++) {
        addPage(String(page), page);
    }

    addPage(
        "Next",
        state.page + 1,
        state.page === pages
    );

}

function render() {

    if (!allLoaded()) {
        return;
    }

    const results = getFilteredTopics();

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
   12. MODAL MANAGEMENT
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
   13. OPEN TOPIC FORM
===================================================== */

function openTopicForm(id = null) {

    if (!ready()) {
        return;
    }

    const topic = id ? findTopic(id) : null;

    if (id && !topic) {

        showStatus(
            "The selected topic could not be found.",
            "error"
        );

        return;

    }

    if (!state.exams.length || !state.subjects.length) {

        showStatus(
            "Create an exam and its subject before adding topics.",
            "warning"
        );

        return;

    }

    el.form.reset();

    populateSelectors();

    el.recordId.value = topic?.id || "";
    el.parentExam.value = topic?.examId || "";

    populateFormSubjects();

    el.parentSubject.value = topic?.subjectId || "";

    el.name.value = topic?.name || "";
    el.description.value = topic?.description || "";

    el.order.value = Number.isInteger(topic?.order)
        ? String(topic.order)
        : "0";

    el.publication.value = topic?.published === true
        ? "true"
        : "false";

    /*
     * Practice-test linking is intentionally disabled
     * until the Mock Test Manager is integrated.
     * Existing IDs are preserved on edit.
     */

    el.practiceTest.replaceChildren(
        new Option("No practice test linked", "")
    );

    el.practiceTest.disabled = true;

    setText(
        el.formTitle,
        topic ? "Edit Topic" : "Add New Topic"
    );

    setText(
        el.formDescription,
        topic
            ? "Update the selected topic and its parent relationships."
            : "Choose an examination and subject, then enter the topic details."
    );

    setText(
        el.saveText,
        topic ? "Update Topic" : "Save Topic"
    );

    openModal(el.formModal, el.parentExam);

}


/* =====================================================
   14. FORM VALIDATION
===================================================== */

function validateForm() {

    const examId = el.parentExam.value.trim();
    const subjectId = el.parentSubject.value.trim();

    const name = el.name.value.trim();
    const description = el.description.value.trim();

    const order = Number(el.order.value);
    const published = el.publication.value === "true";

    const exam = findExam(examId);
    const subject = findSubject(subjectId);

    if (!exam) {

        el.parentExam.focus();

        showStatus(
            "Select an existing examination.",
            "error"
        );

        return null;

    }

    if (!subject || subject.examId !== examId) {

        el.parentSubject.focus();

        showStatus(
            "Select a subject belonging to the chosen examination.",
            "error"
        );

        return null;

    }

    if (!name || name.length > 150) {

        el.name.focus();

        showStatus(
            "Enter a topic name of up to 150 characters.",
            "error"
        );

        return null;

    }

    if (description.length > 800) {

        el.description.focus();

        showStatus(
            "The topic description cannot exceed 800 characters.",
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

    if (
        published &&
        (
            exam.published !== true ||
            subject.published !== true
        )
    ) {

        el.publication.focus();

        showStatus(
            "Publish both the parent examination and subject before publishing this topic.",
            "warning"
        );

        return null;

    }

    const currentId = el.recordId.value.trim();

    const duplicate = state.topics.some(topic =>

        topic.id !== currentId &&
        topic.subjectId === subjectId &&
        String(topic.name || "")
            .trim()
            .toLowerCase() === name.toLowerCase()

    );

    if (duplicate) {

        el.name.focus();

        showStatus(
            "A topic with this name already exists under the selected subject.",
            "error"
        );

        return null;

    }

    return {
        examId,
        subjectId,
        name,
        description,
        order,
        published
    };

}


/* =====================================================
   15. VERIFY PARENT RECORDS
===================================================== */

async function verifyParents(values) {

    const [examSnapshot, subjectSnapshot] = await Promise.all([

        get(
            ref(
                database,
                `${CONFIG.paths.exams}/${values.examId}`
            )
        ),

        get(
            ref(
                database,
                `${CONFIG.paths.subjects}/${values.subjectId}`
            )
        )

    ]);

    if (!examSnapshot.exists()) {
        throw new Error(
            "The parent examination no longer exists."
        );
    }

    if (!subjectSnapshot.exists()) {
        throw new Error(
            "The parent subject no longer exists."
        );
    }

    const exam = examSnapshot.val();
    const subject = subjectSnapshot.val();

    if (subject.examId !== values.examId) {

        throw new Error(
            "The selected subject does not belong to this examination."
        );

    }

    if (
        values.published &&
        (
            exam.published !== true ||
            subject.published !== true
        )
    ) {

        throw new Error(
            "Both the parent examination and subject must be published first."
        );

    }

}


/* =====================================================
   16. SAVE TOPIC
===================================================== */

async function handleSave(event) {

    event.preventDefault();

    if (!ready()) {
        return;
    }

    const values = validateForm();

    if (!values) {
        return;
    }

    const existingId = el.recordId.value.trim();

    const existing = existingId
        ? findTopic(existingId)
        : null;

    if (existingId && !existing) {

        showStatus(
            "This topic no longer exists. Refresh the page.",
            "error"
        );

        return;

    }

    const id = existingId || push(
        ref(database, CONFIG.paths.topics)
    ).key;

    if (!id) {

        showStatus(
            "Unable to generate a topic identifier.",
            "error"
        );

        return;

    }

    const version = state.sessionVersion;

    setBusy(true, "save");

    try {

        await verifyParents(values);

        if (!state.authorized || version !== state.sessionVersion) {
            throw new Error("Administrator session changed.");
        }

        const now = Date.now();

        const record = {

            examId: values.examId,
            subjectId: values.subjectId,

            name: values.name,
            description: values.description,

            order: values.order,
            published: values.published,

            createdAt: existing?.createdAt || now,
            updatedAt: now

        };

        /*
         * Preserve an existing practice-test relationship
         * until the dedicated linking interface is ready.
         */

        if (
            existing &&
            typeof existing.practiceTestId === "string" &&
            existing.practiceTestId.trim()
        ) {
            record.practiceTestId = existing.practiceTestId;
        }

        const changes = {};

        changes[`${CONFIG.paths.topics}/${id}`] = record;

        changes[`${CONFIG.paths.publicTopics}/${id}`] =
            values.published ? record : null;

        await update(ref(database), changes);

        closeModal(true);

        showStatus(
            existing
                ? "Topic updated successfully."
                : "Topic created successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "[Topic Manager] Save error:",
            error?.code || error?.message
        );

        showStatus(
            error?.code
                ? "Unable to save the topic. Check Firebase permissions and your connection."
                : error.message,
            "error"
        );

    } finally {

        setBusy(false);

    }

}


/* =====================================================
   17. QUICK PUBLICATION TOGGLE
===================================================== */

async function togglePublication(id) {

    if (!ready()) {
        return;
    }

    const topic = findTopic(id);

    if (!topic) {
        return;
    }

    const published = topic.published !== true;

    const version = state.sessionVersion;

    setBusy(true);

    try {

        const values = {
            examId: topic.examId,
            subjectId: topic.subjectId,
            published
        };

        await verifyParents(values);

        if (!state.authorized || version !== state.sessionVersion) {
            throw new Error("Administrator session changed.");
        }

        const record = {

            examId: topic.examId,
            subjectId: topic.subjectId,

            name: topic.name || "",
            description: topic.description || "",

            order: Number.isInteger(topic.order)
                ? topic.order
                : 0,

            published,

            createdAt: topic.createdAt || Date.now(),
            updatedAt: Date.now()

        };

        if (
            typeof topic.practiceTestId === "string" &&
            topic.practiceTestId.trim()
        ) {
            record.practiceTestId = topic.practiceTestId;
        }

        const changes = {};

        changes[`${CONFIG.paths.topics}/${id}`] = record;

        changes[`${CONFIG.paths.publicTopics}/${id}`] =
            published ? record : null;

        await update(ref(database), changes);

        showStatus(
            published
                ? "Topic published successfully."
                : "Topic unpublished successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "[Topic Manager] Publication error:",
            error?.code || error?.message
        );

        showStatus(
            error?.code
                ? "Unable to change publication status. Check Firebase permissions."
                : error.message,
            "error"
        );

    } finally {

        setBusy(false);

    }

}


/* =====================================================
   18. DELETE CONFIRMATION
===================================================== */

function openDeleteConfirmation(id) {

    if (!ready()) {
        return;
    }

    const topic = findTopic(id);

    if (!topic) {
        return;
    }

    state.deleteId = id;

    setText(
        el.deleteName,
        topic.name || "Untitled topic"
    );

    openModal(
        el.deleteModal,
        el.cancelDelete
    );

}


/* =====================================================
   19. DEPENDENCY CHECK
===================================================== */

async function hasDependencies(topicId) {

    const paths = [

        "admin/lessons",
        "admin/questions",
        "admin/tests",

        "public/lessons",
        "public/questions",
        "public/tests"

    ];

    const snapshots = await Promise.all(
        paths.map(path => get(ref(database, path)))
    );

    return snapshots.some(snapshot => {

        const records = normalize(snapshot.val());

        return records.some(record =>
            record.topicId === topicId
        );

    });

}


/* =====================================================
   20. DELETE TOPIC
===================================================== */

async function handleDelete() {

    if (!ready() || !state.deleteId) {
        return;
    }

    const id = state.deleteId;

    if (!findTopic(id)) {

        closeModal(true);
        state.deleteId = null;

        showStatus(
            "The selected topic no longer exists.",
            "error"
        );

        return;

    }

    const version = state.sessionVersion;

    setBusy(true, "delete");

    try {

        const dependent = await hasDependencies(id);

        if (dependent) {

            closeModal(true);
            state.deleteId = null;

            showStatus(
                "Deletion blocked. Existing lessons, questions, or mock tests still reference this topic.",
                "warning"
            );

            return;

        }

        if (!state.authorized || version !== state.sessionVersion) {
            throw new Error("Administrator session changed.");
        }

        const changes = {};

        changes[`${CONFIG.paths.topics}/${id}`] = null;
        changes[`${CONFIG.paths.publicTopics}/${id}`] = null;

        await update(ref(database), changes);

        closeModal(true);
        state.deleteId = null;

        showStatus(
            "Topic deleted successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "[Topic Manager] Delete error:",
            error?.code || error?.message
        );

        showStatus(
            "Unable to delete this topic. Verify its dependencies and database permissions.",
            "error"
        );

    } finally {

        setBusy(false);

    }

}


/* =====================================================
   21. TABLE ACTIONS
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
            openTopicForm(id);
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
   22. SIDEBAR
===================================================== */

function setSidebar(open) {

    el.sidebar.classList.toggle("is-open", open);

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
   23. LOGOUT
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
   24. EVENT REGISTRATION
===================================================== */

function registerEvents() {

    el.addButton.addEventListener(
        "click",
        () => openTopicForm()
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

    el.search.addEventListener("input", () => {
        state.page = 1;
        render();
    });

    el.examFilter.addEventListener("change", () => {

        populateFilterSubjects();

        state.page = 1;
        render();

    });

    [
        el.subjectFilter,
        el.statusFilter,
        el.sort
    ].forEach(control => {

        control.addEventListener("change", () => {
            state.page = 1;
            render();
        });

    });

    el.parentExam.addEventListener("change", () => {

        el.parentSubject.value = "";
        populateFormSubjects();

    });

    el.reset.addEventListener("click", () => {

        el.search.value = "";
        el.examFilter.value = "all";

        populateFilterSubjects();

        el.subjectFilter.value = "all";
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
   25. INITIALIZATION
===================================================== */

function initialize() {

    if (
        state.initialized ||
        document.body.dataset.page !== "admin-topics"
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
            "[Topic Manager] Missing HTML elements:",
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
   26. APPLICATION START
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
   END OF ADMIN-TOPICS.JS
===================================================== */
