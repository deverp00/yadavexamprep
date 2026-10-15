
/*
=========================================================
YADAV EXAMPREP
File: js/admin-questions.js

Administrator Question Bank
Firebase Realtime Database

Designed and Developed by Yadav Web Technologies

Master: admin/questions/{questionId}
Public: public/questions/{questionId}

No sample or fabricated educational records.
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
        questions: "admin/questions",
        publicQuestions: "public/questions"
    },

    selectors: {

        gate: "#adminAuthGate",
        gateSpinner: "#adminGateSpinner",
        gateTitle: "#adminGateTitle",
        gateDescription: "#adminGateDescription",
        gateLoginLink: "#adminGateLoginLink",

        app: "#adminQuestionsApp",

        sidebar: "#adminSidebar",
        backdrop: "#adminSidebarBackdrop",
        menuToggle: "#adminMenuToggle",
        sidebarClose: "#adminSidebarClose",
        sidebarNavigation: "#adminSidebarNavigation",

        sidebarLogout: "#adminSidebarLogout",
        topbarLogout: "#adminTopbarLogout",
        userEmail: "#adminUserEmail",

        status: "#questionManagementStatus",
        statusSpinner: "#questionManagementSpinner",
        statusText: "#questionManagementStatusText",

        addButton: "#addQuestionButton",

        total: "#questionTotalCount",
        published: "#questionPublishedCount",
        drafts: "#questionDraftCount",
        filtered: "#questionFilteredCount",

        filterForm: "#questionFilterForm",
        search: "#questionSearch",
        examFilter: "#questionExamFilter",
        subjectFilter: "#questionSubjectFilter",
        topicFilter: "#questionTopicFilter",
        statusFilter: "#questionStatusFilter",
        sort: "#questionSortFilter",
        reset: "#resetQuestionFilters",

        table: "#questionTableBody",
        emptyTemplate: "#questionEmptyStateTemplate",

        pagination: "#questionPagination",
        paginationInfo: "#questionPaginationInfo",
        paginationButtons: "#questionPaginationButtons",

        formModal: "#questionFormModal",
        formTitle: "#questionFormModalTitle",
        formDescription: "#questionFormModalDescription",
        closeForm: "#closeQuestionFormModal",
        cancelForm: "#cancelQuestionForm",

        form: "#questionForm",
        recordId: "#questionRecordId",

        parentExam: "#questionParentExam",
        parentSubject: "#questionParentSubject",
        parentTopic: "#questionParentTopic",

        question: "#questionText",
        characterCount: "#questionCharacterCount",

        optionA: "#questionOptionA",
        optionB: "#questionOptionB",
        optionC: "#questionOptionC",
        optionD: "#questionOptionD",

        correctOption: "#questionCorrectOption",
        explanation: "#questionExplanation",

        marks: "#questionMarks",
        negativeMarks: "#questionNegativeMarks",
        order: "#questionDisplayOrder",
        publication: "#questionPublicationStatus",

        saveButton: "#saveQuestionButton",
        saveText: "#saveQuestionButtonText",
        saveSpinner: "#saveQuestionSpinner",

        deleteModal: "#deleteQuestionModal",
        closeDelete: "#closeDeleteQuestionModal",
        cancelDelete: "#cancelDeleteQuestion",
        confirmDelete: "#confirmDeleteQuestion",
        deleteTextPreview: "#deleteQuestionText",
        deleteText: "#deleteQuestionButtonText",
        deleteSpinner: "#deleteQuestionSpinner",

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

    sessionVersion: 0,

    loaded: {
        exams: false,
        subjects: false,
        topics: false,
        questions: false
    },

    exams: [],
    subjects: [],
    topics: [],
    questions: [],

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

function node(tag, className = "", content) {

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

function findRecord(collection, id) {

    return state[collection].find(
        item => item.id === id
    ) || null;

}

function loaded() {

    return Object.values(state.loaded).every(Boolean);

}

function ready() {

    return state.authorized && loaded() && !state.busy;

}

function sessionValid(version) {

    return (
        state.authorized &&
        version === state.sessionVersion &&
        auth.currentUser?.uid === CONFIG.adminUID
    );

}

function sortNames(records, field = "name") {

    return [...records].sort((a, b) =>
        String(a[field] || "").localeCompare(
            String(b[field] || "")
        )
    );

}

function timestamp(value) {

    if (typeof value === "number" && Number.isFinite(value)) {

        return value < 100000000000
            ? value * 1000
            : value;

    }

    if (typeof value === "string") {
        return Date.parse(value) || 0;
    }

    return 0;

}

function formatDate(value) {

    const time = timestamp(value);

    if (!time) {
        return "—";
    }

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(new Date(time));

}

function optionExists(select, value) {

    return [...select.options].some(
        option => option.value === value
    );

}

function addOption(select, label, value) {

    select.add(new Option(label, value));

}


/* =====================================================
   04. STATUS AND AUTHENTICATION GATE
===================================================== */

function showGate(title, description, login = false) {

    el.app.hidden = true;
    el.gate.hidden = false;

    setText(el.gateTitle, title);
    setText(el.gateDescription, description);

    el.gateSpinner.hidden = login;
    el.gateLoginLink.hidden = !login;

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
        !state.topics.some(topic => {

            const subject = findRecord(
                "subjects",
                topic.subjectId
            );

            return Boolean(
                subject &&
                subject.examId === topic.examId &&
                findRecord("exams", topic.examId)
            );

        });

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
                ? "Update Question"
                : "Save Question"
    );

    setText(
        el.deleteText,
        busy && action === "delete"
            ? "Deleting..."
            : "Delete Question"
    );

    setControlsEnabled(ready());

}


/* =====================================================
   05. FIREBASE AUTHENTICATION
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
                        ? "This account is not authorized to manage questions."
                        : "Sign in with your administrator account to continue.",
                    true
                );

                if (user) {

                    try {
                        await signOut(auth);
                    } catch (error) {

                        console.error(
                            "[Question Bank] Unauthorized sign-out:",
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
                "[Question Bank] Authentication error:",
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
        "Loading exams, subjects, topics, and questions..."
    );

    const collections = [

        ["exams", CONFIG.paths.exams],
        ["subjects", CONFIG.paths.subjects],
        ["topics", CONFIG.paths.topics],
        ["questions", CONFIG.paths.questions]

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

                if (key !== "questions") {
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
                    `[Question Bank] ${key} read error:`,
                    error?.code
                );

                showStatus(
                    "Unable to load Firebase records. Check your database URL and Security Rules.",
                    "error"
                );

                showTableMessage(
                    "Question records could not be loaded."
                );

            }

        );

        state.subscriptions.push(unsubscribe);

    });

}

function finishLoading() {

    if (!loaded()) {
        return;
    }

    setControlsEnabled(!state.busy);

    render();

    if (!state.exams.length) {

        showStatus(
            "Create an examination before adding questions.",
            "warning"
        );

    } else if (!state.subjects.length) {

        showStatus(
            "Create a subject before adding questions.",
            "warning"
        );

    } else if (!state.topics.length) {

        showStatus(
            "Create a topic before adding questions.",
            "warning"
        );

    } else {

        showStatus(
            "Question Bank synchronized with Firebase Realtime Database.",
            "success"
        );

    }

}


/* =====================================================
   07. POPULATE EXAM SELECTORS
===================================================== */

function populateSelectors() {

    const filterValue = el.examFilter.value;
    const formValue = el.parentExam.value;

    el.examFilter.replaceChildren(
        new Option("All Exams", "all")
    );

    el.parentExam.replaceChildren(
        new Option("Select an examination", "")
    );

    sortNames(state.exams).forEach(exam => {

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

    if (optionExists(el.examFilter, filterValue)) {
        el.examFilter.value = filterValue;
    }

    if (optionExists(el.parentExam, formValue)) {
        el.parentExam.value = formValue;
    }

    populateFilterSubjects();
    populateFormSubjects();

}


/* =====================================================
   08. FILTER SELECTORS
===================================================== */

function populateFilterSubjects() {

    const previous = el.subjectFilter.value;
    const examId = el.examFilter.value;

    el.subjectFilter.replaceChildren(
        new Option("All Subjects", "all")
    );

    sortNames(state.subjects)
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

    sortNames(state.topics)
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
   09. FORM SELECTORS
===================================================== */

function populateFormSubjects() {

    const previous = el.parentSubject.value;
    const examId = el.parentExam.value;

    el.parentSubject.replaceChildren(
        new Option("Select a subject", "")
    );

    sortNames(state.subjects)
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

    sortNames(state.topics)
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
   10. FILTERING AND SORTING
===================================================== */

function getFilteredQuestions() {

    const query = el.search.value.trim().toLowerCase();

    const examId = el.examFilter.value;
    const subjectId = el.subjectFilter.value;
    const topicId = el.topicFilter.value;

    const publication = el.statusFilter.value;
    const sort = el.sort.value;

    const results = state.questions.filter(question => {

        const exam = findRecord(
            "exams",
            question.examId
        );

        const subject = findRecord(
            "subjects",
            question.subjectId
        );

        const topic = findRecord(
            "topics",
            question.topicId
        );

        const searchable = [

            question.question,
            question.explanation,
            exam?.name,
            subject?.name,
            topic?.name,

            ...Object.values(
                question.options &&
                typeof question.options === "object"
                    ? question.options
                    : {}
            )

        ].map(value =>
            typeof value === "string" ? value : ""
        ).join(" ").toLowerCase();

        if (query && !searchable.includes(query)) {
            return false;
        }

        if (
            examId !== "all" &&
            question.examId !== examId
        ) {
            return false;
        }

        if (
            subjectId !== "all" &&
            question.subjectId !== subjectId
        ) {
            return false;
        }

        if (
            topicId !== "all" &&
            question.topicId !== topicId
        ) {
            return false;
        }

        if (
            publication === "published" &&
            question.published !== true
        ) {
            return false;
        }

        if (
            publication === "draft" &&
            question.published === true
        ) {
            return false;
        }

        return true;

    });

    results.sort((a, b) => {

        if (sort === "question-asc") {

            return String(a.question || "").localeCompare(
                String(b.question || "")
            );

        }

        if (sort === "question-desc") {

            return String(b.question || "").localeCompare(
                String(a.question || "")
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
                String(a.question || "").localeCompare(
                    String(b.question || "")
                );

        }

        const first = timestamp(a.createdAt);
        const second = timestamp(b.createdAt);

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

    const published = state.questions.filter(
        question => question.published === true
    ).length;

    setText(el.total, state.questions.length);
    setText(el.published, published);
    setText(el.drafts, state.questions.length - published);
    setText(el.filtered, results.length);

}


/* =====================================================
   12. QUESTION TABLE
===================================================== */

function showTableMessage(message) {

    const row = node("tr");
    const cell = node("td");

    cell.colSpan = 8;

    const container = node(
        "div",
        "admin-empty-state"
    );

    container.append(
        node("p", "", message)
    );

    cell.append(container);
    row.append(cell);

    el.table.replaceChildren(row);
    el.pagination.hidden = true;

}

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

    if (!records.length) {

        el.table.append(
            el.emptyTemplate.content.cloneNode(true)
        );

        el.pagination.hidden = true;
        return;

    }

    const fragment = document.createDocumentFragment();

    records.forEach(question => {

        const exam = findRecord(
            "exams",
            question.examId
        );

        const subject = findRecord(
            "subjects",
            question.subjectId
        );

        const topic = findRecord(
            "topics",
            question.topicId
        );

        const row = node("tr");

        const questionCell = node(
            "td",
            "admin-table-title",
            question.question || "Untitled question"
        );

        const examCell = node(
            "td",
            "",
            exam?.name || "Exam unavailable"
        );

        const subjectCell = node(
            "td",
            "",
            subject?.name || "Subject unavailable"
        );

        const topicCell = node(
            "td",
            "",
            topic?.name || "Topic unavailable"
        );

        const marksCell = node(
            "td",
            "",
            Number.isFinite(Number(question.marks))
                ? question.marks
                : "—"
        );

        const statusCell = node("td");

        statusCell.append(
            node(
                "span",
                question.published === true
                    ? "admin-status-badge is-published"
                    : "admin-status-badge is-draft",
                question.published === true
                    ? "Published"
                    : "Draft"
            )
        );

        const updatedCell = node(
            "td",
            "",
            formatDate(
                question.updatedAt || question.createdAt
            )
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
                question.id
            ),

            createAction(
                question.published === true
                    ? "Unpublish"
                    : "Publish",
                "toggle",
                question.id
            ),

            createAction(
                "Delete",
                "delete",
                question.id,
                true
            )

        );

        actionsCell.append(actions);

        row.append(
            questionCell,
            examCell,
            subjectCell,
            topicCell,
            marksCell,
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

    if (!loaded()) {
        return;
    }

    const results = getFilteredQuestions();

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
   15. QUESTION CHARACTER COUNTER
===================================================== */

function updateCharacterCount() {

    setText(
        el.characterCount,
        `${el.question.value.length.toLocaleString("en-IN")} / 5000 characters`
    );

}


/* =====================================================
   16. OPEN ADD / EDIT FORM
===================================================== */

function openQuestionForm(id = null) {

    if (!ready()) {
        return;
    }

    const question = id
        ? findRecord("questions", id)
        : null;

    if (id && !question) {

        showStatus(
            "The selected question could not be found.",
            "error"
        );

        return;

    }

    if (!state.topics.length) {

        showStatus(
            "Create an examination, subject, and topic before adding questions.",
            "warning"
        );

        return;

    }

    el.form.reset();

    populateSelectors();

    el.recordId.value = question?.id || "";

    el.parentExam.value = question?.examId || "";

    populateFormSubjects();

    el.parentSubject.value = question?.subjectId || "";

    populateFormTopics();

    el.parentTopic.value = question?.topicId || "";

    el.question.value = question?.question || "";

    const options = question?.options || {};

    el.optionA.value = options.A || "";
    el.optionB.value = options.B || "";
    el.optionC.value = options.C || "";
    el.optionD.value = options.D || "";

    el.correctOption.value =
        question?.correctOptionId || "";

    el.explanation.value = question?.explanation || "";

    el.marks.value =
        question?.marks !== undefined
            ? String(question.marks)
            : "1";

    el.negativeMarks.value =
        question?.negativeMarks !== undefined
            ? String(question.negativeMarks)
            : "0";

    el.order.value = Number.isInteger(question?.order)
        ? String(question.order)
        : "0";

    el.publication.value = question?.published === true
        ? "true"
        : "false";

    updateCharacterCount();

    setText(
        el.formTitle,
        question ? "Edit Question" : "Add New Question"
    );

    setText(
        el.formDescription,
        question
            ? "Update this multiple-choice question and its answer details."
            : "Select the learning hierarchy and enter the multiple-choice question."
    );

    setText(
        el.saveText,
        question ? "Update Question" : "Save Question"
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

    const exam = findRecord("exams", examId);
    const subject = findRecord("subjects", subjectId);
    const topic = findRecord("topics", topicId);

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

    const question = el.question.value.trim();

    if (!question || question.length > 5000) {

        el.question.focus();

        showStatus(
            "Enter a question of up to 5000 characters.",
            "error"
        );

        return null;

    }

    const options = {

        A: el.optionA.value.trim(),
        B: el.optionB.value.trim(),
        C: el.optionC.value.trim(),
        D: el.optionD.value.trim()

    };

    const optionElements = {
        A: el.optionA,
        B: el.optionB,
        C: el.optionC,
        D: el.optionD
    };

    for (const [key, value] of Object.entries(options)) {

        if (!value || value.length > 1500) {

            optionElements[key].focus();

            showStatus(
                `Option ${key} is required and cannot exceed 1500 characters.`,
                "error"
            );

            return null;

        }

    }

    const normalizedOptions = Object.values(options)
        .map(value => value.toLocaleLowerCase());

    if (new Set(normalizedOptions).size !== 4) {

        showStatus(
            "All four answer options must be distinct.",
            "error"
        );

        return null;

    }

    const correctOptionId = el.correctOption.value;

    if (!Object.hasOwn(options, correctOptionId)) {

        el.correctOption.focus();

        showStatus(
            "Select a valid correct answer.",
            "error"
        );

        return null;

    }

    const explanation = el.explanation.value.trim();

    if (explanation.length > 5000) {

        el.explanation.focus();

        showStatus(
            "The explanation cannot exceed 5000 characters.",
            "error"
        );

        return null;

    }

    const marksValue = el.marks.value.trim();
    const negativeValue = el.negativeMarks.value.trim();
    const orderValue = el.order.value.trim();

    const marks = Number(marksValue);
    const negativeMarks = Number(negativeValue);
    const order = Number(orderValue);

    if (
        !marksValue ||
        !Number.isFinite(marks) ||
        marks < 0.01 ||
        marks > 1000 ||
        Math.round(marks * 100) !== marks * 100
    ) {

        el.marks.focus();

        showStatus(
            "Correct-answer marks must be between 0.01 and 1000, with up to two decimal places.",
            "error"
        );

        return null;

    }

    if (
        !negativeValue ||
        !Number.isFinite(negativeMarks) ||
        negativeMarks < 0 ||
        negativeMarks > 1000 ||
        Math.abs(
            Math.round(negativeMarks * 100) -
            negativeMarks * 100
        ) > 0.000001
    ) {

        el.negativeMarks.focus();

        showStatus(
            "Negative marks must be between 0 and 1000, with up to two decimal places.",
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

    const published = el.publication.value === "true";

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
            "Publish the parent examination, subject, and topic before publishing this question.",
            "warning"
        );

        return null;

    }

    return {

        examId,
        subjectId,
        topicId,

        question,
        options,
        correctOptionId,
        explanation,

        marks,
        negativeMarks,
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
            "The selected subject does not belong to this examination."
        );

    }

    if (
        topic.examId !== values.examId ||
        topic.subjectId !== values.subjectId
    ) {

        throw new Error(
            "The selected topic does not belong to this subject."
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
            "All parent records must be published before publishing this question."
        );

    }

}


/* =====================================================
   19. QUESTION RECORD BUILDER
===================================================== */

function buildRecord(values, existing = null) {

    const now = Date.now();

    return {

        examId: values.examId,
        subjectId: values.subjectId,
        topicId: values.topicId,

        question: values.question,

        options: {
            A: values.options.A,
            B: values.options.B,
            C: values.options.C,
            D: values.options.D
        },

        correctOptionId: values.correctOptionId,

        explanation: values.explanation,

        marks: values.marks,
        negativeMarks: values.negativeMarks,
        order: values.order,

        published: values.published,

        createdAt: existing?.createdAt || now,
        updatedAt: now

    };

}


/* =====================================================
   20. MOCK-TEST REFERENCE DETECTION
===================================================== */

/*
 * Check both master and published test collections.
 *
 * Supported references:
 * - test.questionIds as an array
 * - test.questionIds as a keyed object
 * - test.questions as an array of IDs/objects
 * - test.questions as a keyed object
 * - admin/testQuestions/{testId}/{questionId}
 * - public/testQuestions/{testId}/{questionId}
 *
 * A standalone copied question without its source ID
 * cannot be reliably traced back to its master record.
 * The Mock Test Manager must preserve sourceQuestionId.
 */

function containsQuestionReference(value, questionId) {

    if (value === questionId) {
        return true;
    }

    if (!value || typeof value !== "object") {
        return false;
    }

    if (
        value.sourceQuestionId === questionId ||
        value.questionId === questionId ||
        value.id === questionId
    ) {
        return true;
    }

    if (Array.isArray(value)) {

        return value.some(item =>
            containsQuestionReference(item, questionId)
        );

    }

    if (Object.hasOwn(value, questionId)) {
        return true;
    }

    return Object.values(value).some(item => {

        if (item === questionId) {
            return true;
        }

        if (!item || typeof item !== "object") {
            return false;
        }

        return (
            item.sourceQuestionId === questionId ||
            item.questionId === questionId ||
            item.id === questionId
        );

    });

}

async function isLinkedToTest(questionId) {

    const paths = [

        "admin/tests",
        "public/tests",
        "admin/testQuestions",
        "public/testQuestions"

    ];

    const snapshots = await Promise.all(
        paths.map(path => get(ref(database, path)))
    );

    return snapshots.some((snapshot, index) => {

        if (!snapshot.exists()) {
            return false;
        }

        const value = snapshot.val();

        if (index < 2) {

            return normalize(value).some(test =>

                containsQuestionReference(
                    test.questionIds,
                    questionId
                ) ||

                containsQuestionReference(
                    test.questions,
                    questionId
                )

            );

        }

        return Object.values(value || {}).some(
            collection =>
                containsQuestionReference(
                    collection,
                    questionId
                )
        );

    });

}


/* =====================================================
   21. SAVE QUESTION
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
        ? findRecord("questions", existingId)
        : null;

    if (existingId && !existing) {

        showStatus(
            "This question no longer exists. Refresh the page.",
            "error"
        );

        return;

    }

    const id = existingId || push(
        ref(database, CONFIG.paths.questions)
    ).key;

    if (!id) {

        showStatus(
            "Unable to generate a question identifier.",
            "error"
        );

        return;

    }

    const version = state.sessionVersion;

    setBusy(true, "save");

    try {

        await verifyParents(values);

        /*
         * Until mock-test synchronization is implemented,
         * prevent editing a question referenced by a test.
         * This avoids silently leaving test copies outdated.
         */

        if (existing && await isLinkedToTest(id)) {

            throw new Error(
                "This question is linked to a mock test. Unlink it before editing to prevent outdated test copies."
            );

        }

        if (!sessionValid(version)) {

            throw new Error(
                "Administrator session changed. Please sign in again."
            );

        }

        const record = buildRecord(values, existing);

        const changes = {};

        changes[`${CONFIG.paths.questions}/${id}`] = record;

        changes[`${CONFIG.paths.publicQuestions}/${id}`] =
            values.published ? record : null;

        await update(
            ref(database),
            changes
        );

        closeModal(true);

        showStatus(
            existing
                ? "Question updated successfully."
                : "Question created successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "[Question Bank] Save error:",
            error?.code || error?.message
        );

        showStatus(
            error?.code
                ? "Unable to save the question. Check Firebase permissions and your connection."
                : error.message,
            "error"
        );

    } finally {

        setBusy(false);

    }

}


/* =====================================================
   22. QUICK PUBLICATION TOGGLE
===================================================== */

async function togglePublication(id) {

    if (!ready()) {
        return;
    }

    const question = findRecord("questions", id);

    if (!question) {
        return;
    }

    const published = question.published !== true;

    const version = state.sessionVersion;

    setBusy(true);

    try {

        await verifyParents({
            examId: question.examId,
            subjectId: question.subjectId,
            topicId: question.topicId,
            published
        });

        if (await isLinkedToTest(id)) {

            throw new Error(
                "This question is linked to a mock test. Unlink it before changing its publication status."
            );

        }

        if (!sessionValid(version)) {

            throw new Error(
                "Administrator session changed."
            );

        }

        const record = buildRecord(
            {
                ...question,
                published
            },
            question
        );

        const changes = {};

        changes[`${CONFIG.paths.questions}/${id}`] = record;

        changes[`${CONFIG.paths.publicQuestions}/${id}`] =
            published ? record : null;

        await update(
            ref(database),
            changes
        );

        showStatus(
            published
                ? "Question published successfully."
                : "Question unpublished successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "[Question Bank] Publication error:",
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
   23. DELETE CONFIRMATION
===================================================== */

function openDeleteConfirmation(id) {

    if (!ready()) {
        return;
    }

    const question = findRecord("questions", id);

    if (!question) {
        return;
    }

    state.deleteId = id;

    setText(
        el.deleteTextPreview,
        question.question || "Untitled question"
    );

    openModal(
        el.deleteModal,
        el.cancelDelete
    );

}


/* =====================================================
   24. DELETE QUESTION
===================================================== */

async function handleDelete() {

    if (!ready() || !state.deleteId) {
        return;
    }

    const id = state.deleteId;

    if (!findRecord("questions", id)) {

        closeModal(true);
        state.deleteId = null;

        showStatus(
            "The selected question no longer exists.",
            "error"
        );

        return;

    }

    const version = state.sessionVersion;

    setBusy(true, "delete");

    try {

        const linked = await isLinkedToTest(id);

        if (linked) {

            throw new Error(
                "Deletion blocked. This question is referenced by an existing mock test. Unlink it first."
            );

        }

        if (!sessionValid(version)) {

            throw new Error(
                "Administrator session changed."
            );

        }

        const changes = {};

        changes[`${CONFIG.paths.questions}/${id}`] = null;

        changes[`${CONFIG.paths.publicQuestions}/${id}`] = null;

        await update(
            ref(database),
            changes
        );

        closeModal(true);
        state.deleteId = null;

        showStatus(
            "Question deleted successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "[Question Bank] Delete error:",
            error?.code || error?.message
        );

        showStatus(
            error?.code
                ? "Unable to verify dependencies or delete the question. Check Firebase permissions."
                : error.message,
            "error"
        );

    } finally {

        setBusy(false);

    }

}


/* =====================================================
   25. TABLE ACTIONS
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
            openQuestionForm(id);
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
   26. MOBILE SIDEBAR
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
   27. LOGOUT
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
   28. EVENT REGISTRATION
===================================================== */

function registerEvents() {

    el.addButton.addEventListener(
        "click",
        () => openQuestionForm()
    );

    el.form.addEventListener(
        "submit",
        handleSave
    );

    el.question.addEventListener(
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
        el.topicFilter.value = "all";

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
   29. INITIALIZATION
===================================================== */

function initialize() {

    if (
        state.initialized ||
        document.body.dataset.page !== "admin-questions"
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
            "[Question Bank] Missing HTML elements:",
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
   30. APPLICATION START
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
   END OF ADMIN-QUESTIONS.JS
===================================================== */
