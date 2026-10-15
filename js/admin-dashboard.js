
/*
=========================================================
YADAV EXAMPREP
File: js/admin-dashboard.js

Administrator Dashboard Controller

Designed and Developed by Yadav Web Technologies

SECURITY:
The UID check below controls the browser interface.
Firebase Security Rules must independently enforce
administrator-only database write permissions.

No sample educational data is generated.
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
    onValue

} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";


/* =====================================================
   02. CONFIGURATION
===================================================== */

const CONFIG = Object.freeze({

    authorizedUID: "6HwAPbqwYBgg5Ih2zWycOZFBCe93",

    loginURL: "index.html",

    recentLimit: 6,

    selectors: {

        gate: "#adminAuthGate",
        gateSpinner: "#adminGateSpinner",
        gateTitle: "#adminGateTitle",
        gateDescription: "#adminGateDescription",
        gateLoginLink: "#adminGateLoginLink",

        app: "#adminDashboardApp",

        sidebar: "#adminSidebar",
        backdrop: "#adminSidebarBackdrop",
        menuToggle: "#adminMenuToggle",
        sidebarClose: "#adminSidebarClose",
        sidebarNavigation: "#adminSidebarNavigation",

        sidebarLogout: "#adminSidebarLogout",
        topbarLogout: "#adminTopbarLogout",

        userEmail: "#adminUserEmail",
        systemEmail: "#adminSystemEmail",

        authenticationState: "#adminAuthenticationState",
        databaseState: "#adminDatabaseState",

        dashboardStatus: "#adminDashboardStatus",
        dashboardSpinner: "#adminDashboardSpinner",
        dashboardStatusText: "#adminDashboardStatusText",

        totalExams: "#adminTotalExams",
        totalSubjects: "#adminTotalSubjects",
        totalTopics: "#adminTotalTopics",
        totalLessons: "#adminTotalLessons",
        totalQuestions: "#adminTotalQuestions",
        totalMockTests: "#adminTotalMockTests",
        publishedTests: "#adminPublishedTests",
        draftTests: "#adminDraftTests",

        recentContent: "#adminRecentContent",
        currentYear: "#currentYear"

    }

});


/* =====================================================
   03. APPLICATION STATE
===================================================== */

const state = {

    initialized: false,

    authorized: false,

    signingOut: false,

    unsubscribeDatabase: null,

    currentUser: null

};


const elements = {};


/* =====================================================
   04. DOM UTILITIES
===================================================== */

function setText(element, value) {

    if (!element) {
        return;
    }

    element.textContent = String(value);

}


function createElement(tag, className, text) {

    const element = document.createElement(tag);

    if (className) {

        element.className = className;

    }

    if (text !== undefined) {

        element.textContent = String(text);

    }

    return element;

}


/* =====================================================
   05. NORMALIZE FIREBASE COLLECTIONS
===================================================== */

function normalizeCollection(value) {

    if (!value || typeof value !== "object") {

        return [];

    }

    return Object.entries(value)

        .filter(([, record]) => {

            return record &&
                typeof record === "object" &&
                !Array.isArray(record);

        })

        .map(([id, record]) => ({

            ...record,

            id: String(id)

        }));

}


/* =====================================================
   06. DATABASE RECORD HELPERS
===================================================== */

function getCollection(data, name) {

    return normalizeCollection(
        data?.[name]
    );

}


function countNestedQuestions(testQuestions) {

    if (
        !testQuestions ||
        typeof testQuestions !== "object"
    ) {

        return 0;

    }

    return Object.values(testQuestions)

        .reduce((total, collection) => {

            return total +
                normalizeCollection(collection).length;

        }, 0);

}


function formatNumber(value) {

    return new Intl.NumberFormat("en-IN").format(value);

}


/* =====================================================
   07. AUTHORIZATION
===================================================== */

function isAuthorized(user) {

    return Boolean(

        user &&

        typeof user.uid === "string" &&

        user.uid === CONFIG.authorizedUID

    );

}


/* =====================================================
   08. AUTHENTICATION GATE
===================================================== */

function showGate(

    title,

    description,

    showLoginLink = false

) {

    elements.app.hidden = true;

    elements.gate.hidden = false;

    setText(
        elements.gateTitle,
        title
    );

    setText(
        elements.gateDescription,
        description
    );

    elements.gateLoginLink.hidden = !showLoginLink;

    elements.gateSpinner.hidden = showLoginLink;

}


function showDashboard() {

    elements.gate.hidden = true;

    elements.app.hidden = false;

}


/* =====================================================
   09. DASHBOARD STATUS
===================================================== */

function showDashboardStatus(

    message,

    type = "loading"

) {

    elements.dashboardStatus.hidden = false;

    elements.dashboardStatus.classList.remove(

        "is-success",
        "is-error",
        "is-warning"

    );

    if (type !== "loading") {

        elements.dashboardStatus.classList.add(
            `is-${type}`
        );

    }

    elements.dashboardSpinner.hidden =
        type !== "loading";

    setText(

        elements.dashboardStatusText,

        message

    );

}


/* =====================================================
   10. STATISTICS
===================================================== */

function renderStatistics(data) {

    const exams = getCollection(data, "exams");

    const subjects = getCollection(data, "subjects");

    const topics = getCollection(data, "topics");

    const lessons = getCollection(data, "lessons");

    const questions = getCollection(data, "questions");

    const tests = getCollection(data, "tests");

    const nestedQuestionCount = countNestedQuestions(
        data?.testQuestions
    );

    const publishedTests = tests.filter(
        test => test.published === true
    );

    const statistics = {

        totalExams: exams.length,

        totalSubjects: subjects.length,

        totalTopics: topics.length,

        totalLessons: lessons.length,

        totalQuestions:
            questions.length + nestedQuestionCount,

        totalMockTests: tests.length,

        publishedTests: publishedTests.length

    };

    Object.entries(statistics).forEach(

        ([key, value]) => {

            setText(

                elements[key],

                formatNumber(value)

            );

        }

    );

    /*
     * The public database is not an authoritative
     * source for private administrative drafts.
     *
     * Keep the draft statistic unavailable until
     * the protected admin data structure exists.
     */

    setText(
        elements.draftTests,
        "—"
    );

}


/* =====================================================
   11. RECENT CONTENT HELPERS
===================================================== */

function getTimestamp(record) {

    const value =

        record.updatedAt ??
        record.createdAt ??
        null;

    if (typeof value === "number") {

        return Number.isFinite(value)
            ? value
            : null;

    }

    if (typeof value === "string" && value.trim()) {

        const parsed = Date.parse(value);

        return Number.isFinite(parsed)
            ? parsed
            : null;

    }

    return null;

}


function formatDate(timestamp) {

    if (timestamp === null) {

        return "Date unavailable";

    }

    /*
     * Supports Unix seconds and milliseconds.
     */

    const milliseconds = timestamp < 100000000000
        ? timestamp * 1000
        : timestamp;

    const date = new Date(milliseconds);

    if (Number.isNaN(date.getTime())) {

        return "Date unavailable";

    }

    return new Intl.DateTimeFormat("en-IN", {

        day: "2-digit",
        month: "short",
        year: "numeric"

    }).format(date);

}


/* =====================================================
   12. RECENT CONTENT RENDERING
===================================================== */

function renderRecentContent(data) {

    const collections = [

        ["exams", "Exam", "name"],

        ["subjects", "Subject", "name"],

        ["topics", "Topic", "name"],

        ["lessons", "Lesson", "title"],

        ["questions", "Question", "question"],

        ["tests", "Mock Test", "title"]

    ];

    const recent = [];

    collections.forEach(

        ([collectionName, type, titleField]) => {

            const records = getCollection(
                data,
                collectionName
            );

            records.forEach(record => {

                const timestamp = getTimestamp(record);

                if (timestamp === null) {
                    return;
                }

                recent.push({

                    id: record.id,

                    type,

                    title:
                        typeof record[titleField] === "string"
                            ? record[titleField].trim()
                            : "",

                    timestamp,

                    published: record.published === true

                });

            });

        }

    );

    recent.sort(

        (first, second) =>

            second.timestamp - first.timestamp

    );

    const latest = recent.slice(
        0,
        CONFIG.recentLimit
    );

    const container = elements.recentContent;

    container.replaceChildren();

    if (latest.length === 0) {

        const empty = createElement(

            "div",

            "admin-empty-state"

        );

        const title = createElement(

            "h3",

            "",

            "No recent activity available"

        );

        const description = createElement(

            "p",

            "",

            "Content with an update or creation timestamp will appear here after it is added through the administration panel."

        );

        empty.append(
            title,
            description
        );

        container.append(empty);

        return;

    }

    const tableContainer = createElement(

        "div",

        "admin-table-container"

    );

    const table = createElement(

        "table",

        "admin-table"

    );

    const thead = document.createElement("thead");

    const headingRow = document.createElement("tr");

    [

        "Content",
        "Type",
        "Status",
        "Updated"

    ].forEach(label => {

        const heading = createElement(

            "th",

            "",

            label

        );

        heading.scope = "col";

        headingRow.append(heading);

    });

    thead.append(headingRow);

    const tbody = document.createElement("tbody");

    latest.forEach(item => {

        const row = document.createElement("tr");

        const titleCell = createElement(

            "td",

            "admin-table-title",

            item.title || "Untitled record"

        );

        const typeCell = createElement(

            "td",

            "",

            item.type

        );

        const statusCell = document.createElement("td");

        const badge = createElement(

            "span",

            item.published
                ? "admin-status-badge is-published"
                : "admin-status-badge is-draft",

            item.published
                ? "Published"
                : "Not published"

        );

        statusCell.append(badge);

        const dateCell = createElement(

            "td",

            "",

            formatDate(item.timestamp)

        );

        row.append(

            titleCell,
            typeCell,
            statusCell,
            dateCell

        );

        tbody.append(row);

    });

    table.append(
        thead,
        tbody
    );

    tableContainer.append(table);

    container.append(tableContainer);

}


/* =====================================================
   13. LIVE DATABASE SUBSCRIPTION
===================================================== */

function stopDatabaseSubscription() {

    if (
        typeof state.unsubscribeDatabase === "function"
    ) {

        state.unsubscribeDatabase();

        state.unsubscribeDatabase = null;

    }

}


function subscribeToDashboardData() {

    stopDatabaseSubscription();

    if (!isDatabaseConfigured() || !database) {

        setText(

            elements.databaseState,

            "Not configured"

        );

        showDashboardStatus(

            "Firebase Realtime Database URL is missing. Add your actual databaseURL to js/firebase-config.js.",

            "warning"

        );

        elements.recentContent.replaceChildren(

            createElement(

                "div",

                "admin-empty-state",

                "Database configuration is required to load dashboard activity."

            )

        );

        return;

    }

    setText(

        elements.databaseState,

        "Connecting..."

    );

    showDashboardStatus(

        "Loading live Firebase content...",

        "loading"

    );

    const publicReference = ref(
        database,
        "public"
    );

    state.unsubscribeDatabase = onValue(

        publicReference,

        snapshot => {

            if (!state.authorized) {
                return;
            }

            const data = snapshot.val() || {};

            renderStatistics(data);

            renderRecentContent(data);

            setText(

                elements.databaseState,

                "Connected"

            );

            showDashboardStatus(

                "Dashboard information is up to date. Statistics currently reflect records in the public database structure; private draft statistics will be integrated separately.",

                "success"

            );

        },

        error => {

            if (!state.authorized) {
                return;
            }

            console.error(

                "[Yadav ExamPrep] Dashboard database error:",

                error?.code || "unknown"

            );

            setText(

                elements.databaseState,

                "Connection error"

            );

            showDashboardStatus(

                "Unable to read dashboard content. Check your Firebase database URL, connection, and Security Rules.",

                "error"

            );

            elements.recentContent.replaceChildren(

                createElement(

                    "div",

                    "admin-empty-state",

                    "Recent activity could not be loaded."

                )

            );

        }

    );

}


/* =====================================================
   14. MOBILE SIDEBAR
===================================================== */

function setSidebarOpen(open) {

    elements.sidebar.classList.toggle(

        "is-open",

        open

    );

    elements.backdrop.hidden = !open;

    elements.menuToggle.setAttribute(

        "aria-expanded",

        String(open)

    );

    elements.menuToggle.setAttribute(

        "aria-label",

        open
            ? "Close administrator navigation"
            : "Open administrator navigation"

    );

    if (open) {

        elements.sidebarClose.focus();

    } else {

        elements.menuToggle.focus();

    }

}


function registerSidebarEvents() {

    elements.menuToggle.addEventListener(

        "click",

        () => {

            const isOpen = elements.sidebar.classList.contains(
                "is-open"
            );

            setSidebarOpen(!isOpen);

        }

    );

    elements.sidebarClose.addEventListener(

        "click",

        () => setSidebarOpen(false)

    );

    elements.backdrop.addEventListener(

        "click",

        () => setSidebarOpen(false)

    );

    elements.sidebarNavigation.addEventListener(

        "click",

        event => {

            if (
                event.target.closest(".admin-nav-link") &&
                elements.sidebar.classList.contains("is-open")
            ) {

                setSidebarOpen(false);

            }

        }

    );

    document.addEventListener(

        "keydown",

        event => {

            if (
                event.key === "Escape" &&
                elements.sidebar.classList.contains("is-open")
            ) {

                setSidebarOpen(false);

            }

        }

    );

    const desktopQuery = window.matchMedia(
        "(min-width: 901px)"
    );

    desktopQuery.addEventListener(

        "change",

        event => {

            if (event.matches) {

                elements.sidebar.classList.remove(
                    "is-open"
                );

                elements.backdrop.hidden = true;

                elements.menuToggle.setAttribute(
                    "aria-expanded",
                    "false"
                );

            }

        }

    );

}


/* =====================================================
   15. ADMINISTRATOR LOGOUT
===================================================== */

async function handleLogout() {

    if (state.signingOut) {
        return;
    }

    state.signingOut = true;

    elements.sidebarLogout.disabled = true;

    elements.topbarLogout.disabled = true;

    try {

        stopDatabaseSubscription();

        await signOut(auth);

        window.location.replace(
            CONFIG.loginURL
        );

    } catch (error) {

        console.error(

            "[Yadav ExamPrep] Logout error:",

            error?.code || "unknown"

        );

        state.signingOut = false;

        elements.sidebarLogout.disabled = false;

        elements.topbarLogout.disabled = false;

        showDashboardStatus(

            "Unable to complete sign out. Please try again.",

            "error"

        );

    }

}


function registerLogoutEvents() {

    elements.sidebarLogout.addEventListener(

        "click",

        handleLogout

    );

    elements.topbarLogout.addEventListener(

        "click",

        handleLogout

    );

}


/* =====================================================
   16. AUTHENTICATION SESSION OBSERVER
===================================================== */

function observeAdministratorSession() {

    onAuthStateChanged(

        auth,

        async user => {

            if (!user) {

                state.authorized = false;

                state.currentUser = null;

                stopDatabaseSubscription();

                if (state.signingOut) {
                    return;
                }

                showGate(

                    "Administrator Sign In Required",

                    "You must sign in with your authorized administrator account to access this dashboard.",

                    true

                );

                return;

            }

            if (!isAuthorized(user)) {

                state.authorized = false;

                state.currentUser = null;

                stopDatabaseSubscription();

                showGate(

                    "Access Denied",

                    "This Firebase account does not have permission to access the administrator dashboard.",

                    true

                );

                try {

                    await signOut(auth);

                } catch (error) {

                    console.error(

                        "[Yadav ExamPrep] Unauthorized account sign-out error:",

                        error?.code || "unknown"

                    );

                }

                return;

            }

            /*
             * The browser UI is unlocked only after
             * the current Firebase UID is verified.
             */

            state.authorized = true;

            state.currentUser = user;

            setText(

                elements.userEmail,

                user.email || "Administrator"

            );

            setText(

                elements.systemEmail,

                user.email || "Email unavailable"

            );

            setText(

                elements.authenticationState,

                "Authenticated"

            );

            showDashboard();

            subscribeToDashboardData();

        },

        error => {

            state.authorized = false;

            state.currentUser = null;

            stopDatabaseSubscription();

            console.error(

                "[Yadav ExamPrep] Authentication observer error:",

                error?.code || "unknown"

            );

            showGate(

                "Session Verification Failed",

                "Unable to verify your administrator session. Return to the login page and try again.",

                true

            );

        }

    );

}


/* =====================================================
   17. CURRENT YEAR
===================================================== */

function updateCurrentYear() {

    setText(

        elements.currentYear,

        new Date().getFullYear()

    );

}


/* =====================================================
   18. INITIALIZE DASHBOARD
===================================================== */

function initializeDashboard() {

    if (

        document.body.dataset.page !== "admin-dashboard" ||

        state.initialized

    ) {

        return;

    }

    Object.entries(CONFIG.selectors).forEach(

        ([key, selector]) => {

            elements[key] = document.querySelector(
                selector
            );

        }

    );

    const required = Object.keys(
        CONFIG.selectors
    ).filter(key => !elements[key]);

    if (required.length > 0) {

        console.error(

            "[Yadav ExamPrep] Missing dashboard elements:",

            required

        );

        return;

    }

    state.initialized = true;

    updateCurrentYear();

    registerSidebarEvents();

    registerLogoutEvents();

    showGate(

        "Verifying Administrator Access",

        "Please wait while your administrator session is being verified."

    );

    observeAdministratorSession();

}


/* =====================================================
   19. APPLICATION START
===================================================== */

if (document.readyState === "loading") {

    document.addEventListener(

        "DOMContentLoaded",

        initializeDashboard,

        { once: true }

    );

} else {

    initializeDashboard();

}


/* =====================================================
   END OF ADMIN-DASHBOARD.JS
===================================================== */
