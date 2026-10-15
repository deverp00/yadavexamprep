
/*
=========================================================
YADAV EXAMPREP
File: js/script.js

Main Public Website Controller

Designed and Developed by Yadav Web Technologies
=========================================================
*/

"use strict";

(() => {

    /* =================================================
       01. CONFIGURATION
    ================================================= */

    const CONFIG = Object.freeze({

        siteName: "Yadav ExamPrep",

        selectors: {
            examCategories: "#examCategories",
            subjectCategories: "#subjectCategories",
            featuredTests: "#featuredMockTests",
            currentYear: "#currentYear"
        },

        limits: {
            exams: 8,
            subjects: 8,
            featuredTests: 6
        },

        pages: {
            tests: "mock-tests.html",
            subjects: "subjects.html",
            mockTest: "mock-test.html",
            learn: "learn.html"
        }

    });


    /* =================================================
       02. APPLICATION STATE
    ================================================= */

    const state = {

        exams: [],
        subjects: [],
        tests: [],

        loading: false,

        initialized: false

    };


    /* =================================================
       03. BASIC HELPERS
    ================================================= */

    function getElement(selector) {

        return document.querySelector(selector);

    }


    function createElement(tag, className = "", text = null) {

        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== null && text !== undefined) {
            element.textContent = String(text);
        }

        return element;

    }


    function cleanText(value, fallback = "") {

        if (typeof value !== "string") {
            return fallback;
        }

        const cleaned = value.trim();

        return cleaned || fallback;

    }


    function cleanId(value) {

        if (
            typeof value !== "string" &&
            typeof value !== "number"
        ) {
            return "";
        }

        const id = String(value).trim();

        /*
         * Keep IDs limited to URL-safe characters.
         * Firebase push keys are compatible with this.
         */

        return /^[a-zA-Z0-9_-]+$/.test(id)
            ? id
            : "";

    }


    function cleanCount(value) {

        const number = Number(value);

        if (!Number.isFinite(number) || number < 0) {
            return 0;
        }

        return Math.floor(number);

    }


    function cleanDuration(value) {

        const minutes = Number(value);

        if (!Number.isFinite(minutes) || minutes <= 0) {
            return 0;
        }

        return Math.floor(minutes);

    }


    function createPageURL(page, parameter, value) {

        const id = cleanId(value);

        if (!id) {
            return page;
        }

        const params = new URLSearchParams();

        params.set(parameter, id);

        return `${page}?${params.toString()}`;

    }


    /* =================================================
       04. SAFE LINK HELPERS
    ================================================= */

    function createLink({

        text,
        href,
        className = "",
        ariaLabel = ""

    }) {

        const link = createElement(
            "a",
            className,
            text
        );

        /*
         * All destinations are constructed internally.
         * Database content cannot supply arbitrary URLs.
         */

        link.href = href;

        if (ariaLabel) {

            link.setAttribute(
                "aria-label",
                ariaLabel
            );

        }

        return link;

    }


    /* =================================================
       05. ICON CREATION
    ================================================= */

    /*
     * SVG icons inherit currentColor.
     * No icon library or external image is required.
     */

    const SVG_NAMESPACE =
        "http://www.w3.org/2000/svg";


    function createSVGIcon(type = "book") {

        const paths = {

            book: [
                "M4 19.5A2.5 2.5 0 0 1 6.5 17H20",
                "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"
            ],

            exam: [
                "M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8",
                "M16 3h5v5",
                "m10 14 11-11",
                "M8 12h3",
                "M8 16h7"
            ],

            arrow: [
                "M5 12h14",
                "m12 5 7 7-7 7"
            ],

            clock: [
                "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z",
                "M12 6v6l4 2"
            ]

        };

        const svg = document.createElementNS(
            SVG_NAMESPACE,
            "svg"
        );

        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("width", "20");
        svg.setAttribute("height", "20");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "1.8");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");

        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");

        const selectedPaths = paths[type] || paths.book;

        selectedPaths.forEach((pathData) => {

            const path = document.createElementNS(
                SVG_NAMESPACE,
                "path"
            );

            path.setAttribute("d", pathData);

            svg.appendChild(path);

        });

        return svg;

    }


    function createIconContainer(type) {

        const container = createElement(
            "span",
            "ui-icon"
        );

        container.appendChild(
            createSVGIcon(type)
        );

        return container;

    }


    /* =================================================
       06. LOADING STATE
    ================================================= */

    function showLoading(container, message) {

        if (!container) {
            return;
        }

        container.replaceChildren();

        const wrapper = createElement(
            "div",
            "loading-container"
        );

        wrapper.setAttribute("role", "status");

        const spinner = createElement(
            "span",
            "ui-spinner"
        );

        spinner.setAttribute(
            "aria-hidden",
            "true"
        );

        const label = createElement(
            "span",
            "loading-text",
            message
        );

        wrapper.append(spinner, label);

        container.appendChild(wrapper);

    }


    /* =================================================
       07. EMPTY STATE
    ================================================= */

    function showEmptyState(

        container,
        title,
        description

    ) {

        if (!container) {
            return;
        }

        container.replaceChildren();

        const wrapper = createElement(
            "div",
            "empty-state"
        );

        const icon = createIconContainer("book");

        const heading = createElement(
            "h3",
            "",
            title
        );

        const paragraph = createElement(
            "p",
            "",
            description
        );

        wrapper.append(
            icon,
            heading,
            paragraph
        );

        container.appendChild(wrapper);

    }


    /* =================================================
       08. ERROR STATE
    ================================================= */

    function showError(container, message) {

        if (!container) {
            return;
        }

        container.replaceChildren();

        const alert = createElement(
            "div",
            "ui-alert alert-error"
        );

        alert.setAttribute("role", "alert");

        const paragraph = createElement(
            "span",
            "",
            message
        );

        alert.appendChild(paragraph);

        container.appendChild(alert);

    }


    /* =================================================
       09. EXAMINATION CARD
    ================================================= */

    function createExamCard(exam) {

        const id = cleanId(exam.id);

        const name = cleanText(
            exam.name,
            "Untitled examination"
        );

        const description = cleanText(
            exam.description,
            "Explore available preparation resources."
        );

        const subjectCount = cleanCount(
            exam.subjectCount
        );

        const testCount = cleanCount(
            exam.testCount
        );

        const card = createElement(
            "article",
            "exam-card reveal"
        );

        const top = createElement(
            "div",
            "exam-card-top"
        );

        top.appendChild(
            createIconContainer("exam")
        );

        const title = createElement(
            "h3",
            "",
            name
        );

        const summary = createElement(
            "p",
            "",
            description
        );

        const metadata = createElement(
            "div",
            "exam-card-meta"
        );

        metadata.append(

            createElement(
                "span",
                "",
                `${subjectCount} subjects`
            ),

            createElement(
                "span",
                "",
                `${testCount} mock tests`
            )

        );

        const footer = createElement(
            "div",
            "exam-card-footer"
        );

        const link = createLink({

            text: "Explore examination",

            href: createPageURL(
                CONFIG.pages.tests,
                "exam",
                id
            ),

            ariaLabel: `Explore ${name}`

        });

        link.appendChild(
            createSVGIcon("arrow")
        );

        footer.appendChild(link);

        card.append(
            top,
            title,
            summary,
            metadata,
            footer
        );

        return card;

    }


    /* =================================================
       10. SUBJECT CARD
    ================================================= */

    function createSubjectCard(subject) {

        const id = cleanId(subject.id);

        const name = cleanText(
            subject.name,
            "Untitled subject"
        );

        const topicCount = cleanCount(
            subject.topicCount
        );

        const card = createElement(
            "a",
            "subject-card reveal"
        );

        card.href = createPageURL(
            CONFIG.pages.learn,
            "subject",
            id
        );

        card.setAttribute(
            "aria-label",
            `Explore ${name}`
        );

        const icon = createIconContainer("book");

        const content = createElement(
            "div",
            "subject-card-content"
        );

        content.append(

            createElement(
                "h3",
                "",
                name
            ),

            createElement(
                "p",
                "",
                `${topicCount} topics`
            )

        );

        const arrow = createElement(
            "span",
            "subject-card-arrow"
        );

        arrow.appendChild(
            createSVGIcon("arrow")
        );

        card.append(
            icon,
            content,
            arrow
        );

        return card;

    }


    /* =================================================
       11. MOCK TEST DETAIL
    ================================================= */

    function createMockDetail(label, value) {

        const wrapper = createElement(
            "div",
            "mock-detail"
        );

        wrapper.append(

            createElement(
                "span",
                "mock-detail-label",
                label
            ),

            createElement(
                "strong",
                "mock-detail-value",
                value
            )

        );

        return wrapper;

    }


    /* =================================================
       12. MOCK TEST CARD
    ================================================= */

    function createMockCard(test) {

        const id = cleanId(test.id);

        const titleText = cleanText(
            test.title,
            "Untitled mock test"
        );

        const description = cleanText(
            test.description,
            "Practice your knowledge with this mock test."
        );

        const questionCount = cleanCount(
            test.questionCount
        );

        const duration = cleanDuration(
            test.duration
        );

        const card = createElement(
            "article",
            "mock-card reveal"
        );

        const header = createElement(
            "div",
            "mock-card-header"
        );

        header.appendChild(
            createIconContainer("exam")
        );

        const badge = createElement(
            "span",
            "ui-badge",
            "Free test"
        );

        header.appendChild(badge);

        const title = createElement(
            "h3",
            "",
            titleText
        );

        const summary = createElement(
            "p",
            "mock-card-description",
            description
        );

        const details = createElement(
            "div",
            "mock-card-details"
        );

        details.append(

            createMockDetail(
                "Questions",
                String(questionCount)
            ),

            createMockDetail(
                "Duration",
                duration > 0
                    ? `${duration} minutes`
                    : "Untimed"
            )

        );

        const footer = createElement(
            "div",
            "mock-card-footer"
        );

        const startLink = createLink({

            text: "Start mock test",

            href: createPageURL(
                CONFIG.pages.mockTest,
                "test",
                id
            ),

            className: "btn btn-primary",

            ariaLabel: `Start ${titleText}`

        });

        startLink.appendChild(
            createSVGIcon("arrow")
        );

        footer.appendChild(startLink);

        card.append(
            header,
            title,
            summary,
            details,
            footer
        );

        return card;

    }


    /* =================================================
       13. UNIVERSAL COLLECTION RENDERER
    ================================================= */

    function renderCollection({

        selector,
        items,
        limit,
        createCard,
        emptyTitle,
        emptyDescription

    }) {

        const container = getElement(selector);

        if (!container) {
            return;
        }

        if (!Array.isArray(items) || items.length === 0) {

            showEmptyState(
                container,
                emptyTitle,
                emptyDescription
            );

            return;

        }

        const validItems = items.filter((item) => {

            return (
                item &&
                typeof item === "object" &&
                !Array.isArray(item) &&
                cleanId(item.id)
            );

        });

        if (validItems.length === 0) {

            showEmptyState(
                container,
                emptyTitle,
                emptyDescription
            );

            return;

        }

        const fragment = document.createDocumentFragment();

        validItems.slice(0, limit).forEach((item) => {

            fragment.appendChild(
                createCard(item)
            );

        });

        container.replaceChildren(fragment);

        /*
         * Register newly generated cards with
         * our Intersection Observer controller.
         */

        if (
            window.YadavAnimations &&
            typeof window.YadavAnimations.refresh === "function"
        ) {

            window.YadavAnimations.refresh(container);

        }

    }


    /* =================================================
       14. RENDER EXAMINATIONS
    ================================================= */

    function renderExams() {

        renderCollection({

            selector: CONFIG.selectors.examCategories,

            items: state.exams,

            limit: CONFIG.limits.exams,

            createCard: createExamCard,

            emptyTitle: "No examinations available",

            emptyDescription:
                "Examination categories will appear here once they are published."

        });

    }


    /* =================================================
       15. RENDER SUBJECTS
    ================================================= */

    function renderSubjects() {

        renderCollection({

            selector: CONFIG.selectors.subjectCategories,

            items: state.subjects,

            limit: CONFIG.limits.subjects,

            createCard: createSubjectCard,

            emptyTitle: "No subjects available",

            emptyDescription:
                "Published subjects and learning resources will appear here."

        });

    }


    /* =================================================
       16. RENDER FEATURED TESTS
    ================================================= */

    function renderFeaturedTests() {

        const featured = state.tests.filter((test) => {

            return (
                test &&
                typeof test === "object" &&
                test.featured === true &&
                test.published !== false
            );

        });

        renderCollection({

            selector: CONFIG.selectors.featuredTests,

            items: featured,

            limit: CONFIG.limits.featuredTests,

            createCard: createMockCard,

            emptyTitle: "No featured tests yet",

            emptyDescription:
                "Featured mock tests will appear here when published by the administrator."

        });

    }


    /* =================================================
       17. RENDER ALL HOMEPAGE COLLECTIONS
    ================================================= */

    function renderHomepage() {

        if (
            document.body.dataset.page !== "home"
        ) {
            return;
        }

        try {

            renderExams();

            renderSubjects();

            renderFeaturedTests();

        } catch (error) {

            console.error(
                "[Yadav ExamPrep] Homepage rendering failed:",
                error
            );

            [
                CONFIG.selectors.examCategories,
                CONFIG.selectors.subjectCategories,
                CONFIG.selectors.featuredTests
            ].forEach((selector) => {

                showError(

                    getElement(selector),

                    "This section could not be displayed. Please refresh the page."

                );

            });

        }

    }


    /* =================================================
       18. DATA NORMALIZATION
    ================================================= */

    /*
     * Firebase Realtime Database commonly returns
     * collections as keyed objects.
     *
     * This helper supports both arrays and objects.
     */

    function normalizeCollection(collection) {

        if (Array.isArray(collection)) {

            return collection.filter((item) => {

                return (
                    item &&
                    typeof item === "object" &&
                    !Array.isArray(item)
                );

            });

        }

        if (
            !collection ||
            typeof collection !== "object"
        ) {
            return [];
        }

        return Object.entries(collection).map(

            ([id, value]) => {

                if (
                    !value ||
                    typeof value !== "object" ||
                    Array.isArray(value)
                ) {
                    return null;
                }

                /*
                 * Database record keys are treated as
                 * the canonical IDs.
                 */

                return {
                    ...value,
                    id
                };

            }

        ).filter(Boolean);

    }


    /* =================================================
       19. PUBLIC DATA UPDATE METHOD
    ================================================= */

    /*
     * Future Firebase integration can call:
     *
     * window.YadavExamPrep.setData({
     *     exams: databaseExams,
     *     subjects: databaseSubjects,
     *     tests: databaseTests
     * });
     *
     * Omitted properties preserve existing data.
     */

    function setData(data = {}) {

        if (
            !data ||
            typeof data !== "object" ||
            Array.isArray(data)
        ) {
            return;
        }

        if (
            Object.prototype.hasOwnProperty.call(
                data,
                "exams"
            )
        ) {

            state.exams = normalizeCollection(
                data.exams
            );

        }

        if (
            Object.prototype.hasOwnProperty.call(
                data,
                "subjects"
            )
        ) {

            state.subjects = normalizeCollection(
                data.subjects
            );

        }

        if (
            Object.prototype.hasOwnProperty.call(
                data,
                "tests"
            )
        ) {

            state.tests = normalizeCollection(
                data.tests
            );

        }

        if (state.initialized) {
            renderHomepage();
        }

    }


    /* =================================================
       20. LOADING CONTROL
    ================================================= */

    function setLoading(isLoading) {

        state.loading = Boolean(isLoading);

        if (
            document.body.dataset.page !== "home"
        ) {
            return;
        }

        if (state.loading) {

            showLoading(

                getElement(
                    CONFIG.selectors.examCategories
                ),

                "Loading examinations..."

            );

            showLoading(

                getElement(
                    CONFIG.selectors.subjectCategories
                ),

                "Loading subjects..."

            );

            showLoading(

                getElement(
                    CONFIG.selectors.featuredTests
                ),

                "Loading mock tests..."

            );

        } else {

            renderHomepage();

        }

    }


    /* =================================================
       21. CURRENT YEAR
    ================================================= */

    function updateCurrentYear() {

        const yearElement = getElement(
            CONFIG.selectors.currentYear
        );

        if (!yearElement) {
            return;
        }

        yearElement.textContent =
            String(new Date().getFullYear());

    }


    /* =================================================
       22. INITIALIZE PUBLIC WEBSITE
    ================================================= */

    function initializeWebsite() {

        if (state.initialized) {
            return;
        }

        state.initialized = true;

        updateCurrentYear();

        if (!state.loading) {

            renderHomepage();

        }

    }


    /* =================================================
       23. PUBLIC APPLICATION API
    ================================================= */

    /*
     * This API allows later Firebase modules
     * to update the website without rewriting
     * the main homepage controller.
     */

    window.YadavExamPrep = Object.freeze({

        setData,

        setLoading,

        refresh: renderHomepage,

        normalizeCollection,

        getState: () => ({

            exams: state.exams.map(item => ({ ...item })),

            subjects: state.subjects.map(item => ({ ...item })),

            tests: state.tests.map(item => ({ ...item })),

            loading: state.loading

        })

    });


    /* =================================================
       24. SAFE DOM INITIALIZATION
    ================================================= */

    if (document.readyState === "loading") {

        document.addEventListener(

            "DOMContentLoaded",

            initializeWebsite,

            { once: true }

        );

    } else {

        initializeWebsite();

    }

})();
