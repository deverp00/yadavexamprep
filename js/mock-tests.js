
/*
=========================================================
YADAV EXAMPREP
File: js/mock-tests.js

Public Mock Test Directory Controller

Designed and Developed by Yadav Web Technologies
=========================================================
*/

"use strict";

import {
    isDatabaseConfigured,
    subscribeToPublicContent
} from "./firebase-config.js";


/* =====================================================
   01. CONFIGURATION
===================================================== */

const CONFIG = Object.freeze({

    pageSize: 9,

    selectors: {
        grid: "#allMockTests",
        search: "#mockSearch",
        exam: "#examFilter",
        subject: "#subjectFilter",
        sort: "#sortFilter",
        form: "#mockFilterForm",
        pagination: "#mockPagination",
        resultCount: "#mockResultCount"
    }

});


/* =====================================================
   02. APPLICATION STATE
===================================================== */

const state = {

    exams: [],
    subjects: [],
    tests: [],

    search: "",
    exam: "",
    subject: "",
    sort: "newest",

    page: 1,

    loading: true,

    initialized: false,

    received: {
        exams: false,
        subjects: false,
        tests: false
    },

    unsubscribe: null

};


/* =====================================================
   03. DOM REFERENCES
===================================================== */

const elements = {};


/* =====================================================
   04. HELPERS
===================================================== */

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

    return value.trim() || fallback;

}


function cleanId(value) {

    if (
        typeof value !== "string" &&
        typeof value !== "number"
    ) {
        return "";
    }

    const id = String(value).trim();

    return /^[a-zA-Z0-9_-]+$/.test(id)
        ? id
        : "";

}


function cleanNumber(value) {

    const number = Number(value);

    return Number.isFinite(number) && number >= 0
        ? Math.floor(number)
        : 0;

}


/* =====================================================
   05. NORMALIZE FIREBASE COLLECTIONS
===================================================== */

function normalizeCollection(collection) {

    if (!collection) {
        return [];
    }

    if (Array.isArray(collection)) {

        return collection.filter(item => (
            item &&
            typeof item === "object" &&
            !Array.isArray(item)
        ));

    }

    if (typeof collection !== "object") {
        return [];
    }

    return Object.entries(collection)

        .map(([id, value]) => {

            if (
                !value ||
                typeof value !== "object" ||
                Array.isArray(value)
            ) {
                return null;
            }

            return {
                ...value,
                id
            };

        })

        .filter(Boolean);

}


/* =====================================================
   06. PUBLICATION FILTER
===================================================== */

function isPublished(item) {

    return (
        item &&
        typeof item === "object" &&
        item.published === true &&
        Boolean(cleanId(item.id))
    );

}


/* =====================================================
   07. URL PARAMETER HANDLING
===================================================== */

function readURLFilters() {

    const params = new URLSearchParams(
        window.location.search
    );

    state.exam = cleanId(
        params.get("exam") || ""
    );

    state.subject = cleanId(
        params.get("subject") || ""
    );

    state.search = cleanText(
        params.get("search") || ""
    ).slice(0, 150);

    const page = Number(params.get("page"));

    state.page = Number.isSafeInteger(page) && page > 0
        ? page
        : 1;

}


function updateURL() {

    const url = new URL(
        window.location.href
    );

    const params = url.searchParams;

    params.delete("exam");
    params.delete("subject");
    params.delete("search");
    params.delete("page");

    if (state.exam) {
        params.set("exam", state.exam);
    }

    if (state.subject) {
        params.set("subject", state.subject);
    }

    if (state.search) {
        params.set("search", state.search);
    }

    if (state.page > 1) {
        params.set("page", String(state.page));
    }

    window.history.replaceState(
        null,
        "",
        url.pathname + url.search + url.hash
    );

}


/* =====================================================
   08. SVG ICONS
===================================================== */

function createIcon(type = "arrow") {

    const paths = {

        arrow: [
            "M5 12h14",
            "m12 5 7 7-7 7"
        ],

        clock: [
            "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z",
            "M12 6v6l4 2"
        ],

        clipboard: [
            "M8 4h-2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2",
            "M9 2h6v4H9z",
            "M9 12h6",
            "M9 16h6"
        ]

    };

    const namespace =
        "http://www.w3.org/2000/svg";

    const svg = document.createElementNS(
        namespace,
        "svg"
    );

    const attributes = {

        width: "20",
        height: "20",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "1.8",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "aria-hidden": "true",
        focusable: "false"

    };

    Object.entries(attributes).forEach(
        ([key, value]) => {
            svg.setAttribute(key, value);
        }
    );

    (paths[type] || paths.arrow).forEach(data => {

        const path = document.createElementNS(
            namespace,
            "path"
        );

        path.setAttribute("d", data);

        svg.appendChild(path);

    });

    return svg;

}


/* =====================================================
   09. STATUS MESSAGES
===================================================== */

function updateResultCount(message) {

    if (elements.resultCount) {
        elements.resultCount.textContent = message;
    }

}


function showMessage(title, description, isError = false) {

    const wrapper = createElement(
        "div",
        isError ? "ui-alert alert-error" : "empty-state"
    );

    if (isError) {
        wrapper.setAttribute("role", "alert");
    }

    wrapper.append(

        createElement("h3", "", title),

        createElement("p", "", description)

    );

    elements.grid.replaceChildren(wrapper);

    elements.grid.setAttribute(
        "aria-busy",
        "false"
    );

    elements.pagination.hidden = true;

    elements.pagination.replaceChildren();

}


function showLoading() {

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

    wrapper.append(

        spinner,

        createElement(
            "span",
            "loading-text",
            "Loading available mock tests..."
        )

    );

    elements.grid.replaceChildren(wrapper);

    elements.grid.setAttribute(
        "aria-busy",
        "true"
    );

    elements.pagination.hidden = true;

    updateResultCount(
        "Loading available mock tests..."
    );

}


/* =====================================================
   10. FILTER OPTION GENERATOR
===================================================== */

function populateSelect(

    select,
    items,
    placeholder,
    selectedValue

) {

    const fragment = document.createDocumentFragment();

    const defaultOption = new Option(
        placeholder,
        ""
    );

    fragment.appendChild(defaultOption);

    const sorted = [...items].sort((a, b) => {

        return cleanText(a.name).localeCompare(
            cleanText(b.name)
        );

    });

    sorted.forEach(item => {

        const id = cleanId(item.id);

        if (!id) {
            return;
        }

        const option = new Option(

            cleanText(item.name, "Untitled"),

            id

        );

        fragment.appendChild(option);

    });

    select.replaceChildren(fragment);

    const exists = sorted.some(
        item => cleanId(item.id) === selectedValue
    );

    select.value = exists ? selectedValue : "";

}


/* =====================================================
   11. POPULATE EXAMINATION FILTER
===================================================== */

function populateExamFilter() {

    const exams = state.exams.filter(isPublished);

    populateSelect(

        elements.exam,

        exams,

        "All Examinations",

        state.exam

    );

}


/* =====================================================
   12. POPULATE SUBJECT FILTER
===================================================== */

function populateSubjectFilter() {

    const subjects = state.subjects.filter(subject => {

        if (!isPublished(subject)) {
            return false;
        }

        if (!state.exam) {
            return true;
        }

        if (Array.isArray(subject.examIds)) {

            return subject.examIds.includes(
                state.exam
            );

        }

        return subject.examId === state.exam;

    });

    populateSelect(

        elements.subject,

        subjects,

        "All Subjects",

        state.subject

    );

}


/* =====================================================
   13. FILTER TESTS
===================================================== */

function getFilteredTests() {

    const search = state.search.toLocaleLowerCase();

    return state.tests.filter(test => {

        if (!isPublished(test)) {
            return false;
        }

        if (
            state.exam &&
            test.examId !== state.exam &&
            !(
                Array.isArray(test.examIds) &&
                test.examIds.includes(state.exam)
            )
        ) {
            return false;
        }

        if (
            state.subject &&
            test.subjectId !== state.subject &&
            !(
                Array.isArray(test.subjectIds) &&
                test.subjectIds.includes(state.subject)
            )
        ) {
            return false;
        }

        if (search) {

            const searchableText = [

                test.title,
                test.description,
                test.examName,
                test.subjectName

            ]

                .map(value => cleanText(value))

                .join(" ")

                .toLocaleLowerCase();

            if (!searchableText.includes(search)) {
                return false;
            }

        }

        return true;

    });

}


/* =====================================================
   14. SORT TESTS
===================================================== */

function getTimestamp(test) {

    const value = test.createdAt;

    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === "string") {

        const parsed = Date.parse(value);

        return Number.isFinite(parsed) ? parsed : 0;

    }

    return 0;

}


function sortTests(tests) {

    const sorted = [...tests];

    switch (state.sort) {

        case "oldest":

            sorted.sort(
                (a, b) => getTimestamp(a) - getTimestamp(b)
            );

            break;

        case "title-asc":

            sorted.sort((a, b) =>

                cleanText(a.title).localeCompare(
                    cleanText(b.title)
                )

            );

            break;

        case "title-desc":

            sorted.sort((a, b) =>

                cleanText(b.title).localeCompare(
                    cleanText(a.title)
                )

            );

            break;

        case "questions-asc":

            sorted.sort((a, b) =>

                cleanNumber(a.questionCount) -
                cleanNumber(b.questionCount)

            );

            break;

        case "questions-desc":

            sorted.sort((a, b) =>

                cleanNumber(b.questionCount) -
                cleanNumber(a.questionCount)

            );

            break;

        case "newest":
        default:

            sorted.sort(
                (a, b) => getTimestamp(b) - getTimestamp(a)
            );

            break;

    }

    return sorted;

}


/* =====================================================
   15. MOCK TEST CARD
===================================================== */

function createDetail(label, value) {

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


function createMockCard(test) {

    const id = cleanId(test.id);

    const title = cleanText(
        test.title,
        "Untitled mock test"
    );

    const description = cleanText(
        test.description,
        "Practice your knowledge with this free mock test."
    );

    const questionCount = cleanNumber(
        test.questionCount
    );

    const duration = cleanNumber(
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

    const icon = createElement(
        "span",
        "ui-icon"
    );

    icon.appendChild(
        createIcon("clipboard")
    );

    header.append(

        icon,

        createElement(
            "span",
            "ui-badge",
            "Free test"
        )

    );

    const heading = createElement(
        "h3",
        "",
        title
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

        createDetail(
            "Questions",
            String(questionCount)
        ),

        createDetail(
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

    const link = createElement(
        "a",
        "btn btn-primary",
        "Start Mock Test"
    );

    const params = new URLSearchParams({
        test: id
    });

    link.href = `mock-test.html?${params.toString()}`;

    link.setAttribute(
        "aria-label",
        `Start ${title}`
    );

    link.appendChild(
        createIcon("arrow")
    );

    footer.appendChild(link);

    card.append(

        header,
        heading,
        summary,
        details,
        footer

    );

    return card;

}


/* =====================================================
   16. PAGINATION BUTTON
===================================================== */

function createPageButton(

    label,
    page,
    options = {}

) {

    const button = createElement(
        "button",
        "page-btn",
        label
    );

    button.type = "button";

    button.disabled = Boolean(
        options.disabled
    );

    if (options.active) {

        button.classList.add("active");

        button.setAttribute(
            "aria-current",
            "page"
        );

    }

    button.setAttribute(
        "aria-label",
        options.ariaLabel || `Go to page ${page}`
    );

    button.addEventListener("click", () => {

        if (
            button.disabled ||
            state.page === page
        ) {
            return;
        }

        state.page = page;

        updateURL();

        renderDirectory();

        const directory = document.querySelector(
            ".mock-directory-section"
        );

        if (directory) {

            directory.scrollIntoView({

                behavior:
                    window.matchMedia(
                        "(prefers-reduced-motion: reduce)"
                    ).matches
                        ? "auto"
                        : "smooth",

                block: "start"

            });

        }

    });

    return button;

}


/* =====================================================
   17. RENDER PAGINATION
===================================================== */

function renderPagination(totalPages) {

    const container = elements.pagination;

    container.replaceChildren();

    if (totalPages <= 1) {

        container.hidden = true;

        return;

    }

    container.hidden = false;

    const fragment = document.createDocumentFragment();

    fragment.appendChild(

        createPageButton(

            "Previous",

            state.page - 1,

            {
                disabled: state.page === 1,
                ariaLabel: "Go to previous page"
            }

        )

    );

    /*
     * Display a compact page-number range.
     */

    const start = Math.max(
        1,
        state.page - 2
    );

    const end = Math.min(
        totalPages,
        start + 4
    );

    const adjustedStart = Math.max(
        1,
        end - 4
    );

    for (
        let page = adjustedStart;
        page <= end;
        page++
    ) {

        fragment.appendChild(

            createPageButton(

                String(page),

                page,

                {
                    active: page === state.page
                }

            )

        );

    }

    fragment.appendChild(

        createPageButton(

            "Next",

            state.page + 1,

            {
                disabled: state.page === totalPages,
                ariaLabel: "Go to next page"
            }

        )

    );

    container.appendChild(fragment);

}


/* =====================================================
   18. RENDER DIRECTORY
===================================================== */

function renderDirectory() {

    if (state.loading) {
        return;
    }

    const filtered = sortTests(
        getFilteredTests()
    );

    const total = filtered.length;

    if (total === 0) {

        showMessage(

            "No matching mock tests",

            "Try another search term or reset your filters to explore available tests."

        );

        updateResultCount(
            "0 mock tests found"
        );

        return;

    }

    const totalPages = Math.ceil(
        total / CONFIG.pageSize
    );

    state.page = Math.min(
        Math.max(state.page, 1),
        totalPages
    );

    const start = (
        state.page - 1
    ) * CONFIG.pageSize;

    const currentTests = filtered.slice(

        start,

        start + CONFIG.pageSize

    );

    const fragment = document.createDocumentFragment();

    currentTests.forEach(test => {

        fragment.appendChild(
            createMockCard(test)
        );

    });

    elements.grid.replaceChildren(fragment);

    elements.grid.setAttribute(
        "aria-busy",
        "false"
    );

    const first = start + 1;

    const last = Math.min(
        start + CONFIG.pageSize,
        total
    );

    updateResultCount(

        `Showing ${first}–${last} of ${total} mock tests`

    );

    renderPagination(totalPages);

    if (
        window.YadavAnimations &&
        typeof window.YadavAnimations.refresh === "function"
    ) {

        window.YadavAnimations.refresh(
            elements.grid
        );

    }

}


/* =====================================================
   19. FILTER CHANGE HANDLING
===================================================== */

function applyFilters() {

    state.search = elements.search.value
        .trim()
        .slice(0, 150);

    state.exam = cleanId(
        elements.exam.value
    );

    state.subject = cleanId(
        elements.subject.value
    );

    state.sort = elements.sort.value;

    state.page = 1;

    updateURL();

    renderDirectory();

}


/* =====================================================
   20. REGISTER FILTER EVENTS
===================================================== */

function registerFilterEvents() {

    let searchTimer = null;

    elements.search.addEventListener(
        "input",
        () => {

            window.clearTimeout(searchTimer);

            searchTimer = window.setTimeout(

                applyFilters,

                180

            );

        }
    );


    elements.exam.addEventListener(
        "change",
        () => {

            state.exam = cleanId(
                elements.exam.value
            );

            state.subject = "";

            populateSubjectFilter();

            applyFilters();

        }
    );


    elements.subject.addEventListener(
        "change",
        applyFilters
    );


    elements.sort.addEventListener(
        "change",
        applyFilters
    );


    elements.form.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            window.clearTimeout(searchTimer);

            applyFilters();

        }
    );


    elements.form.addEventListener(
        "reset",
        event => {

            event.preventDefault();

            window.clearTimeout(searchTimer);

            state.search = "";
            state.exam = "";
            state.subject = "";
            state.sort = "newest";
            state.page = 1;

            elements.search.value = "";

            elements.sort.value = "newest";

            populateExamFilter();

            populateSubjectFilter();

            updateURL();

            renderDirectory();

        }
    );

}


/* =====================================================
   21. FIREBASE CONTENT HANDLER
===================================================== */

function handleContentUpdate(update) {

    if (
        Object.prototype.hasOwnProperty.call(
            update,
            "exams"
        )
    ) {

        state.exams = normalizeCollection(
            update.exams
        );

        state.received.exams = true;

    }

    if (
        Object.prototype.hasOwnProperty.call(
            update,
            "subjects"
        )
    ) {

        state.subjects = normalizeCollection(
            update.subjects
        );

        state.received.subjects = true;

    }

    if (
        Object.prototype.hasOwnProperty.call(
            update,
            "tests"
        )
    ) {

        state.tests = normalizeCollection(
            update.tests
        );

        state.received.tests = true;

    }

    /*
     * Wait for the first response from all three
     * Firebase collection listeners.
     */

    const allReceived = Object.values(
        state.received
    ).every(Boolean);

    if (!allReceived) {
        return;
    }

    state.loading = false;

    populateExamFilter();

    populateSubjectFilter();

    renderDirectory();

}


/* =====================================================
   22. FIREBASE ERROR HANDLER
===================================================== */

function handleFirebaseError(error) {

    console.error(
        "[Yadav ExamPrep] Mock test loading failed:",
        error
    );

    state.loading = false;

    showMessage(

        "Unable to load mock tests",

        "The test directory could not be loaded. Please check your connection and try again.",

        true

    );

    updateResultCount(
        "Mock tests unavailable"
    );

}


/* =====================================================
   23. CONNECT REALTIME DATABASE
===================================================== */

function connectDatabase() {

    if (!isDatabaseConfigured()) {

        state.loading = false;

        showMessage(

            "Mock tests are not available yet",

            "The examination database is being configured. Please check back later."

        );

        updateResultCount(
            "No mock tests available"
        );

        return;

    }

    try {

        state.unsubscribe = subscribeToPublicContent(

            handleContentUpdate,

            handleFirebaseError

        );

    } catch (error) {

        handleFirebaseError(error);

    }

}


/* =====================================================
   24. INITIALIZE DIRECTORY
===================================================== */

function initializeDirectory() {

    if (
        document.body.dataset.page !== "mock-tests" ||
        state.initialized
    ) {
        return;
    }

    Object.entries(CONFIG.selectors).forEach(

        ([key, selector]) => {

            elements[key] = getElement(selector);

        }

    );

    const required = [

        "grid",
        "search",
        "exam",
        "subject",
        "sort",
        "form",
        "pagination",
        "resultCount"

    ];

    const missing = required.filter(
        key => !elements[key]
    );

    if (missing.length > 0) {

        console.error(

            "[Yadav ExamPrep] Missing directory elements:",

            missing

        );

        return;

    }

    state.initialized = true;

    readURLFilters();

    elements.search.value = state.search;

    elements.sort.value = state.sort;

    registerFilterEvents();

    showLoading();

    connectDatabase();

}


/* =====================================================
   25. CLEANUP
===================================================== */

window.addEventListener(
    "pagehide",
    () => {

        if (
            typeof state.unsubscribe === "function"
        ) {

            state.unsubscribe();

            state.unsubscribe = null;

        }

    }
);


/* =====================================================
   26. SAFE DOM INITIALIZATION
===================================================== */

if (document.readyState === "loading") {

    document.addEventListener(

        "DOMContentLoaded",

        initializeDirectory,

        { once: true }

    );

} else {

    initializeDirectory();

}
