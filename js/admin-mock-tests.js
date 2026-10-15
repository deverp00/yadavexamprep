
/*
=========================================================
YADAV EXAMPREP
File: js/admin-mock-tests.js

Administrator Mock Test Management
Firebase Realtime Database

Designed and Developed by Yadav Web Technologies

Master:
    admin/tests/{testId}
    admin/testQuestions/{testId}

Published:
    public/tests/{testId}
    public/testQuestions/{testId}

No seeded educational records.
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
    questionPageSize: 8,

    paths: {
        exams: "admin/exams",
        subjects: "admin/subjects",
        topics: "admin/topics",
        questions: "admin/questions",
        tests: "admin/tests",
        testQuestions: "admin/testQuestions",
        publicTests: "public/tests",
        publicTestQuestions: "public/testQuestions"
    }

});

const SELECTORS = {

    gate: "#adminAuthGate",
    gateSpinner: "#adminGateSpinner",
    gateTitle: "#adminGateTitle",
    gateDescription: "#adminGateDescription",
    gateLoginLink: "#adminGateLoginLink",

    app: "#adminMockTestsApp",

    sidebar: "#adminSidebar",
    backdrop: "#adminSidebarBackdrop",
    menuToggle: "#adminMenuToggle",
    sidebarClose: "#adminSidebarClose",
    sidebarNavigation: "#adminSidebarNavigation",
    sidebarLogout: "#adminSidebarLogout",
    topbarLogout: "#adminTopbarLogout",
    userEmail: "#adminUserEmail",

    status: "#mockTestManagementStatus",
    statusSpinner: "#mockTestManagementSpinner",
    statusText: "#mockTestManagementStatusText",

    add: "#addMockTestButton",

    total: "#mockTestTotalCount",
    published: "#mockTestPublishedCount",
    drafts: "#mockTestDraftCount",
    filtered: "#mockTestFilteredCount",

    filterForm: "#mockTestFilterForm",
    search: "#mockTestSearch",
    examFilter: "#mockTestExamFilter",
    subjectFilter: "#mockTestSubjectFilter",
    statusFilter: "#mockTestStatusFilter",
    sortFilter: "#mockTestSortFilter",
    reset: "#resetMockTestFilters",

    table: "#mockTestTableBody",
    emptyTemplate: "#mockTestEmptyStateTemplate",
    pagination: "#mockTestPagination",
    paginationInfo: "#mockTestPaginationInfo",
    paginationButtons: "#mockTestPaginationButtons",

    formModal: "#mockTestFormModal",
    formTitle: "#mockTestFormModalTitle",
    formDescription: "#mockTestFormModalDescription",
    closeForm: "#closeMockTestFormModal",
    cancelForm: "#cancelMockTestForm",
    form: "#mockTestForm",

    recordId: "#mockTestRecordId",
    parentExam: "#mockTestParentExam",
    parentSubject: "#mockTestParentSubject",
    title: "#mockTestTitle",
    description: "#mockTestDescription",
    duration: "#mockTestDuration",
    order: "#mockTestDisplayOrder",
    marks: "#mockTestMarksPerQuestion",
    negative: "#mockTestNegativeMarks",
    featured: "#mockTestFeatured",
    publication: "#mockTestPublicationStatus",

    questionSearch: "#mockTestQuestionSearch",
    questionTopic: "#mockTestQuestionTopicFilter",
    questionLoading: "#mockTestQuestionLoading",
    available: "#mockTestAvailableQuestions",
    questionPagination: "#mockTestQuestionPagination",
    questionPaginationInfo: "#mockTestQuestionPaginationInfo",
    questionPaginationButtons: "#mockTestQuestionPaginationButtons",

    selectedCount: "#mockTestSelectedCount",
    selected: "#mockTestSelectedQuestions",
    questionCount: "#mockTestQuestionCount",
    maximumMarks: "#mockTestMaximumMarks",

    save: "#saveMockTestButton",
    saveText: "#saveMockTestButtonText",
    saveSpinner: "#saveMockTestSpinner",

    deleteModal: "#deleteMockTestModal",
    closeDelete: "#closeDeleteMockTestModal",
    cancelDelete: "#cancelDeleteMockTest",
    confirmDelete: "#confirmDeleteMockTest",
    deleteTitle: "#deleteMockTestTitle",
    deleteText: "#deleteMockTestButtonText",
    deleteSpinner: "#deleteMockTestSpinner",

    year: "#currentYear"

};


/* =====================================================
   02. STATE
===================================================== */

const state = {

    initialized: false,
    authorized: false,
    busy: false,
    signingOut: false,

    session: 0,

    loaded: {
        exams: false,
        subjects: false,
        topics: false,
        questions: false,
        tests: false
    },

    exams: [],
    subjects: [],
    topics: [],
    questions: [],
    tests: [],

    subscriptions: [],

    page: 1,
    questionPage: 1,

    selectedIds: [],

    deleteId: null,

    activeModal: null,
    returnFocus: null

};

const el = {};


/* =====================================================
   03. HELPERS
===================================================== */

function text(element, value) {

    if (element) {
        element.textContent = String(value);
    }

}

function element(tag, className = "", value) {

    const item = document.createElement(tag);

    if (className) {
        item.className = className;
    }

    if (value !== undefined) {
        item.textContent = String(value);
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

function find(collection, id) {

    return state[collection].find(
        item => item.id === id
    ) || null;

}

function allLoaded() {

    return Object.values(state.loaded).every(Boolean);

}

function ready() {

    return state.authorized && allLoaded() && !state.busy;

}

function sessionValid(version) {

    return (
        state.authorized &&
        state.session === version &&
        auth.currentUser?.uid === CONFIG.adminUID
    );

}

function byName(records, field = "name") {

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

    return typeof value === "string"
        ? Date.parse(value) || 0
        : 0;

}

function dateLabel(value) {

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

function addOption(select, label, value) {

    select.add(new Option(label, value));

}

function hasOption(select, value) {

    return [...select.options].some(
        option => option.value === value
    );

}

function validNumber(value, min, max, integer = false) {

    const raw = String(value).trim();
    const number = Number(raw);

    if (
        !raw ||
        !Number.isFinite(number) ||
        number < min ||
        number > max
    ) {
        return null;
    }

    if (integer && !Number.isInteger(number)) {
        return null;
    }

    if (
        !integer &&
        Math.abs(number * 100 - Math.round(number * 100)) > 0.000001
    ) {
        return null;
    }

    return number;

}

function getQuestionMarks(question, fallback) {

    const marks = validNumber(
        question.marks,
        0.01,
        1000
    );

    return marks ?? fallback;

}


/* =====================================================
   04. STATUS AND CONTROLS
===================================================== */

function showGate(title, description, login = false) {

    el.app.hidden = true;
    el.gate.hidden = false;

    text(el.gateTitle, title);
    text(el.gateDescription, description);

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

    text(el.statusText, message);

}

function setControls(enabled) {

    [
        el.search,
        el.examFilter,
        el.subjectFilter,
        el.statusFilter,
        el.sortFilter,
        el.reset
    ].forEach(control => {
        control.disabled = !enabled;
    });

    el.add.disabled = !enabled || !state.exams.length;

}

function setBusy(value, action = "save") {

    state.busy = value;

    el.save.disabled = value;
    el.confirmDelete.disabled = value;

    el.saveSpinner.hidden = !(value && action === "save");
    el.deleteSpinner.hidden = !(value && action === "delete");

    text(
        el.saveText,
        value && action === "save"
            ? "Saving..."
            : el.recordId.value
                ? "Update Mock Test"
                : "Save Mock Test"
    );

    text(
        el.deleteText,
        value && action === "delete"
            ? "Deleting..."
            : "Delete Mock Test"
    );

    setControls(ready());

}


/* =====================================================
   05. AUTHENTICATION
===================================================== */

function stopSubscriptions() {

    state.subscriptions.forEach(unsubscribe => {
        unsubscribe();
    });

    state.subscriptions = [];

}

function observeAuthentication() {

    onAuthStateChanged(

        auth,

        async user => {

            const version = ++state.session;

            if (!user || user.uid !== CONFIG.adminUID) {

                state.authorized = false;

                stopSubscriptions();
                closeModal(true);
                setControls(false);

                Object.keys(state.loaded).forEach(key => {
                    state.loaded[key] = false;
                });

                showGate(
                    user ? "Access Denied" : "Sign In Required",
                    user
                        ? "This account cannot manage mock tests."
                        : "Sign in with your administrator account.",
                    true
                );

                if (user) {

                    try {
                        await signOut(auth);
                    } catch (error) {
                        console.error(
                            "[Mock Tests] Unauthorized sign-out:",
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

                setControls(false);

                showStatus(
                    "Add your actual Firebase Realtime Database URL to js/firebase-config.js.",
                    "error"
                );

                tableMessage(
                    "Database configuration is required."
                );

                return;

            }

            subscribeCollections(version);

        },

        error => {

            ++state.session;

            state.authorized = false;

            stopSubscriptions();
            setControls(false);

            console.error(
                "[Mock Tests] Authentication:",
                error?.code
            );

            showGate(
                "Session Verification Failed",
                "Unable to verify administrator access.",
                true
            );

        }

    );

}


/* =====================================================
   06. REALTIME SUBSCRIPTIONS
===================================================== */

function subscribeCollections(version) {

    stopSubscriptions();

    Object.keys(state.loaded).forEach(key => {
        state.loaded[key] = false;
    });

    setControls(false);

    showStatus("Loading mock test management records...");

    const collections = [

        ["exams", CONFIG.paths.exams],
        ["subjects", CONFIG.paths.subjects],
        ["topics", CONFIG.paths.topics],
        ["questions", CONFIG.paths.questions],
        ["tests", CONFIG.paths.tests]

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

                if (key === "exams" || key === "subjects") {
                    populateSelectors();
                }

                if (key === "topics") {
                    populateQuestionTopics();
                }

                if (
                    state.activeModal === el.formModal &&
                    (key === "questions" || key === "topics")
                ) {
                    renderQuestionSelector();
                    renderSelectedQuestions();
                }

                finishLoading();

            },

            error => {

                if (!sessionValid(version)) {
                    return;
                }

                state.loaded[key] = false;

                setControls(false);

                console.error(
                    `[Mock Tests] ${key}:`,
                    error?.code
                );

                showStatus(
                    "Unable to load database records. Check Firebase Security Rules.",
                    "error"
                );

                tableMessage(
                    "Mock test records could not be loaded."
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

    setControls(!state.busy);
    render();

    if (!state.exams.length) {

        showStatus(
            "Create an examination before creating mock tests.",
            "warning"
        );

    } else if (!state.questions.length) {

        showStatus(
            "No Question Bank records exist yet. You can create a test draft, but publication requires valid published questions.",
            "warning"
        );

    } else {

        showStatus(
            "Mock Test Manager synchronized with Firebase Realtime Database.",
            "success"
        );

    }

}


/* =====================================================
   07. DIRECTORY FILTER SELECTORS
===================================================== */

function populateSelectors() {

    const filterExam = el.examFilter.value;
    const formExam = el.parentExam.value;

    el.examFilter.replaceChildren(
        new Option("All Exams", "all")
    );

    el.parentExam.replaceChildren(
        new Option("Select an examination", "")
    );

    byName(state.exams).forEach(exam => {

        const name = exam.name || "Untitled exam";

        addOption(el.examFilter, name, exam.id);

        addOption(
            el.parentExam,
            exam.published === true
                ? name
                : `${name} (Draft)`,
            exam.id
        );

    });

    if (hasOption(el.examFilter, filterExam)) {
        el.examFilter.value = filterExam;
    }

    if (hasOption(el.parentExam, formExam)) {
        el.parentExam.value = formExam;
    }

    populateDirectorySubjects();
    populateFormSubjects();

}

function populateDirectorySubjects() {

    const previous = el.subjectFilter.value;
    const examId = el.examFilter.value;

    el.subjectFilter.replaceChildren(
        new Option("All Subjects", "all")
    );

    byName(state.subjects)
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

    if (hasOption(el.subjectFilter, previous)) {
        el.subjectFilter.value = previous;
    }

}

function populateFormSubjects() {

    const previous = el.parentSubject.value;
    const examId = el.parentExam.value;

    el.parentSubject.replaceChildren(
        new Option("All Subjects / Full Exam", "")
    );

    byName(state.subjects)
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

    if (hasOption(el.parentSubject, previous)) {
        el.parentSubject.value = previous;
    }

    el.parentSubject.disabled = !examId;

    populateQuestionTopics();

}


/* =====================================================
   08. DIRECTORY FILTERING
===================================================== */

function filteredTests() {

    const query = el.search.value.trim().toLowerCase();

    const examId = el.examFilter.value;
    const subjectId = el.subjectFilter.value;
    const status = el.statusFilter.value;

    const results = state.tests.filter(test => {

        const exam = find("exams", test.examId);
        const subject = find("subjects", test.subjectId);

        const searchable = [
            test.title,
            test.description,
            exam?.name,
            subject?.name
        ].map(value => String(value || ""))
            .join(" ")
            .toLowerCase();

        if (query && !searchable.includes(query)) {
            return false;
        }

        if (examId !== "all" && test.examId !== examId) {
            return false;
        }

        if (
            subjectId !== "all" &&
            test.subjectId !== subjectId
        ) {
            return false;
        }

        if (
            status === "published" &&
            test.published !== true
        ) {
            return false;
        }

        if (
            status === "draft" &&
            test.published === true
        ) {
            return false;
        }

        return true;

    });

    const sort = el.sortFilter.value;

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

        if (sort === "questions-desc") {

            return (
                Number(b.questionCount || 0) -
                Number(a.questionCount || 0)
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
   09. TABLE AND STATISTICS
===================================================== */

function tableMessage(message) {

    const row = element("tr");
    const cell = element("td");

    cell.colSpan = 8;

    cell.append(
        element("div", "admin-empty-state", message)
    );

    row.append(cell);

    el.table.replaceChildren(row);
    el.pagination.hidden = true;

}

function actionButton(label, action, id, danger = false) {

    const button = element(
        "button",
        danger
            ? "admin-icon-button is-danger"
            : "admin-icon-button",
        label
    );

    button.type = "button";
    button.dataset.action = action;
    button.dataset.id = id;

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

    records.forEach(test => {

        const exam = find("exams", test.examId);
        const subject = find("subjects", test.subjectId);

        const row = element("tr");

        const titleCell = element(
            "td",
            "admin-table-title",
            test.title || "Untitled test"
        );

        const examCell = element(
            "td",
            "",
            exam?.name || "Exam unavailable"
        );

        const subjectCell = element(
            "td",
            "",
            test.subjectId
                ? subject?.name || "Subject unavailable"
                : "Full Examination"
        );

        const countCell = element(
            "td",
            "",
            Number.isInteger(test.questionCount)
                ? test.questionCount
                : Array.isArray(test.questionIds)
                    ? test.questionIds.length
                    : 0
        );

        const durationCell = element(
            "td",
            "",
            Number(test.duration) === 0
                ? "Untimed"
                : `${test.duration || 0} min`
        );

        const statusCell = element("td");

        statusCell.append(
            element(
                "span",
                test.published === true
                    ? "admin-status-badge is-published"
                    : "admin-status-badge is-draft",
                test.published === true
                    ? "Published"
                    : "Draft"
            )
        );

        const updatedCell = element(
            "td",
            "",
            dateLabel(test.updatedAt || test.createdAt)
        );

        const actionsCell = element("td");

        const actions = element(
            "div",
            "admin-table-actions"
        );

        actions.append(

            actionButton("Edit", "edit", test.id),

            actionButton(
                test.published === true
                    ? "Unpublish"
                    : "Publish",
                "toggle",
                test.id
            ),

            actionButton(
                "Delete",
                "delete",
                test.id,
                true
            )

        );

        actionsCell.append(actions);

        row.append(
            titleCell,
            examCell,
            subjectCell,
            countCell,
            durationCell,
            statusCell,
            updatedCell,
            actionsCell
        );

        fragment.append(row);

    });

    el.table.append(fragment);

}

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

    for (let page = 1; page <= pages; page++) {

        const button = element(
            "button",
            page === state.page ? "is-active" : "",
            page
        );

        button.type = "button";
        button.dataset.page = String(page);

        if (page === state.page) {
            button.setAttribute("aria-current", "page");
        }

        el.paginationButtons.append(button);

    }

}

function render() {

    if (!allLoaded()) {
        return;
    }

    const results = filteredTests();

    const published = state.tests.filter(
        test => test.published === true
    ).length;

    text(el.total, state.tests.length);
    text(el.published, published);
    text(el.drafts, state.tests.length - published);
    text(el.filtered, results.length);

    const pages = Math.max(
        1,
        Math.ceil(results.length / CONFIG.pageSize)
    );

    state.page = Math.min(state.page, pages);

    const start = (state.page - 1) * CONFIG.pageSize;

    renderTable(
        results.slice(start, start + CONFIG.pageSize)
    );

    renderPagination(results.length);

}


/* =====================================================
   10. MODAL HANDLING
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

function modalKeyboard(event) {

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
   11. QUESTION VALIDATION
===================================================== */

function validQuestion(question) {

    if (
        !question ||
        typeof question.question !== "string" ||
        !question.question.trim() ||
        !question.options ||
        typeof question.options !== "object"
    ) {
        return false;
    }

    const options = question.options;

    const keys = ["A", "B", "C", "D"];

    return (
        keys.every(key =>
            typeof options[key] === "string" &&
            Boolean(options[key].trim())
        ) &&
        keys.includes(question.correctOptionId)
    );

}

function eligibleQuestion(question, examId, subjectId) {

    if (
        !question ||
        question.examId !== examId ||
        (subjectId && question.subjectId !== subjectId)
    ) {
        return false;
    }

    const subject = find("subjects", question.subjectId);
    const topic = find("topics", question.topicId);

    return Boolean(
        subject &&
        topic &&
        subject.examId === examId &&
        topic.examId === examId &&
        topic.subjectId === subject.id
    );

}

function selectedQuestionRecords() {

    return state.selectedIds.map(
        id => find("questions", id)
    );

}


/* =====================================================
   12. QUESTION TOPIC FILTER
===================================================== */

function populateQuestionTopics() {

    const previous = el.questionTopic.value;

    const examId = el.parentExam.value;
    const subjectId = el.parentSubject.value;

    el.questionTopic.replaceChildren(
        new Option("All Topics", "all")
    );

    byName(state.topics)
        .filter(topic =>
            topic.examId === examId &&
            (!subjectId || topic.subjectId === subjectId)
        )
        .forEach(topic => {

            addOption(
                el.questionTopic,
                topic.name || "Untitled topic",
                topic.id
            );

        });

    if (hasOption(el.questionTopic, previous)) {
        el.questionTopic.value = previous;
    }

    const enabled = Boolean(examId);

    el.questionSearch.disabled = !enabled;
    el.questionTopic.disabled = !enabled;

    state.questionPage = 1;

    renderQuestionSelector();

}


/* =====================================================
   13. AVAILABLE QUESTION SELECTOR
===================================================== */

function availableQuestions() {

    const examId = el.parentExam.value;
    const subjectId = el.parentSubject.value;

    const topicId = el.questionTopic.value;

    const query = el.questionSearch.value
        .trim()
        .toLowerCase();

    return state.questions
        .filter(question => {

            if (!eligibleQuestion(question, examId, subjectId)) {
                return false;
            }

            if (
                topicId !== "all" &&
                question.topicId !== topicId
            ) {
                return false;
            }

            if (
                query &&
                !String(question.question || "")
                    .toLowerCase()
                    .includes(query)
            ) {
                return false;
            }

            return true;

        })
        .sort((a, b) =>
            Number(a.order || 0) - Number(b.order || 0) ||
            String(a.question || "").localeCompare(
                String(b.question || "")
            )
        );

}

function renderQuestionSelector() {

    el.available.replaceChildren();

    const examId = el.parentExam.value;

    if (!examId) {

        el.questionLoading.hidden = false;

        text(
            el.questionLoading,
            "Select an examination to view available questions."
        );

        el.questionPagination.hidden = true;

        return;

    }

    const records = availableQuestions();

    if (!records.length) {

        el.questionLoading.hidden = false;

        text(
            el.questionLoading,
            "No matching questions are available in the Question Bank."
        );

        el.questionPagination.hidden = true;

        return;

    }

    el.questionLoading.hidden = true;

    const pages = Math.max(
        1,
        Math.ceil(records.length / CONFIG.questionPageSize)
    );

    state.questionPage = Math.min(
        state.questionPage,
        pages
    );

    const start = (
        state.questionPage - 1
    ) * CONFIG.questionPageSize;

    const visible = records.slice(
        start,
        start + CONFIG.questionPageSize
    );

    const fragment = document.createDocumentFragment();

    visible.forEach(question => {

        const label = element(
            "label",
            "admin-question-selection-item"
        );

        const checkbox = element("input");

        checkbox.type = "checkbox";
        checkbox.value = question.id;

        checkbox.dataset.questionId = question.id;

        checkbox.checked = state.selectedIds.includes(
            question.id
        );

        const body = element(
            "span",
            "admin-question-selection-content"
        );

        body.append(
            element(
                "strong",
                "",
                question.question || "Untitled question"
            )
        );

        const topic = find("topics", question.topicId);

        body.append(
            element(
                "small",
                "",
                `${topic?.name || "Unknown topic"} · ${
                    question.published === true
                        ? "Published"
                        : "Draft"
                }`
            )
        );

        label.append(checkbox, body);

        fragment.append(label);

    });

    el.available.append(fragment);

    renderQuestionPagination(records.length, pages);

}

function renderQuestionPagination(total, pages) {

    el.questionPagination.hidden = pages <= 1;

    if (pages <= 1) {
        return;
    }

    const start = (
        state.questionPage - 1
    ) * CONFIG.questionPageSize + 1;

    const end = Math.min(
        state.questionPage * CONFIG.questionPageSize,
        total
    );

    text(
        el.questionPaginationInfo,
        `Showing ${start}–${end} of ${total}`
    );

    el.questionPaginationButtons.replaceChildren();

    for (let page = 1; page <= pages; page++) {

        const button = element(
            "button",
            page === state.questionPage
                ? "is-active"
                : "",
            page
        );

        button.type = "button";
        button.dataset.questionPage = String(page);

        el.questionPaginationButtons.append(button);

    }

}


/* =====================================================
   14. SELECTED QUESTIONS
===================================================== */

function renderSelectedQuestions() {

    el.selected.replaceChildren();

    const fallbackMarks = validNumber(
        el.marks.value,
        0.01,
        1000
    ) ?? 1;

    let maximumMarks = 0;

    if (!state.selectedIds.length) {

        const empty = element(
            "div",
            "admin-empty-state"
        );

        empty.append(
            element("p", "", "No questions selected.")
        );

        el.selected.append(empty);

    } else {

        const fragment = document.createDocumentFragment();

        state.selectedIds.forEach((id, index) => {

            const question = find("questions", id);

            const item = element(
                "div",
                "admin-selected-question-item"
            );

            const label = element(
                "span",
                "admin-selected-question-text",
                `${index + 1}. ${
                    question?.question || "Question unavailable"
                }`
            );

            const controls = element(
                "div",
                "admin-table-actions"
            );

            const up = element(
                "button",
                "admin-icon-button",
                "↑"
            );

            up.type = "button";
            up.dataset.move = "up";
            up.dataset.id = id;
            up.disabled = index === 0;
            up.setAttribute("aria-label", "Move question up");

            const down = element(
                "button",
                "admin-icon-button",
                "↓"
            );

            down.type = "button";
            down.dataset.move = "down";
            down.dataset.id = id;

            down.disabled =
                index === state.selectedIds.length - 1;

            down.setAttribute(
                "aria-label",
                "Move question down"
            );

            const remove = element(
                "button",
                "admin-icon-button is-danger",
                "Remove"
            );

            remove.type = "button";
            remove.dataset.move = "remove";
            remove.dataset.id = id;

            controls.append(up, down, remove);

            item.append(label, controls);

            fragment.append(item);

            if (question) {

                maximumMarks += getQuestionMarks(
                    question,
                    fallbackMarks
                );

            }

        });

        el.selected.append(fragment);

    }

    text(
        el.selectedCount,
        `${state.selectedIds.length} selected`
    );

    el.questionCount.value = String(
        state.selectedIds.length
    );

    el.maximumMarks.value = (
        Math.round(maximumMarks * 100) / 100
    ).toFixed(2);

}

function toggleSelectedQuestion(id, selected) {

    if (!find("questions", id)) {
        return;
    }

    if (selected) {

        if (!state.selectedIds.includes(id)) {
            state.selectedIds.push(id);
        }

    } else {

        state.selectedIds = state.selectedIds.filter(
            item => item !== id
        );

    }

    renderSelectedQuestions();

}

function moveSelectedQuestion(id, direction) {

    const index = state.selectedIds.indexOf(id);

    if (index === -1) {
        return;
    }

    if (direction === "remove") {

        toggleSelectedQuestion(id, false);

        renderQuestionSelector();

        return;

    }

    const target = direction === "up"
        ? index - 1
        : index + 1;

    if (
        target < 0 ||
        target >= state.selectedIds.length
    ) {
        return;
    }

    [
        state.selectedIds[index],
        state.selectedIds[target]
    ] = [
        state.selectedIds[target],
        state.selectedIds[index]
    ];

    renderSelectedQuestions();

}


/* =====================================================
   15. OPEN TEST FORM
===================================================== */

async function openTestForm(id = null) {

    if (!ready()) {
        return;
    }

    const test = id ? find("tests", id) : null;

    if (id && !test) {

        showStatus(
            "The selected test could not be found.",
            "error"
        );

        return;

    }

    el.form.reset();

    state.selectedIds = [];
    state.questionPage = 1;

    populateSelectors();

    el.recordId.value = test?.id || "";

    el.parentExam.value = test?.examId || "";

    populateFormSubjects();

    el.parentSubject.value = test?.subjectId || "";

    el.title.value = test?.title || "";
    el.description.value = test?.description || "";

    el.duration.value = Number.isInteger(test?.duration)
        ? String(test.duration)
        : "30";

    el.order.value = Number.isInteger(test?.order)
        ? String(test.order)
        : "0";

    el.marks.value =
        test?.marksPerQuestion !== undefined
            ? String(test.marksPerQuestion)
            : "1";

    el.negative.value =
        test?.negativeMarks !== undefined
            ? String(test.negativeMarks)
            : "0";

    el.featured.value = test?.featured === true
        ? "true"
        : "false";

    el.publication.value = test?.published === true
        ? "true"
        : "false";

    el.questionSearch.value = "";

    populateQuestionTopics();

    text(
        el.formTitle,
        test ? "Edit Mock Test" : "Create Mock Test"
    );

    text(
        el.formDescription,
        test
            ? "Update test settings and selected questions."
            : "Configure the examination and select questions from your Question Bank."
    );

    text(
        el.saveText,
        test ? "Update Mock Test" : "Save Mock Test"
    );

    openModal(el.formModal, el.parentExam);

    if (!test) {

        renderSelectedQuestions();
        return;

    }

    const version = state.session;

    setBusy(true);

    try {

        const snapshot = await get(
            ref(
                database,
                `${CONFIG.paths.testQuestions}/${id}`
            )
        );

        if (!sessionValid(version)) {
            return;
        }

        const stored = snapshot.val();

        const copies = normalize(stored);

        const ordered = copies.sort(
            (a, b) =>
                Number(a.order || 0) -
                Number(b.order || 0)
        );

        const ids = ordered.map(
            question => question.sourceQuestionId
        ).filter(value =>
            typeof value === "string" &&
            Boolean(value)
        );

        if (
            !copies.length &&
            Array.isArray(test.questionIds)
        ) {

            state.selectedIds = [...test.questionIds];

        } else {

            state.selectedIds = [...new Set(ids)];

        }

        renderQuestionSelector();
        renderSelectedQuestions();

    } catch (error) {

        console.error(
            "[Mock Tests] Load selected questions:",
            error?.code
        );

        showStatus(
            "Unable to load this test's saved questions.",
            "error"
        );

        closeModal(true);

    } finally {

        setBusy(false);

    }

}


/* =====================================================
   16. VALIDATE TEST FORM
===================================================== */

function validateForm() {

    const examId = el.parentExam.value.trim();
    const subjectId = el.parentSubject.value.trim();

    const exam = find("exams", examId);

    if (!exam) {
        throw new Error("Select an existing examination.");
    }

    const subject = subjectId
        ? find("subjects", subjectId)
        : null;

    if (
        subjectId &&
        (!subject || subject.examId !== examId)
    ) {

        throw new Error(
            "Select a subject belonging to this examination."
        );

    }

    const title = el.title.value.trim();
    const description = el.description.value.trim();

    if (!title || title.length > 180) {

        throw new Error(
            "Enter a test title of up to 180 characters."
        );

    }

    if (description.length > 1000) {

        throw new Error(
            "Test description cannot exceed 1000 characters."
        );

    }

    const duration = validNumber(
        el.duration.value,
        0,
        1440,
        true
    );

    const order = validNumber(
        el.order.value,
        0,
        99999,
        true
    );

    const marksPerQuestion = validNumber(
        el.marks.value,
        0.01,
        1000
    );

    const negativeMarks = validNumber(
        el.negative.value,
        0,
        1000
    );

    if (duration === null) {

        throw new Error(
            "Duration must be a whole number from 0 to 1440."
        );

    }

    if (order === null) {

        throw new Error(
            "Display order must be a whole number from 0 to 99999."
        );

    }

    if (marksPerQuestion === null) {

        throw new Error(
            "Default marks must be between 0.01 and 1000."
        );

    }

    if (negativeMarks === null) {

        throw new Error(
            "Negative marks must be between 0 and 1000."
        );

    }

    const published = el.publication.value === "true";

    if (
        published &&
        (
            exam.published !== true ||
            (subject && subject.published !== true)
        )
    ) {

        throw new Error(
            "Publish the parent examination and selected subject first."
        );

    }

    if (published && !state.selectedIds.length) {

        throw new Error(
            "Select at least one question before publishing."
        );

    }

    if (
        new Set(state.selectedIds).size !==
        state.selectedIds.length
    ) {

        throw new Error(
            "Duplicate question selections are not allowed."
        );

    }

    for (const id of state.selectedIds) {

        const question = find("questions", id);

        if (!eligibleQuestion(question, examId, subjectId)) {

            throw new Error(
                "A selected question does not belong to this examination or subject."
            );

        }

        if (published && (
            question.published !== true ||
            !validQuestion(question)
        )) {

            throw new Error(
                "Every selected question must be valid and published before publishing this test."
            );

        }

    }

    return {
        examId,
        subjectId,
        title,
        description,
        duration,
        order,
        marksPerQuestion,
        negativeMarks,
        featured: el.featured.value === "true",
        published,
        questionIds: [...state.selectedIds]
    };

}


/* =====================================================
   17. REVALIDATE CURRENT FIREBASE RECORDS
===================================================== */

async function loadVerifiedData(values) {

    const paths = [

        `${CONFIG.paths.exams}/${values.examId}`

    ];

    if (values.subjectId) {

        paths.push(
            `${CONFIG.paths.subjects}/${values.subjectId}`
        );

    }

    const snapshots = await Promise.all(
        paths.map(path => get(ref(database, path)))
    );

    if (snapshots.some(snapshot => !snapshot.exists())) {

        throw new Error(
            "A selected parent record no longer exists."
        );

    }

    const exam = snapshots[0].val();

    const subject = values.subjectId
        ? snapshots[1].val()
        : null;

    if (
        subject &&
        subject.examId !== values.examId
    ) {

        throw new Error(
            "The selected subject does not belong to this examination."
        );

    }

    if (values.published && (
        exam.published !== true ||
        (subject && subject.published !== true)
    )) {

        throw new Error(
            "Publish the parent examination and subject first."
        );

    }

    const questionSnapshots = await Promise.all(

        values.questionIds.map(id =>
            get(
                ref(
                    database,
                    `${CONFIG.paths.questions}/${id}`
                )
            )
        )

    );

    const records = [];

    for (let index = 0; index < values.questionIds.length; index++) {

        const snapshot = questionSnapshots[index];

        if (!snapshot.exists()) {

            throw new Error(
                "A selected Question Bank record no longer exists."
            );

        }

        const question = snapshot.val();

        const id = values.questionIds[index];

        if (!eligibleQuestion(
            question,
            values.examId,
            values.subjectId
        )) {

            throw new Error(
                "A selected question has an invalid examination or subject association."
            );

        }

        if (
            values.published &&
            (
                question.published !== true ||
                !validQuestion(question)
            )
        ) {

            throw new Error(
                "A selected question is unpublished or incomplete."
            );

        }

        if (values.published) {

            const parentSnapshots = await Promise.all([

                get(
                    ref(
                        database,
                        `${CONFIG.paths.subjects}/${question.subjectId}`
                    )
                ),

                get(
                    ref(
                        database,
                        `${CONFIG.paths.topics}/${question.topicId}`
                    )
                )

            ]);

            if (
                !parentSnapshots[0].exists() ||
                !parentSnapshots[1].exists()
            ) {

                throw new Error(
                    "A selected question has a missing parent."
                );

            }

            const questionSubject = parentSnapshots[0].val();
            const questionTopic = parentSnapshots[1].val();

            if (
                questionSubject.published !== true ||
                questionTopic.published !== true ||
                questionSubject.examId !== values.examId ||
                questionTopic.examId !== values.examId ||
                questionTopic.subjectId !== question.subjectId
            ) {

                throw new Error(
                    "All parent subjects and topics of published questions must also be published."
                );

            }

        }

        records.push({
            id,
            ...question
        });

    }

    return records;

}


/* =====================================================
   18. BUILD QUESTION COPIES
===================================================== */

function buildQuestionCopies(questions, values) {

    const copies = {};

    questions.forEach((question, index) => {

        const id = question.id;

        const marks = getQuestionMarks(
            question,
            values.marksPerQuestion
        );

        const negativeMarks = validNumber(
            question.negativeMarks,
            0,
            1000
        ) ?? values.negativeMarks;

        copies[id] = {

            sourceQuestionId: id,

            examId: question.examId,
            subjectId: question.subjectId,
            topicId: question.topicId,

            category:
                find("topics", question.topicId)?.name || "",

            question: String(question.question || ""),

            options: {
                A: String(question.options?.A || ""),
                B: String(question.options?.B || ""),
                C: String(question.options?.C || ""),
                D: String(question.options?.D || "")
            },

            correctOptionId:
                String(question.correctOptionId || ""),

            explanation:
                String(question.explanation || ""),

            marks,
            negativeMarks,

            order: index,

            published: question.published === true

        };

    });

    return copies;

}

function calculateMaximumMarks(copies) {

    return Math.round(
        Object.values(copies).reduce(
            (total, question) =>
                total + Number(question.marks || 0),
            0
        ) * 100
    ) / 100;

}


/* =====================================================
   19. SAVE MOCK TEST
===================================================== */

async function saveTest(event) {

    event.preventDefault();

    if (!ready()) {
        return;
    }

    let values;

    try {

        values = validateForm();

    } catch (error) {

        showStatus(error.message, "error");
        return;

    }

    const existingId = el.recordId.value.trim();

    const existing = existingId
        ? find("tests", existingId)
        : null;

    if (existingId && !existing) {

        showStatus(
            "This mock test no longer exists.",
            "error"
        );

        return;

    }

    const id = existingId || push(
        ref(database, CONFIG.paths.tests)
    ).key;

    if (!id) {

        showStatus(
            "Unable to generate a mock test identifier.",
            "error"
        );

        return;

    }

    const version = state.session;

    setBusy(true);

    try {

        const questions = await loadVerifiedData(values);

        if (!sessionValid(version)) {

            throw new Error(
                "Administrator session changed."
            );

        }

        const copies = buildQuestionCopies(
            questions,
            values
        );

        const now = Date.now();

        const record = {

            examId: values.examId,

            /*
             * Empty optional subject is omitted because
             * Firebase RTDB does not store undefined.
             */

            title: values.title,
            description: values.description,

            duration: values.duration,
            order: values.order,

            marksPerQuestion: values.marksPerQuestion,
            negativeMarks: values.negativeMarks,

            featured: values.featured,
            published: values.published,

            questionIds: values.questionIds,

            questionCount: values.questionIds.length,

            maximumMarks: calculateMaximumMarks(copies),

            createdAt: existing?.createdAt || now,
            updatedAt: now

        };

        if (values.subjectId) {
            record.subjectId = values.subjectId;
        }

        /*
         * Empty question collections are represented by
         * null, not fabricated placeholder questions.
         */

        const changes = {};

        changes[`${CONFIG.paths.tests}/${id}`] = record;

        changes[`${CONFIG.paths.testQuestions}/${id}`] =
            values.questionIds.length ? copies : null;

        changes[`${CONFIG.paths.publicTests}/${id}`] =
            values.published ? record : null;

        changes[`${CONFIG.paths.publicTestQuestions}/${id}`] =
            values.published ? copies : null;

        await update(
            ref(database),
            changes
        );

        closeModal(true);

        showStatus(
            existing
                ? "Mock test updated successfully."
                : "Mock test created successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "[Mock Tests] Save:",
            error?.code || error?.message
        );

        showStatus(
            error?.code
                ? "Unable to save the mock test. Check Firebase permissions."
                : error.message,
            "error"
        );

    } finally {

        setBusy(false);

    }

}


/* =====================================================
   20. QUICK PUBLISH / UNPUBLISH
===================================================== */

async function togglePublication(id) {

    if (!ready()) {
        return;
    }

    const existing = find("tests", id);

    if (!existing) {
        return;
    }

    const published = existing.published !== true;

    const version = state.session;

    setBusy(true);

    try {

        const questionSnapshot = await get(
            ref(
                database,
                `${CONFIG.paths.testQuestions}/${id}`
            )
        );

        const copies = normalize(
            questionSnapshot.val()
        ).sort(
            (a, b) =>
                Number(a.order || 0) -
                Number(b.order || 0)
        );

        const ids = copies.map(
            question => question.sourceQuestionId
        );

        if (
            ids.some(id =>
                typeof id !== "string" || !id
            ) ||
            new Set(ids).size !== ids.length
        ) {

            throw new Error(
                "This test has invalid saved question references. Edit and save it first."
            );

        }

        const values = {

            examId: existing.examId,
            subjectId: existing.subjectId || "",

            published,

            marksPerQuestion: existing.marksPerQuestion,
            negativeMarks: existing.negativeMarks,

            questionIds: ids

        };

        if (published && !ids.length) {

            throw new Error(
                "A test needs at least one question before publication."
            );

        }

        const questions = await loadVerifiedData(values);

        if (!sessionValid(version)) {

            throw new Error(
                "Administrator session changed."
            );

        }

        const rebuilt = buildQuestionCopies(
            questions,
            values
        );

        const record = {

            ...existing,

            published,

            questionIds: ids,
            questionCount: ids.length,

            maximumMarks: calculateMaximumMarks(rebuilt),

            updatedAt: Date.now()

        };

        delete record.id;

        const changes = {};

        changes[`${CONFIG.paths.tests}/${id}`] = record;

        changes[`${CONFIG.paths.testQuestions}/${id}`] =
            ids.length ? rebuilt : null;

        changes[`${CONFIG.paths.publicTests}/${id}`] =
            published ? record : null;

        changes[`${CONFIG.paths.publicTestQuestions}/${id}`] =
            published ? rebuilt : null;

        await update(
            ref(database),
            changes
        );

        showStatus(
            published
                ? "Mock test published successfully."
                : "Mock test unpublished successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "[Mock Tests] Publication:",
            error?.code || error?.message
        );

        showStatus(
            error?.code
                ? "Unable to update publication. Check Firebase permissions."
                : error.message,
            "error"
        );

    } finally {

        setBusy(false);

    }

}


/* =====================================================
   21. DELETE MOCK TEST
===================================================== */

function openDelete(id) {

    if (!ready()) {
        return;
    }

    const test = find("tests", id);

    if (!test) {
        return;
    }

    state.deleteId = id;

    text(
        el.deleteTitle,
        test.title || "Untitled test"
    );

    openModal(
        el.deleteModal,
        el.cancelDelete
    );

}

async function deleteTest() {

    if (!ready() || !state.deleteId) {
        return;
    }

    const id = state.deleteId;
    const version = state.session;

    setBusy(true, "delete");

    try {

        if (!sessionValid(version)) {

            throw new Error(
                "Administrator session changed."
            );

        }

        /*
         * The Question Bank remains untouched.
         * Only the test and its assembled copies
         * are removed.
         */

        const changes = {};

        changes[`${CONFIG.paths.tests}/${id}`] = null;

        changes[`${CONFIG.paths.testQuestions}/${id}`] = null;

        changes[`${CONFIG.paths.publicTests}/${id}`] = null;

        changes[`${CONFIG.paths.publicTestQuestions}/${id}`] = null;

        await update(
            ref(database),
            changes
        );

        closeModal(true);

        state.deleteId = null;

        showStatus(
            "Mock test deleted successfully. Original Question Bank records were preserved.",
            "success"
        );

    } catch (error) {

        console.error(
            "[Mock Tests] Delete:",
            error?.code || error?.message
        );

        showStatus(
            error?.code
                ? "Unable to delete the mock test. Check Firebase permissions."
                : error.message,
            "error"
        );

    } finally {

        setBusy(false);

    }

}


/* =====================================================
   22. DIRECTORY ACTIONS
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

            openTestForm(id);
            break;

        case "toggle":

            togglePublication(id);
            break;

        case "delete":

            openDelete(id);
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

async function logout() {

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

    el.add.addEventListener(
        "click",
        () => openTestForm()
    );

    el.form.addEventListener(
        "submit",
        saveTest
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

        populateDirectorySubjects();

        state.page = 1;
        render();

    });

    [
        el.subjectFilter,
        el.statusFilter,
        el.sortFilter
    ].forEach(control => {

        control.addEventListener("change", () => {

            state.page = 1;
            render();

        });

    });

    el.reset.addEventListener("click", () => {

        el.search.value = "";

        el.examFilter.value = "all";
        el.subjectFilter.value = "all";

        populateDirectorySubjects();

        el.statusFilter.value = "all";
        el.sortFilter.value = "newest";

        state.page = 1;

        render();

    });

    el.paginationButtons.addEventListener(
        "click",
        event => {

            const button = event.target.closest(
                "button[data-page]"
            );

            if (!button) {
                return;
            }

            state.page = Number(button.dataset.page);

            render();

        }
    );

    el.parentExam.addEventListener("change", () => {

        el.parentSubject.value = "";

        populateFormSubjects();

        state.selectedIds = [];

        el.questionSearch.value = "";
        el.questionTopic.value = "all";

        populateQuestionTopics();
        renderSelectedQuestions();

    });

    el.parentSubject.addEventListener("change", () => {

        /*
         * Retain only questions belonging to the
         * newly selected scope.
         */

        const examId = el.parentExam.value;
        const subjectId = el.parentSubject.value;

        state.selectedIds = state.selectedIds.filter(id =>
            eligibleQuestion(
                find("questions", id),
                examId,
                subjectId
            )
        );

        el.questionTopic.value = "all";

        populateQuestionTopics();
        renderSelectedQuestions();

    });

    el.questionSearch.addEventListener("input", () => {

        state.questionPage = 1;

        renderQuestionSelector();

    });

    el.questionTopic.addEventListener("change", () => {

        state.questionPage = 1;

        renderQuestionSelector();

    });

    el.available.addEventListener("change", event => {

        const checkbox = event.target.closest(
            "input[data-question-id]"
        );

        if (!checkbox) {
            return;
        }

        toggleSelectedQuestion(
            checkbox.dataset.questionId,
            checkbox.checked
        );

    });

    el.selected.addEventListener("click", event => {

        const button = event.target.closest(
            "button[data-move][data-id]"
        );

        if (!button) {
            return;
        }

        moveSelectedQuestion(
            button.dataset.id,
            button.dataset.move
        );

    });

    el.questionPaginationButtons.addEventListener(
        "click",
        event => {

            const button = event.target.closest(
                "button[data-question-page]"
            );

            if (!button) {
                return;
            }

            state.questionPage = Number(
                button.dataset.questionPage
            );

            renderQuestionSelector();

        }
    );

    el.marks.addEventListener(
        "input",
        renderSelectedQuestions
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
        deleteTest
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
        modalKeyboard
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
            !state.activeModal &&
            el.sidebar.classList.contains("is-open")
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
        document.body.dataset.page !== "admin-mock-tests"
    ) {
        return;
    }

    Object.entries(SELECTORS).forEach(([key, selector]) => {

        el[key] = document.querySelector(selector);

    });

    const missing = Object.keys(SELECTORS).filter(
        key => !el[key]
    );

    if (missing.length) {

        console.error(
            "[Mock Tests] Missing HTML elements:",
            missing
        );

        return;

    }

    state.initialized = true;

    text(
        el.year,
        new Date().getFullYear()
    );

    setControls(false);

    registerEvents();

    showGate(
        "Verifying Administrator Access",
        "Checking your administrator session."
    );

    observeAuthentication();

}


/* =====================================================
   27. START APPLICATION
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
   END OF ADMIN-MOCK-TESTS.JS
===================================================== */
