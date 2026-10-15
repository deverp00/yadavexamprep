
/*
=========================================================
YADAV EXAMPREP
File: js/admin-lessons.js

Administrator Lesson Management
Firebase Realtime Database

Designed and Developed by Yadav Web Technologies

Protected: admin/lessons/{lessonId}
Public:    public/lessons/{lessonId}

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
        lessons: "admin/lessons",
        publicLessons: "public/lessons"
    },

    selectors: {

        gate: "#adminAuthGate",
        gateSpinner: "#adminGateSpinner",
        gateTitle: "#adminGateTitle",
        gateDescription: "#adminGateDescription",
        gateLoginLink: "#adminGateLoginLink",

        app: "#adminLessonsApp",

        sidebar: "#adminSidebar",
        backdrop: "#adminSidebarBackdrop",
        menuToggle: "#adminMenuToggle",
        sidebarClose: "#adminSidebarClose",
        sidebarNavigation: "#adminSidebarNavigation",

        sidebarLogout: "#adminSidebarLogout",
        topbarLogout: "#adminTopbarLogout",
        userEmail: "#adminUserEmail",

        status: "#lessonManagementStatus",
        statusSpinner: "#lessonManagementSpinner",
        statusText: "#lessonManagementStatusText",

        addButton: "#addLessonButton",

        total: "#lessonTotalCount",
        published: "#lessonPublishedCount",
        drafts: "#lessonDraftCount",
        filtered: "#lessonFilteredCount",

        filterForm: "#lessonFilterForm",
        search: "#lessonSearch",
        examFilter: "#lessonExamFilter",
        subjectFilter: "#lessonSubjectFilter",
        topicFilter: "#lessonTopicFilter",
        statusFilter: "#lessonStatusFilter",
        sort: "#lessonSortFilter",
        reset: "#resetLessonFilters",

        table: "#lessonTableBody",
        emptyTemplate: "#lessonEmptyStateTemplate",

        pagination: "#lessonPagination",
        paginationInfo: "#lessonPaginationInfo",
        paginationButtons: "#lessonPaginationButtons",

        formModal: "#lessonFormModal",
        formTitle: "#lessonFormModalTitle",
        formDescription: "#lessonFormModalDescription",
        closeForm: "#closeLessonFormModal",
        cancelForm: "#cancelLessonForm",

        form: "#lessonForm",
        recordId: "#lessonRecordId",
        parentExam: "#lessonParentExam",
        parentSubject: "#lessonParentSubject",
        parentTopic: "#lessonParentTopic",

        title: "#lessonTitle",
        description: "#lessonDescription",
        content: "#lessonContent",
        characterCount: "#lessonCharacterCount",
        order: "#lessonDisplayOrder",
        publication: "#lessonPublicationStatus",

        saveButton: "#saveLessonButton",
        saveText: "#saveLessonButtonText",
        saveSpinner: "#saveLessonSpinner",

        deleteModal: "#deleteLessonModal",
        closeDelete: "#closeDeleteLessonModal",
        cancelDelete: "#cancelDeleteLesson",
        confirmDelete: "#confirmDeleteLesson",
        deleteTitle: "#deleteLessonTitle",
        deleteText: "#deleteLessonButtonText",
        deleteSpinner: "#deleteLessonSpinner",

        year: "#currentYear"

    }

});


/* =====================================================
   02. STATE
===================================================== */

const state = {

    initialized: false,
    authorized: false,
    busy: false,
    signingOut: false,

    sessionVersion: 0,

    loaded: {
        exams: false,
        subjects: false,
        topics: false,
        lessons: false
    },

    exams: [],
    subjects: [],
    topics: [],
    lessons: [],

    subscriptions: [],

    page: 1,
    deleteId: null,

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

function findLesson(id) {

    return state.lessons.find(item => item.id === id) || null;

}

function allLoaded() {

    return Object.values(state.loaded).every(Boolean);

}

function ready() {

    return state.authorized && allLoaded() && !state.busy;

}

function sortedByName(records, field = "name") {

    return [...records].sort((a, b) =>
        String(a[field] || "").localeCompare(
            String(b[field] || "")
        )
    );

}

function getTimestamp(value) {

    if (typeof value === "number") {

        return value < 100000000000
            ? value * 1000
            : value;

    }

    return typeof value === "string"
        ? Date.parse(value) || 0
        : 0;

}

function formatDate(value) {

    const timestamp = getTimestamp(value);

    if (!timestamp) {
        return "—";
    }

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(new Date(timestamp));

}

function sessionValid(version) {

    return (
        state.authorized &&
        version === state.sessionVersion &&
        auth.currentUser?.uid === CONFIG.adminUID
    );

}


/* =====================================================
   04. STATUS AND ACCESS GATE
===================================================== */

function showGate(title, description, showLogin = false) {

    el.app.hidden = true;
    el.gate.hidden = false;

    setText(el.gateTitle, title);
    setText(el.gateDescription, description);

    el.gateSpinner.hidden = showLogin;
    el.gateLoginLink.hidden = !showLogin;

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

function setControlsEnabled(enabled) {

    [
        el.search,
        el.examFilter,
        el.subjectFilter,
        el.topicFilter,
        el.statusFilter,
        el.sort,
        el.reset
    ].forEach(control => {

        control.disabled = !enabled;

    });

    el.addButton.disabled =
        !enabled ||
        !state.topics.some(topic =>
            Boolean(
                findSubject(topic.subjectId) &&
                findExam(topic.examId)
            )
        );

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
                ? "Update Lesson"
                : "Save Lesson"
    );

    setText(
        el.deleteText,
        busy && action === "delete"
            ? "Deleting..."
            : "Delete Lesson"
    );

    setControlsEnabled(ready());

}


/* =====================================================
   05. AUTHENTICATION
===================================================== */

function stopSubscriptions() {

    state.subscriptions.forEach(unsubscribe => {

        if (typeof unsubscribe === "function") {
            unsubscribe();
        }

    });

    state.subscriptions = [];

}

function observeSession() {

    onAuthStateChanged(

        auth,

        async user => {

            const version = ++state.sessionVersion;

            if (!user || user.uid !== CONFIG.adminUID) {

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
                        ? "This account is not authorized to manage lessons."
                        : "Sign in with your administrator account to continue.",
                    true
                );

                if (user) {

                    try {
                        await signOut(auth);
                    } catch (error) {
                        console.error(
                            "[Lesson Manager] Unauthorized sign-out:",
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

            subscribeCollections(version);

        },

        error => {

            ++state.sessionVersion;

            state.authorized = false;

            stopSubscriptions();
            setControlsEnabled(false);

            console.error(
                "[Lesson Manager] Authentication error:",
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
   06. FIREBASE REALTIME SUBSCRIPTIONS
===================================================== */

function subscribeCollections(version) {

    stopSubscriptions();

    Object.keys(state.loaded).forEach(key => {
        state.loaded[key] = false;
    });

    setControlsEnabled(false);

    showStatus(
        "Loading examinations, subjects, topics, and lessons..."
    );

    const collections = [
        ["exams", CONFIG.paths.exams],
        ["subjects", CONFIG.paths.subjects],
        ["topics", CONFIG.paths.topics],
        ["lessons", CONFIG.paths.lessons]
    ];

    collections.forEach(([key, path]) => {

        const unsubscribe = onValue(

            ref(database, path),

            snapshot => {

                if (!sessionValid(version)) {
                    return;
                }

                state[key] = normalize(snapshot.val());
                state.loaded[key] = true;

                if (key !== "lessons") {
                    populateSelectors();
                }

                finishLoading();

            },

            error => {

                if (!sessionValid(version)) {
                    return;
                }

                state.loaded[key] = false;

                setControlsEnabled(false);

                console.error(
                    `[Lesson Manager] ${key} read error:`,
                    error?.code
                );

                showStatus(
                    "Unable to load Firebase records. Check database configuration and Security Rules.",
                    "error"
                );

                showTableMessage(
                    "Lesson records could not be loaded."
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
            "Create an examination before adding lessons.",
            "warning"
        );

    } else if (!state.subjects.length) {

        showStatus(
            "Create a subject before adding lessons.",
            "warning"
        );

    } else if (!state.topics.length) {

        showStatus(
            "Create a topic before adding lessons.",
            "warning"
        );

    } else {

        showStatus(
            "Lesson records are synchronized with Firebase Realtime Database.",
            "success"
        );

    }

}


/* =====================================================
   07. SELECT OPTION HELPERS
===================================================== */

function addOption(select, label, value) {

    select.add(new Option(label, value));

}

function optionExists(select, value) {

    return [...select.options].some(
        option => option.value === value
    );

}

function populateSelectors() {

    const previousFilterExam = el.examFilter.value;
    const previousFormExam = el.parentExam.value;

    el.examFilter.replaceChildren(
        new Option("All Exams", "all")
    );

    el.parentExam.replaceChildren(
        new Option("Select an examination", "")
    );

    sortedByName(state.exams).forEach(exam => {

        const name = exam.name || "Untitled exam";

        addOption(
            el.examFilter,
            name,
            exam.id
        );

        addOption(
            el.parentExam,
            exam.published === true
                ? name
                : `${name} (Draft)`,
            exam.id
        );

    });

    if (optionExists(el.examFilter, previousFilterExam)) {
        el.examFilter.value = previousFilterExam;
    }

    if (optionExists(el.parentExam, previousFormExam)) {
        el.parentExam.value = previousFormExam;
    }

    populateFilterSubjects();
    populateFormSubjects();

}


/* =====================================================
   08. CASCADING FILTER SELECTORS
===================================================== */

function populateFilterSubjects() {

    const previous = el.subjectFilter.value;
    const examId = el.examFilter.value;

    el.subjectFilter.replaceChildren(
        new Option("All Subjects", "all")
    );

    sortedByName(state.subjects)
        .filter(subject =>
            examId === "all" ||
            subject.examId === examId
        )
        .forEach(subject => {

            addOption(
                el.subjectFilter,
                subject.name || "Untitled subject",
                subject.id
            );

        });

    if (optionExists(el.subjectFilter, previous)) {
        el.subjectFilter.value = previous;
    }

    populateFilterTopics();

}

function populateFilterTopics() {

    const previous = el.topicFilter.value;

    const examId = el.examFilter.value;
    const subjectId = el.subjectFilter.value;

    el.topicFilter.replaceChildren(
        new Option("All Topics", "all")
    );

    sortedByName(state.topics)
        .filter(topic => {

            if (
                examId !== "all" &&
                topic.examId !== examId
            ) {
                return false;
            }

            if (
                subjectId !== "all" &&
                topic.subjectId !== subjectId
            ) {
                return false;
            }

            return true;

        })
        .forEach(topic => {

            addOption(
                el.topicFilter,
                topic.name || "Untitled topic",
                topic.id
            );

        });

    if (optionExists(el.topicFilter, previous)) {
        el.topicFilter.value = previous;
    }

}


/* =====================================================
   09. CASCADING FORM SELECTORS
===================================================== */

function populateFormSubjects() {

    const previous = el.parentSubject.value;
    const examId = el.parentExam.value;

    el.parentSubject.replaceChildren(
        new Option("Select a subject", "")
    );

    sortedByName(state.subjects)
        .filter(subject => subject.examId === examId)
        .forEach(subject => {

            const name = subject.name || "Untitled subject";

            addOption(
                el.parentSubject,
                subject.published === true
                    ? name
                    : `${name} (Draft)`,
                subject.id
            );

        });

    if (optionExists(el.parentSubject, previous)) {
        el.parentSubject.value = previous;
    }

    el.parentSubject.disabled = !examId;

    populateFormTopics();

}

function populateFormTopics() {

    const previous = el.parentTopic.value;

    const examId = el.parentExam.value;
    const subjectId = el.parentSubject.value;

    el.parentTopic.replaceChildren(
        new Option("Select a topic", "")
    );

    sortedByName(state.topics)
        .filter(topic =>
            topic.examId === examId &&
            topic.subjectId === subjectId
        )
        .forEach(topic => {

            const name = topic.name || "Untitled topic";

            addOption(
                el.parentTopic,
                topic.published === true
                    ? name
                    : `${name} (Draft)`,
                topic.id
            );

        });

    if (optionExists(el.parentTopic, previous)) {
        el.parentTopic.value = previous;
    }

    el.parentTopic.disabled = !subjectId;

}


/* =====================================================
   10. FILTER AND SORT
===================================================== */

function getFilteredLessons() {

    const query = el.search.value.trim().toLowerCase();

    const examId = el.examFilter.value;
    const subjectId = el.subjectFilter.value;
    const topicId = el.topicFilter.value;

    const publication = el.statusFilter.value;
    const sort = el.sort.value;

    const results = state.lessons.filter(lesson => {

        const exam = findExam(lesson.examId);
        const subject = findSubject(lesson.subjectId);
        const topic = findTopic(lesson.topicId);

        const searchable = [
            lesson.title,
            lesson.description,
            exam?.name,
            subject?.name,
            topic?.name
        ].map(value =>
            typeof value === "string" ? value : ""
        ).join(" ").toLowerCase();

        if (query && !searchable.includes(query)) {
            return false;
        }

        if (
            examId !== "all" &&
            lesson.examId !== examId
        ) {
            return false;
        }

        if (
            subjectId !== "all" &&
            lesson.subjectId !== subjectId
        ) {
            return false;
        }

        if (
            topicId !== "all" &&
            lesson.topicId !== topicId
        ) {
            return false;
        }

        if (
            publication === "published" &&
            lesson.published !== true
        ) {
            return false;
        }

        if (
            publication === "draft" &&
            lesson.published === true
        ) {
            return false;
        }

        return true;

    });

    results.sort((a, b) => {

        if (sort === "title-asc") {

            return String(a.title || "").localeCompare(
                String(b.title || "")
            );

        }

        if (sort === "title-desc") {

            return String(b.title || "").localeCompare(
                String(a.title || "")
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
                String(a.title || "").localeCompare(
                    String(b.title || "")
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

    const published = state.lessons.filter(
        lesson => lesson.published === true
    ).length;

    setText(el.total, state.lessons.length);
    setText(el.published, published);
    setText(el.drafts, state.lessons.length - published);
    setText(el.filtered, results.length);

}


/* =====================================================
   12. TABLE
===================================================== */

function showTableMessage(message) {

    const row = createNode("tr");
    const cell = createNode("td");

    cell.colSpan = 8;

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

    button.setAttribute(
        "aria-label",
        label
    );

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

    records.forEach(lesson => {

        const exam = findExam(lesson.examId);
        const subject = findSubject(lesson.subjectId);
        const topic = findTopic(lesson.topicId);

        const row = createNode("tr");

        const titleCell = createNode(
            "td",
            "admin-table-title",
            lesson.title || "Untitled lesson"
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

        const topicCell = createNode(
            "td",
            "",
            topic?.name || "Topic unavailable"
        );

        const orderCell = createNode(
            "td",
            "",
            Number.isInteger(lesson.order)
                ? lesson.order
                : "—"
        );

        const statusCell = createNode("td");

        statusCell.append(
            createNode(
                "span",
                lesson.published === true
                    ? "admin-status-badge is-published"
                    : "admin-status-badge is-draft",
                lesson.published === true
                    ? "Published"
                    : "Draft"
            )
        );

        const updatedCell = createNode(
            "td",
            "",
            formatDate(
                lesson.updatedAt || lesson.createdAt
            )
        );

        const actionsCell = createNode("td");

        const actions = createNode(
            "div",
            "admin-table-actions"
        );

        actions.append(

            createAction(
                "Edit",
                "edit",
                lesson.id
            ),

            createAction(
                lesson.published === true
                    ? "Unpublish"
                    : "Publish",
                "toggle",
                lesson.id
            ),

            createAction(
                "Delete",
                "delete",
                lesson.id,
                true
            )

        );

        actionsCell.append(actions);

        row.append(
            titleCell,
            examCell,
            subjectCell,
            topicCell,
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

    const results = getFilteredLessons();

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
   14. MODAL MANAGEMENT
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
   15. LESSON CONTENT COUNTER
===================================================== */

function updateCharacterCount() {

    const length = el.content.value.length;

    setText(
        el.characterCount,
        `${length.toLocaleString("en-IN")} / 100000 characters`
    );

}


/* =====================================================
   16. ADD / EDIT LESSON
===================================================== */

function openLessonForm(id = null) {

    if (!ready()) {
        return;
    }

    const lesson = id ? findLesson(id) : null;

    if (id && !lesson) {

        showStatus(
            "The selected lesson could not be found.",
            "error"
        );

        return;

    }

    if (!state.topics.length) {

        showStatus(
            "Create an examination, subject, and topic before adding lessons.",
            "warning"
        );

        return;

    }

    el.form.reset();

    populateSelectors();

    el.recordId.value = lesson?.id || "";

    el.parentExam.value = lesson?.examId || "";

    populateFormSubjects();

    el.parentSubject.value = lesson?.subjectId || "";

    populateFormTopics();

    el.parentTopic.value = lesson?.topicId || "";

    el.title.value = lesson?.title || "";
    el.description.value = lesson?.description || "";
    el.content.value = lesson?.content || "";

    el.order.value = Number.isInteger(lesson?.order)
        ? String(lesson.order)
        : "0";

    el.publication.value = lesson?.published === true
        ? "true"
        : "false";

    updateCharacterCount();

    setText(
        el.formTitle,
        lesson ? "Edit Lesson" : "Add New Lesson"
    );

    setText(
        el.formDescription,
        lesson
            ? "Update this lesson and its learning hierarchy."
            : "Select the learning hierarchy and write your lesson content."
    );

    setText(
        el.saveText,
        lesson ? "Update Lesson" : "Save Lesson"
    );

    openModal(
        el.formModal,
        el.parentExam
    );

}


/* =====================================================
   17. FORM VALIDATION
===================================================== */

function validateForm() {

    const examId = el.parentExam.value.trim();
    const subjectId = el.parentSubject.value.trim();
    const topicId = el.parentTopic.value.trim();

    const title = el.title.value.trim();
    const description = el.description.value.trim();
    const content = el.content.value.trim();

    const orderValue = el.order.value.trim();
    const order = Number(orderValue);

    const published = el.publication.value === "true";

    const exam = findExam(examId);
    const subject = findSubject(subjectId);
    const topic = findTopic(topicId);

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

    if (
        !topic ||
        topic.examId !== examId ||
        topic.subjectId !== subjectId
    ) {

        el.parentTopic.focus();

        showStatus(
            "Select a topic belonging to the chosen subject.",
            "error"
        );

        return null;

    }

    if (!title || title.length > 180) {

        el.title.focus();

        showStatus(
            "Enter a lesson title of up to 180 characters.",
            "error"
        );

        return null;

    }

    if (description.length > 800) {

        el.description.focus();

        showStatus(
            "The short description cannot exceed 800 characters.",
            "error"
        );

        return null;

    }

    if (!content || content.length > 100000) {

        el.content.focus();

        showStatus(
            "Lesson content is required and cannot exceed 100000 characters.",
            "error"
        );

        return null;

    }

    if (
        !orderValue ||
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
            subject.published !== true ||
            topic.published !== true
        )
    ) {

        el.publication.focus();

        showStatus(
            "Publish the parent examination, subject, and topic before publishing this lesson.",
            "warning"
        );

        return null;

    }

    const currentId = el.recordId.value.trim();

    const duplicate = state.lessons.some(lesson => (

        lesson.id !== currentId &&

        lesson.topicId === topicId &&

        String(lesson.title || "")
            .trim()
            .toLowerCase() === title.toLowerCase()

    ));

    if (duplicate) {

        el.title.focus();

        showStatus(
            "A lesson with this title already exists under the selected topic.",
            "error"
        );

        return null;

    }

    return {
        examId,
        subjectId,
        topicId,
        title,
        description,
        content,
        order,
        published
    };

}


/* =====================================================
   18. VERIFY FIREBASE PARENT RECORDS
===================================================== */

async function verifyParents(values) {

    const paths = [

        `${CONFIG.paths.exams}/${values.examId}`,

        `${CONFIG.paths.subjects}/${values.subjectId}`,

        `${CONFIG.paths.topics}/${values.topicId}`

    ];

    const snapshots = await Promise.all(
        paths.map(path => get(ref(database, path)))
    );

    if (snapshots.some(snapshot => !snapshot.exists())) {

        throw new Error(
            "A selected parent record no longer exists. Refresh the page."
        );

    }

    const [exam, subject, topic] = snapshots.map(
        snapshot => snapshot.val()
    );

    if (subject.examId !== values.examId) {

        throw new Error(
            "The subject does not belong to the selected examination."
        );

    }

    if (
        topic.examId !== values.examId ||
        topic.subjectId !== values.subjectId
    ) {

        throw new Error(
            "The topic does not belong to the selected subject."
        );

    }

    if (
        values.published &&
        (
            exam.published !== true ||
            subject.published !== true ||
            topic.published !== true
        )
    ) {

        throw new Error(
            "All parent records must be published before publishing this lesson."
        );

    }

}


/* =====================================================
   19. SAVE LESSON
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
        ? findLesson(existingId)
        : null;

    if (existingId && !existing) {

        showStatus(
            "This lesson no longer exists. Refresh the page.",
            "error"
        );

        return;

    }

    const id = existingId || push(
        ref(database, CONFIG.paths.lessons)
    ).key;

    if (!id) {

        showStatus(
            "Unable to generate a lesson identifier.",
            "error"
        );

        return;

    }

    const version = state.sessionVersion;

    setBusy(true, "save");

    try {

        await verifyParents(values);

        if (!sessionValid(version)) {

            throw new Error(
                "Administrator session changed. Please sign in again."
            );

        }

        const now = Date.now();

        const record = {

            examId: values.examId,
            subjectId: values.subjectId,
            topicId: values.topicId,

            title: values.title,
            description: values.description,
            content: values.content,

            order: values.order,
            published: values.published,

            createdAt: existing?.createdAt || now,
            updatedAt: now

        };

        const changes = {};

        changes[`${CONFIG.paths.lessons}/${id}`] = record;

        changes[`${CONFIG.paths.publicLessons}/${id}`] =
            values.published ? record : null;

        /*
         * Both paths are written atomically.
         * RTDB Security Rules must independently
         * authorize this operation.
         */

        await update(
            ref(database),
            changes
        );

        closeModal(true);

        showStatus(
            existing
                ? "Lesson updated successfully."
                : "Lesson created successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "[Lesson Manager] Save error:",
            error?.code || error?.message
        );

        showStatus(
            error?.code
                ? "Unable to save the lesson. Check your connection and Firebase permissions."
                : error.message,
            "error"
        );

    } finally {

        setBusy(false);

    }

}


/* =====================================================
   20. QUICK PUBLICATION TOGGLE
===================================================== */

async function togglePublication(id) {

    if (!ready()) {
        return;
    }

    const lesson = findLesson(id);

    if (!lesson) {
        return;
    }

    const published = lesson.published !== true;

    const version = state.sessionVersion;

    setBusy(true);

    try {

        await verifyParents({

            examId: lesson.examId,
            subjectId: lesson.subjectId,
            topicId: lesson.topicId,
            published

        });

        if (!sessionValid(version)) {

            throw new Error(
                "Administrator session changed."
            );

        }

        const record = {

            examId: lesson.examId,
            subjectId: lesson.subjectId,
            topicId: lesson.topicId,

            title: lesson.title || "",
            description: lesson.description || "",
            content: lesson.content || "",

            order: Number.isInteger(lesson.order)
                ? lesson.order
                : 0,

            published,

            createdAt: lesson.createdAt || Date.now(),
            updatedAt: Date.now()

        };

        const changes = {};

        changes[`${CONFIG.paths.lessons}/${id}`] = record;

        changes[`${CONFIG.paths.publicLessons}/${id}`] =
            published ? record : null;

        await update(
            ref(database),
            changes
        );

        showStatus(
            published
                ? "Lesson published successfully."
                : "Lesson unpublished successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "[Lesson Manager] Publication error:",
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
   21. DELETE CONFIRMATION
===================================================== */

function openDeleteConfirmation(id) {

    if (!ready()) {
        return;
    }

    const lesson = findLesson(id);

    if (!lesson) {
        return;
    }

    state.deleteId = id;

    setText(
        el.deleteTitle,
        lesson.title || "Untitled lesson"
    );

    openModal(
        el.deleteModal,
        el.cancelDelete
    );

}


/* =====================================================
   22. DELETE LESSON
===================================================== */

async function handleDelete() {

    if (!ready() || !state.deleteId) {
        return;
    }

    const id = state.deleteId;
    const version = state.sessionVersion;

    if (!findLesson(id)) {

        closeModal(true);
        state.deleteId = null;

        showStatus(
            "The selected lesson no longer exists.",
            "error"
        );

        return;

    }

    setBusy(true, "delete");

    try {

        if (!sessionValid(version)) {

            throw new Error(
                "Administrator session changed."
            );

        }

        /*
         * Remove both the master lesson and
         * published copy in one atomic update.
         */

        const changes = {};

        changes[`${CONFIG.paths.lessons}/${id}`] = null;

        changes[`${CONFIG.paths.publicLessons}/${id}`] = null;

        await update(
            ref(database),
            changes
        );

        closeModal(true);

        state.deleteId = null;

        showStatus(
            "Lesson deleted successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "[Lesson Manager] Delete error:",
            error?.code || error?.message
        );

        showStatus(
            "Unable to delete the lesson. Check your connection and Firebase permissions.",
            "error"
        );

    } finally {

        setBusy(false);

    }

}


/* =====================================================
   23. TABLE ACTION HANDLER
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

            openLessonForm(id);
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
   24. RESPONSIVE SIDEBAR
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
   25. SIGN OUT
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
   26. EVENT REGISTRATION
===================================================== */

function registerEvents() {

    el.addButton.addEventListener(
        "click",
        () => openLessonForm()
    );

    el.form.addEventListener(
        "submit",
        handleSave
    );

    el.content.addEventListener(
        "input",
        updateCharacterCount
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

        el.subjectFilter.value = "all";

        populateFilterSubjects();

        state.page = 1;
        render();

    });

    el.subjectFilter.addEventListener("change", () => {

        el.topicFilter.value = "all";

        populateFilterTopics();

        state.page = 1;
        render();

    });

    [
        el.topicFilter,
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
        el.parentTopic.value = "";

        populateFormSubjects();

    });

    el.parentSubject.addEventListener("change", () => {

        el.parentTopic.value = "";

        populateFormTopics();

    });

    el.reset.addEventListener("click", () => {

        el.search.value = "";

        el.examFilter.value = "all";
        el.subjectFilter.value = "all";
        el.topicFilter.value = "all";

        populateFilterSubjects();

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
   27. INITIALIZATION
===================================================== */

function initialize() {

    if (
        state.initialized ||
        document.body.dataset.page !== "admin-lessons"
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
            "[Lesson Manager] Missing HTML elements:",
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

    updateCharacterCount();

    registerEvents();

    showGate(
        "Verifying Administrator Access",
        "Please wait while your administrator session is being verified."
    );

    observeSession();

}


/* =====================================================
   28. START APPLICATION
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
   END OF ADMIN-LESSONS.JS
===================================================== */
