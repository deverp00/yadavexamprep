
/*
=========================================================
YADAV EXAMPREP
File: js/script.js

PUBLIC HOMEPAGE CONTROLLER
INTEGRATION PHASE — FULL FILE REPLACEMENT

Designed and Developed by Yadav Web Technologies

DATABASE:
    public/exams
    public/subjects
    public/tests
    public/settings/homepage

IMPORTANT:
- No visitor authentication.
- No sample or fabricated educational records.
- Only published records are displayed.
- Firebase Realtime Database, NOT Firestore.
- Educational records are never written by this file.
=========================================================
*/

"use strict";

(() => {

    /* =================================================
       01. CONFIGURATION
    ================================================= */

    const CONFIG = Object.freeze({

        paths: {

            exams: "public/exams",

            subjects: "public/subjects",

            tests: "public/tests",

            settings: "public/settings/homepage"

        },

        defaults: {

            showFeaturedExams: true,

            showFeaturedSubjects: true,

            showFeaturedTests: true,

            showLearningSection: true,

            homepageExamLimit: 8,

            homepageTestLimit: 6

        }

    });


    /* =================================================
       02. STATE
    ================================================= */

    const state = {

        exams: [],

        subjects: [],

        tests: [],

        settings: {
            ...CONFIG.defaults
        },

        received: {

            exams: false,

            subjects: false,

            tests: false

        },

        initialized: false,

        connected: false,

        unsubscribe: [],

        error: null

    };


    /* =================================================
       03. ELEMENTS
    ================================================= */

    const elements = {

        exams: document.getElementById(
            "examCategories"
        ),

        subjects: document.getElementById(
            "subjectCategories"
        ),

        tests: document.getElementById(
            "featuredMockTests"
        ),

        year: document.getElementById(
            "currentYear"
        )

    };


    /* =================================================
       04. HELPERS
    ================================================= */

    function cleanText(value) {

        return typeof value === "string"
            ? value.trim()
            : "";

    }

    function createElement(
        tag,
        className = "",
        content
    ) {

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

        if (Array.isArray(value)) {

            return value
                .filter(item =>
                    item &&
                    typeof item === "object" &&
                    !Array.isArray(item)
                )
                .map((item, index) => ({

                    ...item,

                    id: String(item.id ?? index)

                }));

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

    function validId(value) {

        return (
            typeof value === "string" &&
            value.length > 0 &&
            !/[.#$\[\]\/\u0000-\u001f\u007f]/.test(value)
        );

    }

    function isPublished(record) {

        return record?.published === true;

    }

    function getOrder(record) {

        const value = Number(record.order);

        return Number.isFinite(value)
            ? value
            : Number.MAX_SAFE_INTEGER;

    }

    function sortRecords(records) {

        return [...records].sort((a, b) => {

            return (
                getOrder(a) - getOrder(b)
            ) || cleanText(
                a.name || a.title
            ).localeCompare(
                cleanText(b.name || b.title)
            );

        });

    }

    function getLimit(value, fallback) {

        const number = Number(value);

        return Number.isSafeInteger(number) &&
            number >= 1 &&
            number <= 24
                ? number
                : fallback;

    }

    function refreshAnimations() {

        if (
            typeof window.YadavAnimations?.refresh ===
            "function"
        ) {

            window.YadavAnimations.refresh();

        }

    }


    /* =================================================
       05. STATUS COMPONENTS
    ================================================= */

    function renderStatus(
        container,
        title,
        description = "",
        loading = false
    ) {

        if (!container) {
            return;
        }

        container.replaceChildren();

        const wrapper = createElement(
            "div",
            loading
                ? "content-placeholder"
                : "empty-state"
        );

        if (loading) {

            const spinner = createElement(
                "span",
                "ui-spinner"
            );

            spinner.setAttribute(
                "aria-hidden",
                "true"
            );

            wrapper.append(spinner);

        }

        wrapper.append(
            createElement(
                loading ? "p" : "h3",
                "",
                title
            )
        );

        if (description) {

            wrapper.append(
                createElement(
                    "p",
                    "",
                    description
                )
            );

        }

        container.append(wrapper);

        container.setAttribute(
            "aria-busy",
            String(loading)
        );

    }

    function renderLoading() {

        renderStatus(
            elements.exams,
            "Loading examinations...",
            "",
            true
        );

        renderStatus(
            elements.subjects,
            "Loading subjects...",
            "",
            true
        );

        renderStatus(
            elements.tests,
            "Loading mock tests...",
            "",
            true
        );

    }

    function renderError(message) {

        state.error = message;

        [
            elements.exams,
            elements.subjects,
            elements.tests
        ].forEach(container => {

            renderStatus(
                container,
                "Content Unavailable",
                message
            );

        });

    }


    /* =================================================
       06. SVG ICON HELPER
    ================================================= */

    function createIcon(type) {

        const namespace =
            "http://www.w3.org/2000/svg";

        const svg = document.createElementNS(
            namespace,
            "svg"
        );

        const attributes = {

            width: "24",

            height: "24",

            viewBox: "0 0 24 24",

            fill: "none",

            stroke: "currentColor",

            "stroke-width": "1.7",

            "stroke-linecap": "round",

            "stroke-linejoin": "round",

            "aria-hidden": "true"

        };

        Object.entries(attributes).forEach(
            ([key, value]) => {

                svg.setAttribute(key, value);

            }
        );

        const paths = {

            exam: [
                "M4 4h16v16H4z",
                "M8 9h8",
                "M8 13h8",
                "M8 17h5"
            ],

            subject: [
                "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z",
                "M4 17.5A2.5 2.5 0 0 1 6.5 15H20",
                "M9 8h6"
            ],

            test: [
                "M8 3h8",
                "M9 2h6v4H9z",
                "M6 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1",
                "m8 13 2 2 5-5"
            ]

        };

        (paths[type] || paths.exam).forEach(data => {

            const path = document.createElementNS(
                namespace,
                "path"
            );

            path.setAttribute("d", data);

            svg.append(path);

        });

        return svg;

    }


    /* =================================================
       07. PUBLISHED CONTENT
    ================================================= */

    function publishedExams() {

        return sortRecords(
            state.exams.filter(exam =>

                isPublished(exam) &&

                validId(exam.id) &&

                Boolean(cleanText(exam.name))

            )
        );

    }

    function publishedSubjects() {

        const availableExams = new Set(
            publishedExams().map(exam => exam.id)
        );

        return sortRecords(
            state.subjects.filter(subject =>

                isPublished(subject) &&

                validId(subject.id) &&

                availableExams.has(subject.examId) &&

                Boolean(cleanText(subject.name))

            )
        );

    }

    function publishedTests() {

        const exams = new Set(
            publishedExams().map(exam => exam.id)
        );

        const subjects = new Set(
            publishedSubjects().map(subject => subject.id)
        );

        return sortRecords(
            state.tests.filter(test =>

                isPublished(test) &&

                test.featured === true &&

                validId(test.id) &&

                exams.has(test.examId) &&

                (
                    !test.subjectId ||
                    subjects.has(test.subjectId)
                ) &&

                Boolean(cleanText(test.title))

            )
        );

    }


    /* =================================================
       08. EXAMINATION CARDS
    ================================================= */

    function createExamCard(exam) {

        const card = createElement(
            "article",
            "exam-card reveal"
        );

        const icon = createElement(
            "div",
            "ui-icon"
        );

        icon.append(
            createIcon("exam")
        );

        const title = createElement(
            "h3",
            "exam-card-title",
            exam.name
        );

        const description = createElement(
            "p",
            "exam-card-description",
            cleanText(exam.description) ||
            "Explore published subjects and available preparation resources."
        );

        const link = createElement(
            "a",
            "text-link",
            "Explore Subjects"
        );

        link.href =
            `subjects.html?exam=${encodeURIComponent(exam.id)}`;

        card.append(
            icon,
            title,
            description,
            link
        );

        return card;

    }

    function renderExams() {

        if (!elements.exams) {
            return;
        }

        const records = publishedExams().slice(
            0,
            getLimit(
                state.settings.homepageExamLimit,
                CONFIG.defaults.homepageExamLimit
            )
        );

        if (!records.length) {

            renderStatus(
                elements.exams,
                "No Examinations Published Yet",
                "Published examinations will appear here when they become available."
            );

            return;

        }

        const fragment =
            document.createDocumentFragment();

        records.forEach(exam => {

            fragment.append(
                createExamCard(exam)
            );

        });

        elements.exams.replaceChildren(fragment);

        elements.exams.setAttribute(
            "aria-busy",
            "false"
        );

    }


    /* =================================================
       09. SUBJECT CARDS
    ================================================= */

    function createSubjectCard(subject) {

        const card = createElement(
            "article",
            "subject-card reveal"
        );

        const icon = createElement(
            "div",
            "ui-icon"
        );

        icon.append(
            createIcon("subject")
        );

        const title = createElement(
            "h3",
            "subject-card-title",
            subject.name
        );

        const description = createElement(
            "p",
            "subject-card-description",
            cleanText(subject.description) ||
            "Access available topics and structured learning materials."
        );

        const link = createElement(
            "a",
            "text-link",
            "Start Learning"
        );

        link.href =
            `learn.html?subject=${encodeURIComponent(subject.id)}`;

        card.append(
            icon,
            title,
            description,
            link
        );

        return card;

    }

    function renderSubjects() {

        if (!elements.subjects) {
            return;
        }

        const records = publishedSubjects().slice(
            0,
            getLimit(
                state.settings.homepageExamLimit,
                CONFIG.defaults.homepageExamLimit
            )
        );

        if (!records.length) {

            renderStatus(
                elements.subjects,
                "No Subjects Published Yet",
                "Published subjects will appear here when they become available."
            );

            return;

        }

        const fragment =
            document.createDocumentFragment();

        records.forEach(subject => {

            fragment.append(
                createSubjectCard(subject)
            );

        });

        elements.subjects.replaceChildren(fragment);

        elements.subjects.setAttribute(
            "aria-busy",
            "false"
        );

    }


    /* =================================================
       10. FEATURED MOCK TEST CARDS
    ================================================= */

    function createTestCard(test) {

        const card = createElement(
            "article",
            "mock-card reveal"
        );

        const icon = createElement(
            "div",
            "ui-icon"
        );

        icon.append(
            createIcon("test")
        );

        const badge = createElement(
            "span",
            "ui-badge",
            "Featured Mock Test"
        );

        const title = createElement(
            "h3",
            "mock-card-title",
            test.title
        );

        const description = createElement(
            "p",
            "mock-card-description",
            cleanText(test.description) ||
            "Practise with this published mock examination."
        );

        const details = createElement(
            "div",
            "mock-card-details"
        );

        if (
            Number.isFinite(Number(test.questionCount)) &&
            Number(test.questionCount) > 0
        ) {

            details.append(
                createElement(
                    "span",
                    "",
                    `${Number(test.questionCount)} Questions`
                )
            );

        }

        if (
            Number.isFinite(Number(test.duration)) &&
            Number(test.duration) > 0
        ) {

            details.append(
                createElement(
                    "span",
                    "",
                    `${Number(test.duration)} Minutes`
                )
            );

        }

        const link = createElement(
            "a",
            "btn btn-primary",
            "Start Mock Test"
        );

        link.href =
            `mock-test.html?test=${encodeURIComponent(test.id)}`;

        card.append(
            icon,
            badge,
            title,
            description,
            details,
            link
        );

        return card;

    }

    function renderTests() {

        if (!elements.tests) {
            return;
        }

        const records = publishedTests().slice(
            0,
            getLimit(
                state.settings.homepageTestLimit,
                CONFIG.defaults.homepageTestLimit
            )
        );

        if (!records.length) {

            renderStatus(
                elements.tests,
                "No Featured Mock Tests Yet",
                "Featured published mock tests will appear here when available."
            );

            return;

        }

        const fragment =
            document.createDocumentFragment();

        records.forEach(test => {

            fragment.append(
                createTestCard(test)
            );

        });

        elements.tests.replaceChildren(fragment);

        elements.tests.setAttribute(
            "aria-busy",
            "false"
        );

    }


    /* =================================================
       11. HOMEPAGE SETTINGS
    ================================================= */

    function applySectionVisibility(
        container,
        visible
    ) {

        if (!container) {
            return;
        }

        const section = container.closest(
            "section"
        );

        if (section) {
            section.hidden = !visible;
        }

    }

    function applySettings() {

        applySectionVisibility(
            elements.exams,
            state.settings.showFeaturedExams
        );

        applySectionVisibility(
            elements.subjects,
            state.settings.showFeaturedSubjects
        );

        applySectionVisibility(
            elements.tests,
            state.settings.showFeaturedTests
        );

        /*
         * The learning section has no dedicated ID
         * in the original homepage HTML.
         *
         * Avoid guessing which section to hide.
         * Its visibility will be connected when
         * index.html receives its integration update.
         */

    }

    function updateSettings(value) {

        if (
            !value ||
            typeof value !== "object" ||
            Array.isArray(value)
        ) {

            state.settings = {
                ...CONFIG.defaults
            };

        } else {

            state.settings = {

                ...CONFIG.defaults,

                showFeaturedExams:
                    value.showFeaturedExams !== false,

                showFeaturedSubjects:
                    value.showFeaturedSubjects !== false,

                showFeaturedTests:
                    value.showFeaturedTests !== false,

                showLearningSection:
                    value.showLearningSection !== false,

                homepageExamLimit: getLimit(
                    value.homepageExamLimit,
                    CONFIG.defaults.homepageExamLimit
                ),

                homepageTestLimit: getLimit(
                    value.homepageTestLimit,
                    CONFIG.defaults.homepageTestLimit
                )

            };

        }

        applySettings();

        if (allCollectionsReceived()) {
            renderHomepage();
        }

    }


    /* =================================================
       12. RENDER HOMEPAGE
    ================================================= */

    function allCollectionsReceived() {

        return Object.values(
            state.received
        ).every(Boolean);

    }

    function renderHomepage() {

        if (!allCollectionsReceived()) {
            return;
        }

        state.error = null;

        renderExams();

        renderSubjects();

        renderTests();

        applySettings();

        refreshAnimations();

    }


    /* =================================================
       13. PUBLIC API
    ================================================= */

    function setData(data = {}) {

        if (
            !data ||
            typeof data !== "object"
        ) {
            return;
        }

        ["exams", "subjects", "tests"].forEach(
            collection => {

                if (
                    Object.prototype.hasOwnProperty.call(
                        data,
                        collection
                    )
                ) {

                    state[collection] =
                        normalizeCollection(
                            data[collection]
                        );

                    state.received[collection] = true;

                }

            }
        );

        if (
            Object.prototype.hasOwnProperty.call(
                data,
                "settings"
            )
        ) {

            updateSettings(data.settings);

        }

        renderHomepage();

    }

    function setLoading() {

        renderLoading();

    }

    function getState() {

        return {

            connected: state.connected,

            error: state.error,

            received: {
                ...state.received
            },

            counts: {

                exams: publishedExams().length,

                subjects: publishedSubjects().length,

                featuredTests: publishedTests().length

            }

        };

    }

    window.YadavExamPrep = {

        setData,

        setLoading,

        refresh: renderHomepage,

        normalizeCollection,

        getState

    };


    /* =================================================
       14. FIREBASE CONNECTION
    ================================================= */

    async function connectFirebase() {

        try {

            const firebase = await import(
                "./firebase-config.js"
            );

            const databaseModule = await import(
                "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js"
            );

            if (
                !firebase.isDatabaseConfigured() ||
                !firebase.database
            ) {

                renderError(
                    "The database connection is not configured yet. Please visit again later."
                );

                return;

            }

            const {
                ref,
                onValue
            } = databaseModule;

            const database = firebase.database;

            ["exams", "subjects", "tests"].forEach(
                collection => {

                    const unsubscribe = onValue(

                        ref(
                            database,
                            CONFIG.paths[collection]
                        ),

                        snapshot => {

                            state[collection] =
                                normalizeCollection(
                                    snapshot.val()
                                );

                            state.received[collection] =
                                true;

                            renderHomepage();

                        },

                        error => {

                            console.error(
                                `[Homepage] ${collection}:`,
                                error?.code || error?.message
                            );

                            renderError(
                                "We could not retrieve the published content. Please try again later."
                            );

                        }

                    );

                    state.unsubscribe.push(
                        unsubscribe
                    );

                }
            );

            const settingsUnsubscribe = onValue(

                ref(
                    database,
                    CONFIG.paths.settings
                ),

                snapshot => {

                    updateSettings(
                        snapshot.val()
                    );

                },

                error => {

                    console.warn(
                        "[Homepage] Settings:",
                        error?.code || error?.message
                    );

                    updateSettings(null);

                }

            );

            state.unsubscribe.push(
                settingsUnsubscribe
            );

            state.connected = true;

        } catch (error) {

            console.error(
                "[Homepage] Firebase initialization:",
                error
            );

            renderError(
                "The homepage content could not be loaded. Please try again later."
            );

        }

    }


    /* =================================================
       15. CLEANUP
    ================================================= */

    function cleanup() {

        state.unsubscribe.forEach(
            unsubscribe => {

                if (
                    typeof unsubscribe === "function"
                ) {

                    unsubscribe();

                }

            }
        );

        state.unsubscribe = [];

        state.connected = false;

    }


    /* =================================================
       16. INITIALIZATION
    ================================================= */

    function initialize() {

        if (state.initialized) {
            return;
        }

        state.initialized = true;

        if (elements.year) {

            elements.year.textContent =
                new Date().getFullYear();

        }

        /*
         * Shared script.js is referenced by other
         * public pages, but homepage subscriptions
         * must only run on the homepage.
         */

        if (
            document.body.dataset.page !== "home"
        ) {
            return;
        }

        renderLoading();

        connectFirebase();

        window.addEventListener(
            "pagehide",
            cleanup,
            { once: true }
        );

    }


    /* =================================================
       17. START
    ================================================= */

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            { once: true }
        );

    } else {

        initialize();

    }

})();

/* =====================================================
   END OF SCRIPT.JS
===================================================== */
