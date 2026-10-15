
/*
=====================================================
YADAV EXAMPREP
File: js/script.js

SHARED PUBLIC CONTROLLER
INTEGRATION PHASE — FULL FILE REPLACEMENT

Designed and Developed by Yadav Web Technologies

Responsibilities:
1. Update footer copyright year.
2. Render the Firebase-powered homepage.
3. Apply administrator-controlled homepage settings.
4. Render administrator-configured contact information.

Firebase Realtime Database only.

No default educational records.
No public authentication.
No fabricated contact information.
=====================================================
*/

(() => {
    "use strict";

    const PAGE = document.body?.dataset.page || "";

    const DEFAULT_HOMEPAGE_SETTINGS = Object.freeze({
        showFeaturedExams: true,
        showFeaturedSubjects: true,
        showFeaturedTests: true,
        showLearningSection: true,
        homepageExamLimit: 8,
        homepageSubjectLimit: 8,
        homepageTestLimit: 6
    });

    const state = {
        exams: {},
        subjects: {},
        tests: {},
        settings: {
            ...DEFAULT_HOMEPAGE_SETTINGS
        },
        contact: {},
        loaded: {
            exams: false,
            subjects: false,
            tests: false,
            settings: false,
            contact: false
        },
        errors: {},
        unsubscribers: [],
        disposed: false
    };

    const ICONS = Object.freeze({
        exam: `
            <svg xmlns="http://www.w3.org/2000/svg"
                 width="24" height="24"
                 viewBox="0 0 24 24"
                 fill="none" stroke="currentColor"
                 stroke-width="1.7"
                 stroke-linecap="round"
                 stroke-linejoin="round"
                 aria-hidden="true">
                <rect x="4" y="3" width="16" height="18" rx="2"></rect>
                <path d="M8 8h8M8 12h8M8 16h5"></path>
            </svg>
        `,

        subject: `
            <svg xmlns="http://www.w3.org/2000/svg"
                 width="24" height="24"
                 viewBox="0 0 24 24"
                 fill="none" stroke="currentColor"
                 stroke-width="1.7"
                 stroke-linecap="round"
                 stroke-linejoin="round"
                 aria-hidden="true">
                <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z"></path>
                <path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20"></path>
                <path d="M9 7h6"></path>
            </svg>
        `,

        test: `
            <svg xmlns="http://www.w3.org/2000/svg"
                 width="24" height="24"
                 viewBox="0 0 24 24"
                 fill="none" stroke="currentColor"
                 stroke-width="1.7"
                 stroke-linecap="round"
                 stroke-linejoin="round"
                 aria-hidden="true">
                <rect x="5" y="4" width="14" height="17" rx="2"></rect>
                <path d="M9 4.5V3h6v1.5"></path>
                <path d="m9 12 2 2 4-4"></path>
                <path d="M9 17h6"></path>
            </svg>
        `
    });

    /*
    -----------------------------------------------------
    GENERAL HELPERS
    -----------------------------------------------------
    */

    function element(id) {
        return document.getElementById(id);
    }

    function create(tag, className = "", content = "") {
        const node = document.createElement(tag);

        if (className) {
            node.className = className;
        }

        if (content !== "") {
            node.textContent = String(content);
        }

        return node;
    }

    function cleanText(value) {
        return typeof value === "string"
            ? value.trim()
            : "";
    }

    function normalizeCollection(value) {
        if (!value || typeof value !== "object") {
            return {};
        }

        if (Array.isArray(value)) {
            return Object.fromEntries(
                value
                    .map((item, index) => [
                        String(index),
                        item
                    ])
                    .filter(([, item]) =>
                        item &&
                        typeof item === "object" &&
                        !Array.isArray(item)
                    )
            );
        }

        return Object.fromEntries(
            Object.entries(value).filter(
                ([, item]) =>
                    item &&
                    typeof item === "object" &&
                    !Array.isArray(item)
            )
        );
    }

    function publishedEntries(collection) {
        return Object.entries(
            normalizeCollection(collection)
        ).filter(
            ([, record]) => record.published === true
        );
    }

    function compareRecords(a, b) {
        const aOrder = Number(a[1].order);
        const bOrder = Number(b[1].order);

        const first = Number.isFinite(aOrder)
            ? aOrder
            : Number.MAX_SAFE_INTEGER;

        const second = Number.isFinite(bOrder)
            ? bOrder
            : Number.MAX_SAFE_INTEGER;

        if (first !== second) {
            return first - second;
        }

        const aName = cleanText(
            a[1].name || a[1].title
        );

        const bName = cleanText(
            b[1].name || b[1].title
        );

        return aName.localeCompare(bName);
    }

    function getLimit(value, fallback) {
        const parsed = Number(value);

        if (!Number.isInteger(parsed)) {
            return fallback;
        }

        return Math.max(1, Math.min(24, parsed));
    }

    function updateCopyrightYear() {
        const year = element("currentYear");

        if (year) {
            year.textContent = String(
                new Date().getFullYear()
            );
        }
    }

    function refreshAnimations() {
        if (
            window.YadavAnimations &&
            typeof window.YadavAnimations.refresh === "function"
        ) {
            window.YadavAnimations.refresh();
        }
    }

    /*
    -----------------------------------------------------
    STATUS RENDERING
    -----------------------------------------------------
    */

    function renderStatus(
        container,
        title,
        description,
        type = "empty"
    ) {
        if (!container) {
            return;
        }

        container.replaceChildren();

        const wrapper = create(
            "div",
            type === "loading"
                ? "content-placeholder"
                : "empty-state"
        );

        if (type === "loading") {
            const spinner = create(
                "span",
                "ui-spinner"
            );

            spinner.setAttribute(
                "aria-hidden",
                "true"
            );

            wrapper.append(spinner);
        }

        if (title) {
            wrapper.append(
                create("h3", "", title)
            );
        }

        if (description) {
            wrapper.append(
                create("p", "", description)
            );
        }

        container.append(wrapper);

        container.setAttribute(
            "aria-busy",
            type === "loading" ? "true" : "false"
        );
    }

    /*
    -----------------------------------------------------
    HOMEPAGE SETTINGS
    -----------------------------------------------------
    */

    function applyHomepageSettings() {
        if (PAGE !== "home") {
            return;
        }

        const settings = state.settings;

        const sections = [
            {
                id: "homeExamsSection",
                visible: settings.showFeaturedExams !== false
            },
            {
                id: "homeSubjectsSection",
                visible: settings.showFeaturedSubjects !== false
            },
            {
                id: "homeMockTestsSection",
                visible: settings.showFeaturedTests !== false
            },
            {
                id: "homeLearningSection",
                visible: settings.showLearningSection !== false
            }
        ];

        sections.forEach(({ id, visible }) => {
            const section = element(id);

            if (section) {
                section.hidden = !visible;
            }
        });
    }

    /*
    -----------------------------------------------------
    HOMEPAGE CARD BUILDERS
    -----------------------------------------------------
    */

    function createCardIcon(type) {
        const icon = create(
            "span",
            "ui-icon"
        );

        icon.innerHTML = ICONS[type] || ICONS.exam;

        return icon;
    }

    function createExamCard(id, exam) {
        const card = create(
            "article",
            "exam-card"
        );

        const name = cleanText(exam.name);

        const description = cleanText(
            exam.description
        );

        const heading = create(
            "h3",
            "",
            name
        );

        const link = create(
            "a",
            "text-link",
            "Explore Examination"
        );

        link.href =
            `subjects.html?exam=${encodeURIComponent(id)}`;

        card.append(
            createCardIcon("exam"),
            heading
        );

        if (description) {
            card.append(
                create("p", "", description)
            );
        }

        card.append(link);

        return card;
    }

    function createSubjectCard(id, subject) {
        const card = create(
            "article",
            "subject-card"
        );

        const heading = create(
            "h3",
            "",
            cleanText(subject.name)
        );

        const description = cleanText(
            subject.description
        );

        const link = create(
            "a",
            "text-link",
            "Explore Subject"
        );

        link.href =
            `learn.html?subject=${encodeURIComponent(id)}`;

        card.append(
            createCardIcon("subject"),
            heading
        );

        if (description) {
            card.append(
                create("p", "", description)
            );
        }

        card.append(link);

        return card;
    }

    function createTestCard(id, test) {
        const card = create(
            "article",
            "mock-card"
        );

        const heading = create(
            "h3",
            "",
            cleanText(test.title)
        );

        const description = cleanText(
            test.description
        );

        const details = create(
            "div",
            "mock-card-meta"
        );

        const questionCount = Number(
            test.questionCount
        );

        const duration = Number(
            test.duration
        );

        if (
            Number.isFinite(questionCount) &&
            questionCount > 0
        ) {
            details.append(
                create(
                    "span",
                    "",
                    `${questionCount} Questions`
                )
            );
        }

        if (
            Number.isFinite(duration) &&
            duration > 0
        ) {
            details.append(
                create(
                    "span",
                    "",
                    `${duration} Minutes`
                )
            );
        }

        const link = create(
            "a",
            "text-link",
            "Attempt Mock Test"
        );

        link.href =
            `mock-test.html?test=${encodeURIComponent(id)}`;

        card.append(
            createCardIcon("test"),
            heading
        );

        if (description) {
            card.append(
                create("p", "", description)
            );
        }

        if (details.childElementCount) {
            card.append(details);
        }

        card.append(link);

        return card;
    }

    /*
    -----------------------------------------------------
    HOMEPAGE DATA RENDERING
    -----------------------------------------------------
    */

    function renderCollection(
        container,
        entries,
        cardBuilder,
        emptyTitle,
        emptyDescription
    ) {
        if (!container) {
            return;
        }

        container.replaceChildren();

        if (!entries.length) {
            renderStatus(
                container,
                emptyTitle,
                emptyDescription
            );

            return;
        }

        const fragment = document.createDocumentFragment();

        entries.forEach(([id, record]) => {
            fragment.append(
                cardBuilder(id, record)
            );
        });

        container.append(fragment);

        container.setAttribute(
            "aria-busy",
            "false"
        );

        refreshAnimations();
    }

    function renderHomepage() {
        if (PAGE !== "home" || state.disposed) {
            return;
        }

        applyHomepageSettings();

        const examsContainer = element(
            "examCategories"
        );

        const subjectsContainer = element(
            "subjectCategories"
        );

        const testsContainer = element(
            "featuredMockTests"
        );

        /*
            Render each collection independently.

            A failed subscription must not prevent
            unrelated published content from appearing.
        */

        if (state.errors.exams) {
            renderStatus(
                examsContainer,
                "Examinations Unavailable",
                "Unable to retrieve examinations. Please try again later.",
                "error"
            );
        } else if (!state.loaded.exams) {
            renderStatus(
                examsContainer,
                "Loading Examinations",
                "Retrieving published examinations.",
                "loading"
            );
        } else {
            const exams = publishedEntries(
                state.exams
            )
                .filter(
                    ([, exam]) =>
                        Boolean(cleanText(exam.name))
                )
                .sort(compareRecords)
                .slice(
                    0,
                    getLimit(
                        state.settings.homepageExamLimit,
                        8
                    )
                );

            renderCollection(
                examsContainer,
                exams,
                createExamCard,
                "No Examinations Published Yet",
                "Published examinations will appear here when available."
            );
        }

        if (state.errors.subjects) {
            renderStatus(
                subjectsContainer,
                "Subjects Unavailable",
                "Unable to retrieve subjects. Please try again later.",
                "error"
            );
        } else if (
            !state.loaded.subjects ||
            !state.loaded.exams
        ) {
            renderStatus(
                subjectsContainer,
                "Loading Subjects",
                "Retrieving published subjects.",
                "loading"
            );
        } else {
            const publishedExamIds = new Set(
                publishedEntries(state.exams)
                    .map(([id]) => id)
            );

            const subjects = publishedEntries(
                state.subjects
            )
                .filter(
                    ([, subject]) =>
                        Boolean(cleanText(subject.name)) &&
                        publishedExamIds.has(
                            String(subject.examId || "")
                        )
                )
                .sort(compareRecords)
                .slice(
                    0,
                    getLimit(
                        state.settings.homepageSubjectLimit,
                        getLimit(
                            state.settings.homepageExamLimit,
                            8
                        )
                    )
                );

            renderCollection(
                subjectsContainer,
                subjects,
                createSubjectCard,
                "No Subjects Published Yet",
                "Published subjects will appear here when available."
            );
        }

        if (state.errors.tests) {
            renderStatus(
                testsContainer,
                "Mock Tests Unavailable",
                "Unable to retrieve featured mock tests. Please try again later.",
                "error"
            );
        } else if (
            !state.loaded.tests ||
            !state.loaded.exams ||
            !state.loaded.subjects
        ) {
            renderStatus(
                testsContainer,
                "Loading Mock Tests",
                "Retrieving featured published mock tests.",
                "loading"
            );
        } else {
            const publishedExamIds = new Set(
                publishedEntries(state.exams)
                    .map(([id]) => id)
            );

            const publishedSubjectIds = new Set(
                publishedEntries(state.subjects)
                    .filter(
                        ([, subject]) =>
                            publishedExamIds.has(
                                String(subject.examId || "")
                            )
                    )
                    .map(([id]) => id)
            );

            const tests = publishedEntries(
                state.tests
            )
                .filter(([id, test]) => {
                    if (
                        !id ||
                        !cleanText(test.title) ||
                        test.featured !== true
                    ) {
                        return false;
                    }

                    if (
                        !publishedExamIds.has(
                            String(test.examId || "")
                        )
                    ) {
                        return false;
                    }

                    const subjectId = String(
                        test.subjectId || ""
                    );

                    return (
                        !subjectId ||
                        publishedSubjectIds.has(subjectId)
                    );
                })
                .sort(compareRecords)
                .slice(
                    0,
                    getLimit(
                        state.settings.homepageTestLimit,
                        6
                    )
                );

            renderCollection(
                testsContainer,
                tests,
                createTestCard,
                "No Featured Mock Tests Yet",
                "Featured published mock tests will appear here when available."
            );
        }
    }

    /*
    -----------------------------------------------------
    CONTACT PAGE
    -----------------------------------------------------
    */

    function showContactStatus(message, isError = false) {
        const container = element("contactStatus");
        const spinner = element("contactStatusSpinner");
        const text = element("contactStatusText");

        if (container) {
            container.hidden = false;

            container.setAttribute(
                "role",
                isError ? "alert" : "status"
            );
        }

        if (spinner) {
            spinner.hidden = true;
        }

        if (text) {
            text.textContent = message;
        }
    }

    function configureContactCard(id, visible) {
        const card = element(id);

        if (card) {
            card.hidden = !visible;
        }
    }

    function safeEmail(value) {
        const email = cleanText(value);

        if (
            !email ||
            email.length > 254 ||
            /\s/.test(email) ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            return "";
        }

        return email;
    }

    function safePhone(value) {
        const phone = cleanText(value);

        if (
            !phone ||
            !/^\+?[0-9\s().-]{6,25}$/.test(phone)
        ) {
            return "";
        }

        return phone;
    }

    function renderContact() {
        if (PAGE !== "contact" || state.disposed) {
            return;
        }

        const grid = element(
            "contactInformationGrid"
        );

        const empty = element(
            "contactEmptyState"
        );

        if (state.errors.contact) {
            showContactStatus(
                "Contact information is currently unavailable. Please try again later.",
                true
            );

            if (grid) {
                grid.hidden = true;
            }

            if (empty) {
                empty.hidden = true;
            }

            return;
        }

        if (!state.loaded.contact) {
            return;
        }

        const contact = state.contact || {};

        /*
            Only administrator-supplied values
            are displayed. No fallback address,
            email or telephone is invented.
        */

        const email = safeEmail(
            contact.email ||
            contact.contactEmail
        );

        const phone = safePhone(
            contact.phone ||
            contact.contactPhone
        );

        const address = cleanText(
            contact.address ||
            contact.contactAddress
        );

        const emailLink = element(
            "contactEmailLink"
        );

        const phoneLink = element(
            "contactPhoneLink"
        );

        const addressText = element(
            "contactAddressText"
        );

        if (emailLink) {
            if (email) {
                emailLink.textContent = email;

                emailLink.href =
                    `mailto:${email}`;
            } else {
                emailLink.removeAttribute("href");
                emailLink.textContent = "";
            }
        }

        if (phoneLink) {
            if (phone) {
                phoneLink.textContent = phone;

                phoneLink.href =
                    `tel:${phone.replace(/[^+\d]/g, "")}`;
            } else {
                phoneLink.removeAttribute("href");
                phoneLink.textContent = "";
            }
        }

        if (addressText) {
            addressText.textContent = address;

            /*
                Preserve multiline addresses without
                adding inline CSS to the HTML file.
            */

            addressText.style.whiteSpace = "pre-line";
        }

        configureContactCard(
            "contactEmailCard",
            Boolean(email)
        );

        configureContactCard(
            "contactPhoneCard",
            Boolean(phone)
        );

        configureContactCard(
            "contactAddressCard",
            Boolean(address)
        );

        const hasContactInformation = Boolean(
            email || phone || address
        );

        if (grid) {
            grid.hidden = !hasContactInformation;
        }

        if (empty) {
            empty.hidden = hasContactInformation;
        }

        const status = element("contactStatus");

        if (status) {
            status.hidden = true;
        }

        refreshAnimations();
    }

    /*
    -----------------------------------------------------
    FIREBASE SUBSCRIPTIONS
    -----------------------------------------------------
    */

    function setData(key, value) {
        if (
            state.disposed ||
            !Object.prototype.hasOwnProperty.call(
                state.loaded,
                key
            )
        ) {
            return;
        }

        if (key === "settings") {
            state.settings = {
                ...DEFAULT_HOMEPAGE_SETTINGS,
                ...(
                    value &&
                    typeof value === "object"
                        ? value
                        : {}
                )
            };
        } else if (key === "contact") {
            state.contact =
                value &&
                typeof value === "object"
                    ? value
                    : {};
        } else {
            state[key] = normalizeCollection(value);
        }

        state.loaded[key] = true;

        delete state.errors[key];

        if (PAGE === "home") {
            renderHomepage();
        }

        if (PAGE === "contact") {
            renderContact();
        }
    }

    function setLoading(key, loading = true) {
        if (
            !Object.prototype.hasOwnProperty.call(
                state.loaded,
                key
            )
        ) {
            return;
        }

        state.loaded[key] = !loading;

        if (loading) {
            delete state.errors[key];
        }

        if (PAGE === "home") {
            renderHomepage();
        }

        if (PAGE === "contact") {
            renderContact();
        }
    }

    function setError(key, error) {
        if (state.disposed) {
            return;
        }

        state.errors[key] =
            error instanceof Error
                ? error
                : new Error(
                    "Unable to retrieve Firebase data."
                );

        state.loaded[key] = true;

        console.error(
            `[Yadav ExamPrep] ${key}:`,
            state.errors[key]
        );

        if (PAGE === "home") {
            renderHomepage();
        }

        if (PAGE === "contact") {
            renderContact();
        }
    }

    async function connectFirebase() {
        if (
            PAGE !== "home" &&
            PAGE !== "contact"
        ) {
            return;
        }

        try {
            const config = await import(
                "./firebase-config.js"
            );

            if (
                state.disposed ||
                !config.isDatabaseConfigured ||
                !config.database
            ) {
                throw new Error(
                    "Firebase Realtime Database URL is not configured."
                );
            }

            const {
                ref,
                onValue
            } = await import(
                "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js"
            );

            if (state.disposed) {
                return;
            }

            function subscribe(key, path) {
                const unsubscribe = onValue(
                    ref(config.database, path),

                    snapshot => {
                        setData(
                            key,
                            snapshot.val()
                        );
                    },

                    error => {
                        setError(key, error);
                    }
                );

                state.unsubscribers.push(
                    unsubscribe
                );
            }

            if (PAGE === "home") {
                subscribe(
                    "exams",
                    "public/exams"
                );

                subscribe(
                    "subjects",
                    "public/subjects"
                );

                subscribe(
                    "tests",
                    "public/tests"
                );

                subscribe(
                    "settings",
                    "public/settings/homepage"
                );
            }

            if (PAGE === "contact") {
                subscribe(
                    "contact",
                    "public/settings/contact"
                );
            }

        } catch (error) {
            console.error(
                "[Yadav ExamPrep] Firebase connection:",
                error
            );

            if (PAGE === "home") {
                [
                    "exams",
                    "subjects",
                    "tests"
                ].forEach(
                    key => setError(key, error)
                );
            }

            if (PAGE === "contact") {
                setError(
                    "contact",
                    error
                );
            }
        }
    }

    /*
    -----------------------------------------------------
    CLEANUP
    -----------------------------------------------------
    */

    function dispose() {
        if (state.disposed) {
            return;
        }

        state.disposed = true;

        state.unsubscribers.forEach(
            unsubscribe => {
                try {
                    unsubscribe();
                } catch (error) {
                    console.warn(
                        "[Yadav ExamPrep] Subscription cleanup:",
                        error
                    );
                }
            }
        );

        state.unsubscribers.length = 0;
    }

    /*
    -----------------------------------------------------
    PUBLIC CONTROLLER API

    Retained for compatibility with the previous
    integration version.
    -----------------------------------------------------
    */

    window.YadavExamPrep = Object.freeze({
        setData,
        setLoading,

        refresh() {
            if (PAGE === "home") {
                renderHomepage();
            }

            if (PAGE === "contact") {
                renderContact();
            }

            refreshAnimations();
        },

        normalizeCollection,

        getState() {
            return {
                page: PAGE,

                loaded: {
                    ...state.loaded
                },

                settings: {
                    ...state.settings
                },

                hasErrors:
                    Object.keys(state.errors).length > 0
            };
        }
    });

    /*
    -----------------------------------------------------
    INITIALIZATION
    -----------------------------------------------------
    */

    function initialize() {
        updateCopyrightYear();

        if (PAGE === "home") {
            renderHomepage();
        }

        if (PAGE === "contact") {
            const empty = element(
                "contactEmptyState"
            );

            const grid = element(
                "contactInformationGrid"
            );

            if (empty) {
                empty.hidden = true;
            }

            if (grid) {
                grid.hidden = true;
            }
        }

        connectFirebase();
    }

    window.addEventListener(
        "pagehide",
        dispose,
        {
            once: true
        }
    );

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );
    } else {
        initialize();
    }

})();
