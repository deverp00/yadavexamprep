
/*
=========================================================
YADAV EXAMPREP
File: js/subjects.js

Public Subject Directory Controller

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

    pageSize: 12,

    selectors: {

        grid: "#allSubjects",

        search: "#subjectSearch",

        exam: "#subjectExamFilter",

        sort: "#subjectSortFilter",

        form: "#subjectFilterForm",

        pagination: "#subjectPagination",

        resultCount: "#subjectResultCount"

    }

});


/* =====================================================
   02. APPLICATION STATE
===================================================== */

const state = {

    exams: [],

    subjects: [],

    search: "",

    exam: "",

    sort: "name-asc",

    page: 1,

    loading: true,

    initialized: false,

    received: {
        exams: false,
        subjects: false
    },

    unsubscribe: null

};


/* =====================================================
   03. DOM REFERENCES
===================================================== */

const elements = {};


/* =====================================================
   04. UTILITY FUNCTIONS
===================================================== */

function getElement(selector) {

    return document.querySelector(selector);

}


function createElement(

    tag,
    className = "",
    text = null

) {

    const element = document.createElement(tag);

    if (className) {

        element.className = className;

    }

    if (
        text !== null &&
        text !== undefined
    ) {

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

    if (
        !Number.isFinite(number) ||
        number < 0
    ) {

        return 0;

    }

    return Math.floor(number);

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
   06. PUBLICATION VALIDATION
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
   07. READ URL FILTERS
===================================================== */

function readURLFilters() {

    const params = new URLSearchParams(
        window.location.search
    );

    state.exam = cleanId(
        params.get("exam") || ""
    );

    state.search = cleanText(
        params.get("search") || ""
    ).slice(0, 150);

    const page = Number(
        params.get("page")
    );

    state.page = (

        Number.isSafeInteger(page) &&
        page > 0

    ) ? page : 1;

}


/* =====================================================
   08. UPDATE URL
===================================================== */

function updateURL() {

    const url = new URL(
        window.location.href
    );

    const params = url.searchParams;

    params.delete("exam");

    params.delete("search");

    params.delete("page");

    if (state.exam) {

        params.set(
            "exam",
            state.exam
        );

    }

    if (state.search) {

        params.set(
            "search",
            state.search
        );

    }

    if (state.page > 1) {

        params.set(
            "page",
            String(state.page)
        );

    }

    window.history.replaceState(

        null,

        "",

        url.pathname +
        url.search +
        url.hash

    );

}


/* =====================================================
   09. SVG ICON FACTORY
===================================================== */

function createIcon(type = "book") {

    const namespace =
        "http://www.w3.org/2000/svg";

    const paths = {

        book: [

            "M4 19.5A2.5 2.5 0 0 1 6.5 17H20",

            "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"

        ],

        arrow: [

            "M5 12h14",

            "m12 5 7 7-7 7"

        ],

        layers: [

            "m12 2 9 5-9 5-9-5 9-5Z",

            "m3 12 9 5 9-5",

            "m3 17 9 5 9-5"

        ]

    };

    const svg = document.createElementNS(
        namespace,
        "svg"
    );

    const attributes = {

        width: "22",

        height: "22",

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

            svg.setAttribute(
                key,
                value
            );

        }

    );

    (paths[type] || paths.book).forEach(data => {

        const path = document.createElementNS(
            namespace,
            "path"
        );

        path.setAttribute(
            "d",
            data
        );

        svg.appendChild(path);

    });

    return svg;

}


/* =====================================================
   10. ICON CONTAINER
===================================================== */

function createIconContainer(type) {

    const wrapper = createElement(
        "span",
        "ui-icon"
    );

    wrapper.appendChild(
        createIcon(type)
    );

    return wrapper;

}


/* =====================================================
   11. LOADING STATE
===================================================== */

function showLoading() {

    const wrapper = createElement(
        "div",
        "loading-container"
    );

    wrapper.setAttribute(
        "role",
        "status"
    );

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

            "Loading available subjects..."

        )

    );

    elements.grid.replaceChildren(
        wrapper
    );

    elements.grid.setAttribute(
        "aria-busy",
        "true"
    );

    elements.pagination.hidden = true;

    elements.resultCount.textContent =
        "Loading available subjects...";

}


/* =====================================================
   12. EMPTY AND ERROR STATES
===================================================== */

function showMessage(

    title,

    description,

    isError = false

) {

    const wrapper = createElement(

        "div",

        isError
            ? "ui-alert alert-error"
            : "empty-state"

    );

    if (isError) {

        wrapper.setAttribute(
            "role",
            "alert"
        );

    }

    wrapper.append(

        createIconContainer("book"),

        createElement(
            "h3",
            "",
            title
        ),

        createElement(
            "p",
            "",
            description
        )

    );

    elements.grid.replaceChildren(
        wrapper
    );

    elements.grid.setAttribute(
        "aria-busy",
        "false"
    );

    elements.pagination.hidden = true;

    elements.pagination.replaceChildren();

}


/* =====================================================
   13. POPULATE EXAMINATION FILTER
===================================================== */

function populateExamFilter() {

    const exams = state.exams

        .filter(isPublished)

        .sort((a, b) =>

            cleanText(a.name).localeCompare(
                cleanText(b.name)
            )

        );

    const fragment =
        document.createDocumentFragment();

    fragment.appendChild(

        new Option(
            "All Examinations",
            ""
        )

    );

    exams.forEach(exam => {

        const id = cleanId(exam.id);

        if (!id) {

            return;

        }

        fragment.appendChild(

            new Option(

                cleanText(
                    exam.name,
                    "Untitled examination"
                ),

                id

            )

        );

    });

    elements.exam.replaceChildren(
        fragment
    );

    const selectedExists = exams.some(

        exam => cleanId(exam.id) === state.exam

    );

    elements.exam.value = selectedExists
        ? state.exam
        : "";

}


/* =====================================================
   14. FILTER SUBJECTS
===================================================== */

function getFilteredSubjects() {

    const search = state.search.toLocaleLowerCase();

    const publishedExamIds = new Set(

        state.exams
            .filter(isPublished)
            .map(exam => cleanId(exam.id))

    );

    return state.subjects.filter(subject => {

        if (!isPublished(subject)) {

            return false;

        }

        const examIds = Array.isArray(
            subject.examIds
        )

            ? subject.examIds.map(cleanId)

            : [
                cleanId(subject.examId)
            ];

        /*
         * A subject must belong to at least one
         * currently published examination.
         */

        const hasPublishedExam = examIds.some(

            id => publishedExamIds.has(id)

        );

        if (!hasPublishedExam) {

            return false;

        }

        if (

            state.exam &&

            !examIds.includes(state.exam)

        ) {

            return false;

        }

        if (search) {

            const searchableText = [

                subject.name,

                subject.description,

                subject.category

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
   15. SORT SUBJECTS
===================================================== */

function getTimestamp(subject) {

    const value = subject.createdAt;

    if (typeof value === "number") {

        return Number.isFinite(value)
            ? value
            : 0;

    }

    if (typeof value === "string") {

        const parsed = Date.parse(value);

        return Number.isFinite(parsed)
            ? parsed
            : 0;

    }

    return 0;

}


function sortSubjects(subjects) {

    const sorted = [...subjects];

    switch (state.sort) {

        case "name-desc":

            sorted.sort((a, b) =>

                cleanText(b.name).localeCompare(
                    cleanText(a.name)
                )

            );

            break;


        case "topics-desc":

            sorted.sort((a, b) =>

                cleanNumber(b.topicCount) -
                cleanNumber(a.topicCount)

            );

            break;


        case "topics-asc":

            sorted.sort((a, b) =>

                cleanNumber(a.topicCount) -
                cleanNumber(b.topicCount)

            );

            break;


        case "newest":

            sorted.sort((a, b) =>

                getTimestamp(b) -
                getTimestamp(a)

            );

            break;


        case "name-asc":
        default:

            sorted.sort((a, b) =>

                cleanText(a.name).localeCompare(
                    cleanText(b.name)
                )

            );

            break;

    }

    return sorted;

}


/* =====================================================
   16. SUBJECT CARD GENERATOR
===================================================== */

function createSubjectCard(subject) {

    const id = cleanId(
        subject.id
    );

    const name = cleanText(

        subject.name,

        "Untitled subject"

    );

    const topicCount = cleanNumber(
        subject.topicCount
    );

    const card = createElement(
        "a",
        "subject-card reveal"
    );

    const params = new URLSearchParams({
        subject: id
    });

    card.href = `learn.html?${params.toString()}`;

    card.setAttribute(

        "aria-label",

        `Explore ${name}`

    );

    const icon = createIconContainer(
        "book"
    );

    const content = createElement(
        "div",
        "subject-card-content"
    );

    const title = createElement(
        "h3",
        "",
        name
    );

    const description = createElement(

        "p",

        "",

        `${topicCount} ${topicCount === 1 ? "topic" : "topics"}`

    );

    content.append(
        title,
        description
    );

    const arrow = createElement(
        "span",
        "subject-card-arrow"
    );

    arrow.appendChild(
        createIcon("arrow")
    );

    card.append(

        icon,

        content,

        arrow

    );

    return card;

}


/* =====================================================
   17. PAGINATION BUTTON
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

        button.classList.add(
            "active"
        );

        button.setAttribute(
            "aria-current",
            "page"
        );

    }

    button.setAttribute(

        "aria-label",

        options.ariaLabel ||
        `Go to page ${page}`

    );

    button.addEventListener(
        "click",
        () => {

            if (
                button.disabled ||
                state.page === page
            ) {

                return;

            }

            state.page = page;

            updateURL();

            renderDirectory();

            const section = document.querySelector(
                ".subject-directory-section"
            );

            if (section) {

                section.scrollIntoView({

                    behavior: window.matchMedia(
                        "(prefers-reduced-motion: reduce)"
                    ).matches
                        ? "auto"
                        : "smooth",

                    block: "start"

                });

            }

        }
    );

    return button;

}


/* =====================================================
   18. RENDER PAGINATION
===================================================== */

function renderPagination(totalPages) {

    const container = elements.pagination;

    container.replaceChildren();

    if (totalPages <= 1) {

        container.hidden = true;

        return;

    }

    container.hidden = false;

    const fragment =
        document.createDocumentFragment();

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

    container.appendChild(
        fragment
    );

}


/* =====================================================
   19. RENDER SUBJECT DIRECTORY
===================================================== */

function renderDirectory() {

    if (state.loading) {

        return;

    }

    const filtered = sortSubjects(
        getFilteredSubjects()
    );

    const total = filtered.length;

    if (total === 0) {

        showMessage(

            "No matching subjects",

            "No published subjects match your current selection. Try another search or reset the filters."

        );

        elements.resultCount.textContent =
            "0 subjects found";

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

    const currentSubjects = filtered.slice(

        start,

        start + CONFIG.pageSize

    );

    const fragment =
        document.createDocumentFragment();

    currentSubjects.forEach(subject => {

        fragment.appendChild(
            createSubjectCard(subject)
        );

    });

    elements.grid.replaceChildren(
        fragment
    );

    elements.grid.setAttribute(
        "aria-busy",
        "false"
    );

    const first = start + 1;

    const last = Math.min(

        start + CONFIG.pageSize,

        total

    );

    elements.resultCount.textContent =

        `Showing ${first}–${last} of ${total} subjects`;

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
   20. APPLY FILTERS
===================================================== */

function applyFilters() {

    state.search = elements.search.value

        .trim()

        .slice(0, 150);

    state.exam = cleanId(
        elements.exam.value
    );

    state.sort = elements.sort.value;

    state.page = 1;

    updateURL();

    renderDirectory();

}


/* =====================================================
   21. REGISTER FILTER EVENTS
===================================================== */

function registerFilterEvents() {

    let searchTimer = null;


    /* Search */

    elements.search.addEventListener(

        "input",

        () => {

            window.clearTimeout(
                searchTimer
            );

            searchTimer = window.setTimeout(

                applyFilters,

                180

            );

        }

    );


    /* Examination */

    elements.exam.addEventListener(

        "change",

        applyFilters

    );


    /* Sorting */

    elements.sort.addEventListener(

        "change",

        applyFilters

    );


    /* Prevent Form Reload */

    elements.form.addEventListener(

        "submit",

        event => {

            event.preventDefault();

            window.clearTimeout(
                searchTimer
            );

            applyFilters();

        }

    );


    /* Reset Filters */

    elements.form.addEventListener(

        "reset",

        event => {

            event.preventDefault();

            window.clearTimeout(
                searchTimer
            );

            state.search = "";

            state.exam = "";

            state.sort = "name-asc";

            state.page = 1;

            elements.search.value = "";

            elements.sort.value = "name-asc";

            populateExamFilter();

            updateURL();

            renderDirectory();

        }

    );

}


/* =====================================================
   22. FIREBASE CONTENT HANDLER
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

    const allReceived = Object.values(

        state.received

    ).every(Boolean);

    if (!allReceived) {

        return;

    }

    state.loading = false;

    populateExamFilter();

    renderDirectory();

}


/* =====================================================
   23. FIREBASE ERROR HANDLER
===================================================== */

function handleFirebaseError(error) {

    console.error(

        "[Yadav ExamPrep] Subject loading failed:",

        error

    );

    state.loading = false;

    showMessage(

        "Unable to load subjects",

        "The subject directory could not be loaded. Please check your internet connection and try again.",

        true

    );

    elements.resultCount.textContent =
        "Subjects unavailable";

}


/* =====================================================
   24. CONNECT FIREBASE
===================================================== */

function connectDatabase() {

    if (!isDatabaseConfigured()) {

        state.loading = false;

        showMessage(

            "Subjects are not available yet",

            "The learning database is being configured. Published subjects will appear here once available."

        );

        elements.resultCount.textContent =
            "No subjects available";

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
   25. INITIALIZE DIRECTORY
===================================================== */

function initializeDirectory() {

    if (

        document.body.dataset.page !== "subjects" ||

        state.initialized

    ) {

        return;

    }

    Object.entries(CONFIG.selectors).forEach(

        ([key, selector]) => {

            elements[key] = getElement(
                selector
            );

        }

    );

    const required = [

        "grid",

        "search",

        "exam",

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

            "[Yadav ExamPrep] Missing subject directory elements:",

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
   26. CLEANUP
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
   27. SAFE INITIALIZATION
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
