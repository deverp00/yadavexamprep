
/*
=========================================================
YADAV EXAMPREP
File: js/admin-publishing.js

Centralized Publishing Management
Firebase Realtime Database

Designed and Developed by Yadav Web Technologies

Protected master records:
    admin/exams
    admin/subjects
    admin/topics
    admin/lessons
    admin/questions
    admin/tests
    admin/testQuestions

Public mirrors:
    public/exams
    public/subjects
    public/topics
    public/lessons
    public/questions
    public/tests
    public/testQuestions

No educational seed data.
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
    get,
    update,
    onValue
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";


/* =====================================================
   01. CONFIGURATION
===================================================== */

const CONFIG = Object.freeze({

    adminUID: "6HwAPbqwYBgg5Ih2zWycOZFBCe93",

    pageSize: 10,

    collections: [
        "exams",
        "subjects",
        "topics",
        "lessons",
        "questions",
        "tests"
    ],

    labels: {
        exams: "Exams",
        subjects: "Subjects",
        topics: "Topics",
        lessons: "Lessons",
        questions: "Questions",
        tests: "Mock Tests"
    },

    paths: {
        admin: "admin",
        public: "public"
    }

});

const SELECTORS = {

    gate: "#adminAuthGate",
    gateSpinner: "#adminGateSpinner",
    gateTitle: "#adminGateTitle",
    gateDescription: "#adminGateDescription",
    gateLoginLink: "#adminGateLoginLink",

    app: "#adminPublishingApp",

    sidebar: "#adminSidebar",
    backdrop: "#adminSidebarBackdrop",
    menuToggle: "#adminMenuToggle",
    sidebarClose: "#adminSidebarClose",
    sidebarNavigation: "#adminSidebarNavigation",
    sidebarLogout: "#adminSidebarLogout",
    topbarLogout: "#adminTopbarLogout",
    userEmail: "#adminUserEmail",

    refresh: "#refreshPublishingButton",

    status: "#publishingManagementStatus",
    statusSpinner: "#publishingManagementSpinner",
    statusText: "#publishingManagementStatusText",

    total: "#publishingTotalCount",
    published: "#publishingPublishedCount",
    drafts: "#publishingDraftCount",
    issues: "#publishingIssueCount",

    overview: "#publishingCollectionOverview",

    filterForm: "#publishingFilterForm",
    search: "#publishingSearch",
    collectionFilter: "#publishingCollectionFilter",
    statusFilter: "#publishingStatusFilter",
    sortFilter: "#publishingSortFilter",
    reset: "#resetPublishingFilters",

    table: "#publishingTableBody",
    emptyTemplate: "#publishingEmptyStateTemplate",

    pagination: "#publishingPagination",
    paginationInfo: "#publishingPaginationInfo",
    paginationButtons: "#publishingPaginationButtons",

    issueList: "#publishingIssueList",

    confirmModal: "#publishingConfirmModal",
    confirmTitle: "#publishingConfirmTitle",
    confirmDescription: "#publishingConfirmDescription",
    confirmName: "#publishingConfirmRecordName",
    confirmNotice: "#publishingConfirmNotice",
    affected: "#publishingAffectedRecords",

    closeConfirm: "#closePublishingConfirmModal",
    cancelConfirm: "#cancelPublishingChange",
    confirm: "#confirmPublishingChange",
    confirmText: "#confirmPublishingButtonText",
    confirmSpinner: "#confirmPublishingSpinner",

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

    master: {},
    public: {},

    received: {
        master: false,
        public: false
    },

    unsubscribe: [],

    records: [],
    issues: [],

    page: 1,

    pending: null,

    activeModal: null,
    returnFocus: null

};

const el = {};


/* =====================================================
   03. DOM HELPERS
===================================================== */

function setText(target, value) {

    if (target) {
        target.textContent = String(value);
    }

}

function create(tag, className = "", value) {

    const node = document.createElement(tag);

    if (className) {
        node.className = className;
    }

    if (value !== undefined) {
        node.textContent = String(value);
    }

    return node;

}

function button(label, action, collection, id) {

    const node = create(
        "button",
        "admin-icon-button",
        label
    );

    node.type = "button";
    node.dataset.action = action;
    node.dataset.collection = collection;
    node.dataset.id = id;

    node.disabled = state.busy;

    return node;

}

function normalize(value) {

    if (!value || typeof value !== "object") {
        return {};
    }

    return Object.fromEntries(

        Object.entries(value).filter(
            ([, record]) =>
                record &&
                typeof record === "object" &&
                !Array.isArray(record)
        )

    );

}

function getCollection(root, collection) {

    return normalize(root?.[collection]);

}

function getRecord(root, collection, id) {

    if (!id || typeof id !== "string") {
        return null;
    }

    return getCollection(root, collection)[id] || null;

}

function collectionEntries(root, collection) {

    return Object.entries(
        getCollection(root, collection)
    ).map(([id, record]) => ({

        ...record,
        id,
        collection

    }));

}

function isPublished(record) {

    return record?.published === true;

}

function displayName(collection, record) {

    if (collection === "questions") {

        return String(
            record?.question || "Untitled question"
        );

    }

    return String(
        record?.title ||
        record?.name ||
        "Untitled record"
    );

}

function timestamp(value) {

    if (
        typeof value === "number" &&
        Number.isFinite(value)
    ) {

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

function sessionValid(version) {

    return (
        state.authorized &&
        state.session === version &&
        auth.currentUser?.uid === CONFIG.adminUID
    );

}

function ready() {

    return (
        state.authorized &&
        state.received.master &&
        state.received.public &&
        !state.busy
    );

}


/* =====================================================
   04. STATUS AND CONTROLS
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
        "is-error",
        "is-success",
        "is-warning"
    );

    if (type !== "loading") {

        el.status.classList.add(`is-${type}`);

    }

    el.statusSpinner.hidden = type !== "loading";

    setText(el.statusText, message);

}

function setControls() {

    const enabled = ready();

    [
        el.refresh,
        el.search,
        el.collectionFilter,
        el.statusFilter,
        el.sortFilter,
        el.reset
    ].forEach(control => {

        control.disabled = !enabled;

    });

    el.confirm.disabled = state.busy;

    el.confirmSpinner.hidden = !state.busy;

    setText(
        el.confirmText,
        state.busy
            ? "Applying Changes..."
            : state.pending?.publish
                ? "Publish Content"
                : "Unpublish Content"
    );

}

function setBusy(value) {

    state.busy = value;

    setControls();
    render();

}


/* =====================================================
   05. AUTHENTICATION
===================================================== */

function stopSubscriptions() {

    state.unsubscribe.forEach(unsubscribe => {

        unsubscribe();

    });

    state.unsubscribe = [];

}

function observeAuthentication() {

    onAuthStateChanged(

        auth,

        async user => {

            const version = ++state.session;

            stopSubscriptions();

            state.received.master = false;
            state.received.public = false;

            if (
                !user ||
                user.uid !== CONFIG.adminUID
            ) {

                state.authorized = false;

                closeModal(true);
                setControls();

                showGate(

                    user
                        ? "Access Denied"
                        : "Sign In Required",

                    user
                        ? "This account is not authorized."
                        : "Sign in with your administrator account.",

                    true

                );

                if (user) {

                    try {

                        await signOut(auth);

                    } catch (error) {

                        console.error(
                            "[Publishing] Unauthorized sign-out:",
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

            if (
                !isDatabaseConfigured() ||
                !database
            ) {

                showStatus(
                    "Configure the actual Firebase Realtime Database URL in js/firebase-config.js.",
                    "error"
                );

                setControls();

                return;

            }

            subscribeDatabase(version);

        },

        error => {

            ++state.session;

            state.authorized = false;

            stopSubscriptions();

            console.error(
                "[Publishing] Authentication:",
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
   06. DATABASE SUBSCRIPTIONS
===================================================== */

function subscribeDatabase(version) {

    showStatus(
        "Loading master and public publication records..."
    );

    const sources = [

        ["master", CONFIG.paths.admin],
        ["public", CONFIG.paths.public]

    ];

    sources.forEach(([key, path]) => {

        const unsubscribe = onValue(

            ref(database, path),

            snapshot => {

                if (!sessionValid(version)) {
                    return;
                }

                state[key] = snapshot.val() || {};

                state.received[key] = true;

                refreshState();

            },

            error => {

                if (!sessionValid(version)) {
                    return;
                }

                state.received[key] = false;

                console.error(
                    `[Publishing] ${key}:`,
                    error?.code
                );

                showStatus(
                    "Unable to read publishing records. Check Firebase Security Rules.",
                    "error"
                );

                setControls();

            }

        );

        state.unsubscribe.push(unsubscribe);

    });

}

function refreshState() {

    if (
        !state.received.master ||
        !state.received.public
    ) {
        return;
    }

    buildRecordIndex();

    setControls();

    render();

    if (!state.busy) {

        showStatus(

            state.issues.length
                ? `${state.issues.length} publication issue(s) require attention.`
                : "Publication records synchronized.",

            state.issues.length
                ? "warning"
                : "success"

        );

    }

}


/* =====================================================
   07. DEPENDENCY VALIDATION
===================================================== */

function validateDependencies(
    collection,
    record,
    master = state.master,
    effective = null
) {

    const issues = [];

    const lookup = (type, id) => {

        if (!id) {
            return null;
        }

        if (effective) {

            return effective[type]?.[id] || null;

        }

        return getRecord(master, type, id);

    };

    function requireParent(type, id, label) {

        const parent = lookup(type, id);

        if (!parent) {

            issues.push(`${label} is missing.`);

            return null;

        }

        if (!isPublished(parent)) {

            issues.push(`${label} is unpublished.`);

        }

        return parent;

    }

    if (collection === "exams") {

        return issues;

    }

    if (collection === "subjects") {

        requireParent(
            "exams",
            record.examId,
            "Parent examination"
        );

        return issues;

    }

    if (
        collection === "topics" ||
        collection === "lessons" ||
        collection === "questions"
    ) {

        const exam = requireParent(
            "exams",
            record.examId,
            "Parent examination"
        );

        const subject = requireParent(
            "subjects",
            record.subjectId,
            "Parent subject"
        );

        if (
            exam &&
            subject &&
            subject.examId !== record.examId
        ) {

            issues.push(
                "Subject belongs to a different examination."
            );

        }

        if (collection !== "topics") {

            const topic = requireParent(
                "topics",
                record.topicId,
                "Parent topic"
            );

            if (
                topic &&
                (
                    topic.examId !== record.examId ||
                    topic.subjectId !== record.subjectId
                )
            ) {

                issues.push(
                    "Topic does not match the selected examination and subject."
                );

            }

        }

        return issues;

    }

    if (collection === "tests") {

        requireParent(
            "exams",
            record.examId,
            "Parent examination"
        );

        if (record.subjectId) {

            const subject = requireParent(
                "subjects",
                record.subjectId,
                "Parent subject"
            );

            if (
                subject &&
                subject.examId !== record.examId
            ) {

                issues.push(
                    "Test subject belongs to a different examination."
                );

            }

        }

        return issues;

    }

    return issues;

}


/* =====================================================
   08. QUESTION VALIDATION
===================================================== */

function normalizeOptions(options) {

    if (
        !options ||
        typeof options !== "object"
    ) {
        return null;
    }

    const result = {};

    for (const [id, value] of Object.entries(options)) {

        const optionText = typeof value === "string"
            ? value
            : typeof value?.text === "string"
                ? value.text
                : "";

        if (!optionText.trim()) {
            return null;
        }

        result[id] = optionText;

    }

    return Object.keys(result).length >= 2
        ? result
        : null;

}

function validQuestion(record) {

    if (
        !record ||
        typeof record.question !== "string" ||
        !record.question.trim()
    ) {
        return false;
    }

    const options = normalizeOptions(
        record.options
    );

    return Boolean(

        options &&

        typeof record.correctOptionId === "string" &&

        Object.prototype.hasOwnProperty.call(
            options,
            record.correctOptionId
        )

    );

}

function validTestQuestions(
    testId,
    test,
    master = state.master,
    effective = null
) {

    const issues = [];

    const copies = normalize(
        master?.testQuestions?.[testId]
    );

    const entries = Object.entries(copies);

    if (!entries.length) {

        issues.push(
            "Mock test has no assembled questions."
        );

        return issues;

    }

    const expectedIds = Array.isArray(test.questionIds)
        ? test.questionIds
        : [];

    if (
        expectedIds.length &&
        (
            expectedIds.length !== entries.length ||
            new Set(expectedIds).size !== expectedIds.length
        )
    ) {

        issues.push(
            "Saved question references do not match assembled questions."
        );

    }

    for (const [copyId, copy] of entries) {

        const sourceId = copy.sourceQuestionId;

        const source = getRecord(
            master,
            "questions",
            sourceId
        );

        if (!source) {

            issues.push(
                "A source Question Bank record is missing."
            );

            continue;

        }

        if (!isPublished(source)) {

            issues.push(
                "A source question is unpublished."
            );

        }

        if (
            !validQuestion(source) ||
            !validQuestion(copy)
        ) {

            issues.push(
                "An assembled question is incomplete."
            );

        }

        if (
            sourceId !== copyId ||
            source.examId !== test.examId ||
            (
                test.subjectId &&
                source.subjectId !== test.subjectId
            )
        ) {

            issues.push(
                "An assembled question has an invalid source or parent association."
            );

        }

        if (
            expectedIds.length &&
            !expectedIds.includes(sourceId)
        ) {

            issues.push(
                "An assembled question is not included in the test selection."
            );

        }

        const dependencyIssues = validateDependencies(
            "questions",
            source,
            master,
            effective
        );

        issues.push(...dependencyIssues);

        if (
            effective &&
            !effective.questions?.[sourceId]
        ) {

            issues.push(
                "A source question is not eligible for public visibility."
            );

        }

    }

    return [...new Set(issues)];

}


/* =====================================================
   09. BUILD EFFECTIVE PUBLICATION STATE
===================================================== */

function buildEffectiveState(master) {

    const effective = {

        exams: {},
        subjects: {},
        topics: {},
        lessons: {},
        questions: {},
        tests: {},
        testQuestions: {}

    };

    const addCollection = collection => {

        for (
            const [id, record]
            of Object.entries(
                getCollection(master, collection)
            )
        ) {

            if (!isPublished(record)) {
                continue;
            }

            const issues = validateDependencies(
                collection,
                record,
                master,
                effective
            );

            if (issues.length) {
                continue;
            }

            if (
                collection === "questions" &&
                !validQuestion(record)
            ) {
                continue;
            }

            effective[collection][id] = {
                ...record
            };

        }

    };

    /*
     * Parent-first processing ensures that descendants
     * cannot become publicly visible before their
     * complete parent hierarchy is eligible.
     */

    [
        "exams",
        "subjects",
        "topics",
        "lessons",
        "questions"
    ].forEach(addCollection);

    for (
        const [id, test]
        of Object.entries(
            getCollection(master, "tests")
        )
    ) {

        if (!isPublished(test)) {
            continue;
        }

        const dependencyIssues = validateDependencies(
            "tests",
            test,
            master,
            effective
        );

        const questionIssues = validTestQuestions(
            id,
            test,
            master,
            effective
        );

        if (
            dependencyIssues.length ||
            questionIssues.length
        ) {
            continue;
        }

        const copies = normalize(
            master?.testQuestions?.[id]
        );

        effective.tests[id] = {
            ...test
        };

        effective.testQuestions[id] = copies;

    }

    return effective;

}


/* =====================================================
   10. PUBLIC MIRROR COMPARISON
===================================================== */

function equalData(first, second) {

    if (first === second) {
        return true;
    }

    if (
        first === null ||
        second === null ||
        typeof first !== typeof second
    ) {
        return false;
    }

    if (
        typeof first !== "object"
    ) {
        return false;
    }

    if (
        Array.isArray(first) !==
        Array.isArray(second)
    ) {
        return false;
    }

    const firstKeys = Object.keys(first).sort();
    const secondKeys = Object.keys(second).sort();

    if (
        firstKeys.length !== secondKeys.length
    ) {
        return false;
    }

    return firstKeys.every((key, index) =>

        key === secondKeys[index] &&

        equalData(first[key], second[key])

    );

}

function buildMirrorChanges(
    effective,
    currentPublic
) {

    const changes = {};

    const collections = [
        ...CONFIG.collections,
        "testQuestions"
    ];

    collections.forEach(collection => {

        const expected = normalize(
            effective[collection]
        );

        const current = normalize(
            currentPublic?.[collection]
        );

        const ids = new Set([

            ...Object.keys(expected),

            ...Object.keys(current)

        ]);

        ids.forEach(id => {

            const expectedRecord = expected[id];
            const currentRecord = current[id];

            if (
                equalData(
                    expectedRecord ?? null,
                    currentRecord ?? null
                )
            ) {
                return;
            }

            changes[
                `${CONFIG.paths.public}/${collection}/${id}`
            ] = expectedRecord ?? null;

        });

    });

    return changes;

}


/* =====================================================
   11. BUILD DIRECTORY AND ISSUE INDEX
===================================================== */

function buildRecordIndex() {

    const effective = buildEffectiveState(
        state.master
    );

    const records = [];
    const issues = [];

    CONFIG.collections.forEach(collection => {

        const masterRecords = getCollection(
            state.master,
            collection
        );

        const publicRecords = getCollection(
            state.public,
            collection
        );

        for (
            const [id, record]
            of Object.entries(masterRecords)
        ) {

            const dependencyIssues = validateDependencies(
                collection,
                record,
                state.master,
                effective
            );

            if (
                collection === "questions" &&
                isPublished(record) &&
                !validQuestion(record)
            ) {

                dependencyIssues.push(
                    "Question text, options, or correct answer is invalid."
                );

            }

            if (
                collection === "tests" &&
                isPublished(record)
            ) {

                dependencyIssues.push(
                    ...validTestQuestions(
                        id,
                        record,
                        state.master,
                        effective
                    )
                );

            }

            const expected = effective[collection]?.[id];
            const actual = publicRecords[id];

            if (
                !equalData(
                    expected ?? null,
                    actual ?? null
                )
            ) {

                dependencyIssues.push(
                    "Public mirror is out of sync."
                );

            }

            const uniqueIssues = [
                ...new Set(dependencyIssues)
            ];

            const item = {

                ...record,

                id,
                collection,

                displayName: displayName(
                    collection,
                    record
                ),

                issues: uniqueIssues,

                effectivelyPublished:
                    Boolean(expected)

            };

            records.push(item);

            if (uniqueIssues.length) {

                issues.push(item);

            }

        }

        /*
         * Detect public records whose protected
         * master records no longer exist.
         */

        for (
            const [id, record]
            of Object.entries(publicRecords)
        ) {

            if (masterRecords[id]) {
                continue;
            }

            const item = {

                ...record,

                id,
                collection,

                displayName: displayName(
                    collection,
                    record
                ),

                published: false,
                orphan: true,

                issues: [
                    "Public record has no protected master."
                ],

                effectivelyPublished: false

            };

            records.push(item);
            issues.push(item);

        }

    });

    /*
     * Public test-question copies can also become
     * orphaned independently of their test record.
     */

    const expectedCopies = normalize(
        effective.testQuestions
    );

    const actualCopies = normalize(
        state.public?.testQuestions
    );

    for (const id of new Set([

        ...Object.keys(expectedCopies),

        ...Object.keys(actualCopies)

    ])) {

        if (
            equalData(
                expectedCopies[id] ?? null,
                actualCopies[id] ?? null
            )
        ) {
            continue;
        }

        const alreadyReported = issues.some(item =>

            item.collection === "tests" &&
            item.id === id

        );

        if (!alreadyReported) {

            issues.push({

                id,
                collection: "tests",

                displayName:
                    displayName(
                        "tests",
                        getRecord(
                            state.master,
                            "tests",
                            id
                        )
                    ),

                issues: [
                    "Published test-question copies are out of sync."
                ]

            });

        }

    }

    state.records = records;
    state.issues = issues;

}


/* =====================================================
   12. STATISTICS AND COLLECTION OVERVIEW
===================================================== */

function renderStatistics() {

    const records = state.records.filter(
        item => !item.orphan
    );

    const published = records.filter(
        item => isPublished(item)
    ).length;

    setText(el.total, records.length);
    setText(el.published, published);
    setText(el.drafts, records.length - published);
    setText(el.issues, state.issues.length);

}

function renderOverview() {

    el.overview.replaceChildren();

    const fragment = document.createDocumentFragment();

    CONFIG.collections.forEach(collection => {

        const records = collectionEntries(
            state.master,
            collection
        );

        const published = records.filter(
            isPublished
        ).length;

        const issueCount = state.issues.filter(
            item => item.collection === collection
        ).length;

        const card = create(
            "article",
            "admin-stat-card"
        );

        card.append(

            create(
                "span",
                "admin-stat-label",
                CONFIG.labels[collection]
            ),

            create(
                "strong",
                "admin-stat-value",
                records.length
            ),

            create(
                "span",
                "admin-stat-description",
                `${published} published · ${
                    records.length - published
                } drafts · ${issueCount} issues`
            )

        );

        fragment.append(card);

    });

    el.overview.append(fragment);

}


/* =====================================================
   13. FILTERING AND SORTING
===================================================== */

function filteredRecords() {

    const query = el.search.value
        .trim()
        .toLowerCase();

    const collection = el.collectionFilter.value;
    const status = el.statusFilter.value;
    const sort = el.sortFilter.value;

    const results = state.records.filter(item => {

        if (
            collection !== "all" &&
            item.collection !== collection
        ) {
            return false;
        }

        if (
            query &&
            !item.displayName.toLowerCase().includes(query)
        ) {
            return false;
        }

        if (
            status === "published" &&
            !isPublished(item)
        ) {
            return false;
        }

        if (
            status === "draft" &&
            isPublished(item)
        ) {
            return false;
        }

        if (
            status === "issue" &&
            !item.issues.length
        ) {
            return false;
        }

        return true;

    });

    results.sort((a, b) => {

        if (sort === "title-asc") {

            return a.displayName.localeCompare(
                b.displayName
            );

        }

        if (sort === "title-desc") {

            return b.displayName.localeCompare(
                a.displayName
            );

        }

        if (sort === "collection") {

            return a.collection.localeCompare(
                b.collection
            ) || a.displayName.localeCompare(
                b.displayName
            );

        }

        const first = timestamp(
            a.updatedAt || a.createdAt
        );

        const second = timestamp(
            b.updatedAt || b.createdAt
        );

        return sort === "oldest"
            ? first - second
            : second - first;

    });

    return results;

}


/* =====================================================
   14. DIRECTORY TABLE
===================================================== */

function renderTable(records) {

    el.table.replaceChildren();

    if (!records.length) {

        el.table.append(
            el.emptyTemplate.content.cloneNode(true)
        );

        return;

    }

    const fragment = document.createDocumentFragment();

    records.forEach(item => {

        const row = create("tr");

        const nameCell = create(
            "td",
            "admin-table-title",
            item.displayName
        );

        const collectionCell = create(
            "td",
            "",
            CONFIG.labels[item.collection]
        );

        const statusCell = create("td");

        statusCell.append(
            create(
                "span",
                isPublished(item)
                    ? "admin-status-badge is-published"
                    : "admin-status-badge is-draft",
                item.orphan
                    ? "Orphan"
                    : isPublished(item)
                        ? "Published"
                        : "Draft"
            )
        );

        const dependencyCell = create("td");

        dependencyCell.append(
            create(
                "span",
                item.issues.length
                    ? "admin-status-badge is-draft"
                    : "admin-status-badge is-published",
                item.issues.length
                    ? `${item.issues.length} issue(s)`
                    : "Valid"
            )
        );

        if (item.issues.length) {

            const details = create(
                "small",
                "admin-form-help",
                item.issues.join(" ")
            );

            dependencyCell.append(details);

        }

        const updatedCell = create(
            "td",
            "",
            formatDate(
                item.updatedAt || item.createdAt
            )
        );

        const actionCell = create("td");

        const actions = create(
            "div",
            "admin-table-actions"
        );

        if (!item.orphan) {

            actions.append(
                button(
                    isPublished(item)
                        ? "Unpublish"
                        : "Publish",
                    "toggle",
                    item.collection,
                    item.id
                )
            );

        }

        actionCell.append(actions);

        row.append(

            nameCell,
            collectionCell,
            statusCell,
            dependencyCell,
            updatedCell,
            actionCell

        );

        fragment.append(row);

    });

    el.table.append(fragment);

}


/* =====================================================
   15. PAGINATION
===================================================== */

function renderPagination(total) {

    const pages = Math.ceil(
        total / CONFIG.pageSize
    );

    el.pagination.hidden = pages <= 1;

    if (pages <= 1) {
        return;
    }

    const start = (
        state.page - 1
    ) * CONFIG.pageSize + 1;

    const end = Math.min(
        state.page * CONFIG.pageSize,
        total
    );

    setText(
        el.paginationInfo,
        `Showing ${start}–${end} of ${total}`
    );

    el.paginationButtons.replaceChildren();

    for (let page = 1; page <= pages; page++) {

        const item = create(
            "button",
            page === state.page ? "is-active" : "",
            page
        );

        item.type = "button";
        item.dataset.page = String(page);

        if (page === state.page) {

            item.setAttribute(
                "aria-current",
                "page"
            );

        }

        el.paginationButtons.append(item);

    }

}


/* =====================================================
   16. DEPENDENCY ISSUE REVIEW
===================================================== */

function renderIssues() {

    el.issueList.replaceChildren();

    if (!state.issues.length) {

        const empty = create(
            "div",
            "admin-empty-state"
        );

        empty.append(

            create(
                "h3",
                "",
                "No publication issues detected"
            ),

            create(
                "p",
                "",
                "The current master and public records have no detected publishing inconsistencies."
            )

        );

        el.issueList.append(empty);

        return;

    }

    const fragment = document.createDocumentFragment();

    state.issues.forEach(item => {

        const card = create(
            "article",
            "admin-alert is-warning"
        );

        const heading = create(
            "strong",
            "",
            `${CONFIG.labels[item.collection]}: ${
                item.displayName
            }`
        );

        const list = create("ul");

        item.issues.forEach(message => {

            list.append(
                create("li", "", message)
            );

        });

        card.append(heading, list);

        fragment.append(card);

    });

    el.issueList.append(fragment);

}


/* =====================================================
   17. MAIN RENDER
===================================================== */

function render() {

    if (
        !state.received.master ||
        !state.received.public
    ) {
        return;
    }

    renderStatistics();
    renderOverview();
    renderIssues();

    const results = filteredRecords();

    const pages = Math.max(
        1,
        Math.ceil(results.length / CONFIG.pageSize)
    );

    state.page = Math.min(
        state.page,
        pages
    );

    const start = (
        state.page - 1
    ) * CONFIG.pageSize;

    renderTable(
        results.slice(
            start,
            start + CONFIG.pageSize
        )
    );

    renderPagination(results.length);

}


/* =====================================================
   18. MODAL
===================================================== */

function openModal(modal, focusTarget) {

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

    if (!state.busy) {
        state.pending = null;
    }

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

    const controls = [

        ...state.activeModal.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]'
        )

    ].filter(item =>
        item.getClientRects().length > 0
    );

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
   19. PREVIEW PUBLICATION IMPACT
===================================================== */

function previewPublication(
    collection,
    id,
    publish
) {

    const record = getRecord(
        state.master,
        collection,
        id
    );

    if (!record) {
        return null;
    }

    const proposed = structuredClone(
        state.master
    );

    proposed[collection] ||= {};

    proposed[collection][id] = {

        ...record,

        published: publish

    };

    const currentEffective = buildEffectiveState(
        state.master
    );

    const nextEffective = buildEffectiveState(
        proposed
    );

    const affected = [];

    CONFIG.collections.forEach(type => {

        const current = getCollection(
            currentEffective,
            type
        );

        const next = getCollection(
            nextEffective,
            type
        );

        const ids = new Set([

            ...Object.keys(current),

            ...Object.keys(next)

        ]);

        ids.forEach(recordId => {

            const before = Boolean(current[recordId]);
            const after = Boolean(next[recordId]);

            if (before === after) {
                return;
            }

            affected.push({

                collection: type,
                id: recordId,

                name: displayName(
                    type,
                    getRecord(
                        proposed,
                        type,
                        recordId
                    )
                ),

                action: after
                    ? "Become public"
                    : "Remove from public"

            });

        });

    });

    const targetEligible = Boolean(
        nextEffective[collection]?.[id]
    );

    return {

        proposed,
        nextEffective,
        affected,
        targetEligible

    };

}


/* =====================================================
   20. OPEN CONFIRMATION
===================================================== */

function openConfirmation(collection, id) {

    if (!ready()) {
        return;
    }

    const record = getRecord(
        state.master,
        collection,
        id
    );

    if (!record) {

        showStatus(
            "The selected record no longer exists.",
            "error"
        );

        return;

    }

    const publish = !isPublished(record);

    const preview = previewPublication(
        collection,
        id,
        publish
    );

    if (!preview) {
        return;
    }

    if (
        publish &&
        !preview.targetEligible
    ) {

        showStatus(
            "This record cannot be published yet. Resolve its parent or content dependencies first.",
            "error"
        );

        return;

    }

    state.pending = {

        collection,
        id,
        publish

    };

    setText(
        el.confirmTitle,
        publish
            ? "Publish Content?"
            : "Unpublish Content?"
    );

    setText(
        el.confirmDescription,
        publish
            ? "Review the content that will become publicly visible."
            : "Review all public content affected by this change."
    );

    setText(
        el.confirmName,
        displayName(collection, record)
    );

    setText(
        el.confirmNotice,
        publish
            ? "Eligible content will be synchronized with the public database."
            : "Affected public mirrors will be removed. Protected master records will be preserved."
    );

    el.affected.replaceChildren();

    if (!preview.affected.length) {

        el.affected.append(
            create(
                "p",
                "admin-form-help",
                "No additional public records are affected."
            )
        );

    } else {

        const heading = create(
            "h3",
            "",
            `Affected records: ${preview.affected.length}`
        );

        const list = create("ul");

        preview.affected.forEach(item => {

            list.append(
                create(
                    "li",
                    "",
                    `${item.action}: ${
                        CONFIG.labels[item.collection]
                    } — ${item.name}`
                )
            );

        });

        el.affected.append(heading, list);

    }

    setControls();

    openModal(
        el.confirmModal,
        el.cancelConfirm
    );

}


/* =====================================================
   21. APPLY PUBLICATION CHANGE
===================================================== */

async function applyPublicationChange() {

    if (!ready() || !state.pending) {
        return;
    }

    const pending = {
        ...state.pending
    };

    const version = state.session;

    setBusy(true);

    try {

        /*
         * Fetch fresh protected and public records.
         * Do not rely only on the previously received
         * realtime snapshots.
         */

        const [masterSnapshot, publicSnapshot] =
            await Promise.all([

                get(
                    ref(
                        database,
                        CONFIG.paths.admin
                    )
                ),

                get(
                    ref(
                        database,
                        CONFIG.paths.public
                    )
                )

            ]);

        if (!sessionValid(version)) {

            throw new Error(
                "Administrator session changed."
            );

        }

        const freshMaster =
            masterSnapshot.val() || {};

        const freshPublic =
            publicSnapshot.val() || {};

        const currentRecord = getRecord(
            freshMaster,
            pending.collection,
            pending.id
        );

        if (!currentRecord) {

            throw new Error(
                "The selected record no longer exists."
            );

        }

        if (
            isPublished(currentRecord) === pending.publish
        ) {

            throw new Error(
                "This record's publication status has already changed. Refresh and review it again."
            );

        }

        const proposed = structuredClone(
            freshMaster
        );

        proposed[pending.collection] ||= {};

        const updatedRecord = {

            ...currentRecord,

            published: pending.publish,

            updatedAt: Date.now()

        };

        proposed[pending.collection][pending.id] =
            updatedRecord;

        const effective = buildEffectiveState(
            proposed
        );

        if (
            pending.publish &&
            !effective[pending.collection]?.[pending.id]
        ) {

            throw new Error(
                "Publication blocked. Required parent records or question dependencies are incomplete."
            );

        }

        const changes = buildMirrorChanges(
            effective,
            freshPublic
        );

        changes[
            `${CONFIG.paths.admin}/${pending.collection}/${pending.id}`
        ] = updatedRecord;

        /*
         * Single multi-location database update:
         * master status and public mirrors change
         * together, or the update fails together.
         */

        await update(
            ref(database),
            changes
        );

        if (!sessionValid(version)) {
            return;
        }

        closeModal(true);

        state.pending = null;

        showStatus(
            pending.publish
                ? "Content published and public dependencies synchronized."
                : "Content unpublished. Affected public descendants were removed without deleting their master records.",
            "success"
        );

    } catch (error) {

        console.error(
            "[Publishing] Apply:",
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
   22. MANUAL REFRESH
===================================================== */

async function refreshPublishing() {

    if (!ready()) {
        return;
    }

    const version = state.session;

    setBusy(true);

    showStatus(
        "Refreshing publication records..."
    );

    try {

        const [masterSnapshot, publicSnapshot] =
            await Promise.all([

                get(
                    ref(
                        database,
                        CONFIG.paths.admin
                    )
                ),

                get(
                    ref(
                        database,
                        CONFIG.paths.public
                    )
                )

            ]);

        if (!sessionValid(version)) {
            return;
        }

        state.master = masterSnapshot.val() || {};
        state.public = publicSnapshot.val() || {};

        buildRecordIndex();

        showStatus(
            "Publication records refreshed.",
            "success"
        );

    } catch (error) {

        console.error(
            "[Publishing] Refresh:",
            error?.code
        );

        showStatus(
            "Unable to refresh publishing records.",
            "error"
        );

    } finally {

        setBusy(false);

    }

}


/* =====================================================
   23. DIRECTORY ACTIONS
===================================================== */

function handleTableAction(event) {

    const target = event.target.closest(
        "button[data-action][data-collection][data-id]"
    );

    if (
        !target ||
        !el.table.contains(target)
    ) {
        return;
    }

    if (target.dataset.action === "toggle") {

        openConfirmation(
            target.dataset.collection,
            target.dataset.id
        );

    }

}


/* =====================================================
   24. SIDEBAR
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

        window.location.replace(
            "index.html"
        );

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
   26. EVENT LISTENERS
===================================================== */

function registerEvents() {

    el.refresh.addEventListener(
        "click",
        refreshPublishing
    );

    el.filterForm.addEventListener(
        "submit",
        event => event.preventDefault()
    );

    el.search.addEventListener("input", () => {

        state.page = 1;
        render();

    });

    [
        el.collectionFilter,
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
        el.collectionFilter.value = "all";
        el.statusFilter.value = "all";
        el.sortFilter.value = "newest";

        state.page = 1;

        render();

    });

    el.table.addEventListener(
        "click",
        handleTableAction
    );

    el.paginationButtons.addEventListener(
        "click",
        event => {

            const target = event.target.closest(
                "button[data-page]"
            );

            if (!target) {
                return;
            }

            state.page = Number(
                target.dataset.page
            );

            render();

        }
    );

    [
        el.closeConfirm,
        el.cancelConfirm
    ].forEach(control => {

        control.addEventListener(
            "click",
            () => closeModal()
        );

    });

    el.confirm.addEventListener(
        "click",
        applyPublicationChange
    );

    el.confirmModal.addEventListener(
        "click",
        event => {

            if (
                event.target === el.confirmModal
            ) {

                closeModal();

            }

        }
    );

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

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                !state.activeModal &&
                el.sidebar.classList.contains("is-open")
            ) {

                setSidebar(false);

            }

        }
    );

    window.matchMedia("(min-width: 901px)")
        .addEventListener(
            "change",
            event => {

                if (event.matches) {

                    el.sidebar.classList.remove(
                        "is-open"
                    );

                    el.backdrop.hidden = true;

                    el.menuToggle.setAttribute(
                        "aria-expanded",
                        "false"
                    );

                }

            }
        );

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
   27. INITIALIZATION
===================================================== */

function initialize() {

    if (
        state.initialized ||
        document.body.dataset.page !== "admin-publishing"
    ) {
        return;
    }

    Object.entries(SELECTORS).forEach(
        ([key, selector]) => {

            el[key] = document.querySelector(
                selector
            );

        }
    );

    const missing = Object.keys(
        SELECTORS
    ).filter(key => !el[key]);

    if (missing.length) {

        console.error(
            "[Publishing] Missing HTML elements:",
            missing
        );

        return;

    }

    state.initialized = true;

    setText(
        el.year,
        new Date().getFullYear()
    );

    setControls();

    registerEvents();

    showGate(
        "Verifying Administrator Access",
        "Checking your administrator session."
    );

    observeAuthentication();

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
   END OF ADMIN-PUBLISHING.JS
===================================================== */
