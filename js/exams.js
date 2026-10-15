
/*
=========================================================
YADAV EXAMPREP
File: js/exams.js

Public Examination Directory Controller

Designed and Developed by Yadav Web Technologies

DATABASE:
    public/exams

IMPORTANT:
- Firebase Realtime Database only.
- Public visitors do not need authentication.
- Only published examinations are displayed.
- No default or sample educational records.
- DOM content is rendered without unsafe HTML injection.
=========================================================
*/

"use strict";

import {
    database,
    isDatabaseConfigured
} from "./firebase-config.js";

import {
    ref,
    onValue
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";


/* =====================================================
   01. CONFIGURATION
===================================================== */

const CONFIG = Object.freeze({

    databasePath: "public/exams",

    itemsPerPage: 9,

    maximumSearchLength: 120,

    defaultSort: "order",

    allowedSorts: [
        "order",
        "name-asc",
        "name-desc",
        "newest",
        "oldest"
    ]

});


/* =====================================================
   02. SELECTORS
===================================================== */

const SELECTORS = {

    form: "#examFilterForm",

    search: "#examSearch",

    sort: "#examSortFilter",

    reset: "#resetExamFilters",

    resultCount: "#examResultCount",

    grid: "#allExaminations",

    pagination: "#examPagination",

    emptyTemplate: "#examEmptyStateTemplate",

    year: "#currentYear"

};


/* =====================================================
   03. APPLICATION STATE
===================================================== */

const state = {

    initialized: false,

    loaded: false,

    exams: [],

    filtered: [],

    search: "",

    sort: CONFIG.defaultSort,

    page: 1,

    unsubscribe: null

};

const el = {};


/* =====================================================
   04. GENERAL HELPERS
===================================================== */

function setText(element, value) {

    if (element) {
        element.textContent = String(value);
    }

}

function createElement(
    tag,
    className = "",
    text
) {

    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== undefined) {
        element.textContent = String(text);
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

                id: String(
                    item.id ?? index
                )

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

            /*
             * Firebase key is authoritative.
             */

            id

        }));

}

function cleanText(value) {

    return typeof value === "string"
        ? value.trim()
        : "";

}

function cleanSearch(value) {

    return cleanText(value)
        .slice(
            0,
            CONFIG.maximumSearchLength
        );

}

function validNumber(value) {

    return (
        typeof value === "number" &&
        Number.isFinite(value)
    );

}

function getOrder(record) {

    return validNumber(record.order)
        ? record.order
        : Number.MAX_SAFE_INTEGER;

}

function getTimestamp(record) {

    const value =
        record.createdAt ??
        record.updatedAt;

    if (validNumber(value)) {
        return value;
    }

    if (typeof value === "string") {

        const parsed = Date.parse(value);

        return Number.isFinite(parsed)
            ? parsed
            : 0;

    }

    return 0;

}

function safeIdentifier(value) {

    if (
        typeof value !== "string" ||
        !value ||
        /[.#$\[\]\/\u0000-\u001f\u007f]/.test(value)
    ) {
        return "";
    }

    return value;

}


/* =====================================================
   05. READ INITIAL URL FILTERS
===================================================== */

function readURLState() {

    const params = new URLSearchParams(
        window.location.search
    );

    state.search = cleanSearch(
        params.get("search") || ""
    );

    const requestedSort = params.get("sort");

    state.sort = CONFIG.allowedSorts.includes(
        requestedSort
    )
        ? requestedSort
        : CONFIG.defaultSort;

    const requestedPage = Number(
        params.get("page")
    );

    state.page = (
        Number.isSafeInteger(requestedPage) &&
        requestedPage > 0
    )
        ? requestedPage
        : 1;

    el.search.value = state.search;
    el.sort.value = state.sort;

}


/* =====================================================
   06. SYNCHRONIZE URL
===================================================== */

function synchronizeURL() {

    const url = new URL(
        window.location.href
    );

    if (state.search) {

        url.searchParams.set(
            "search",
            state.search
        );

    } else {

        url.searchParams.delete("search");

    }

    if (state.sort !== CONFIG.defaultSort) {

        url.searchParams.set(
            "sort",
            state.sort
        );

    } else {

        url.searchParams.delete("sort");

    }

    if (state.page > 1) {

        url.searchParams.set(
            "page",
            String(state.page)
        );

    } else {

        url.searchParams.delete("page");

    }

    window.history.replaceState(
        null,
        "",
        url
    );

}


/* =====================================================
   07. STATUS RENDERING
===================================================== */

function renderMessage(
    title,
    description,
    loading = false
) {

    el.grid.replaceChildren();

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
            loading ? "p" : "h2",
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

    el.grid.append(wrapper);

    el.grid.setAttribute(
        "aria-busy",
        String(loading)
    );

    el.pagination.hidden = true;

    el.pagination.replaceChildren();

}

function renderLoading() {

    setText(
        el.resultCount,
        "Loading examinations..."
    );

    renderMessage(
        "Loading available examinations...",
        "",
        true
    );

}

function renderError(message) {

    state.loaded = false;

    setControls(false);

    setText(
        el.resultCount,
        "Unable to load examinations"
    );

    renderMessage(
        "Examinations Unavailable",
        message
    );

}


/* =====================================================
   08. ENABLE FILTER CONTROLS
===================================================== */

function setControls(enabled) {

    [
        el.search,
        el.sort,
        el.reset
    ].forEach(control => {

        control.disabled = !enabled;

    });

}


/* =====================================================
   09. FILTER EXAMINATIONS
===================================================== */

function filterExaminations() {

    const search = state.search
        .toLocaleLowerCase();

    let results = state.exams.filter(exam => {

        if (!search) {
            return true;
        }

        const searchableText = [

            cleanText(exam.name),

            cleanText(exam.description)

        ].join(" ").toLocaleLowerCase();

        return searchableText.includes(search);

    });

    results = [...results];

    const alphabetical = (a, b) => {

        return cleanText(a.name).localeCompare(
            cleanText(b.name),
            undefined,
            {
                sensitivity: "base",
                numeric: true
            }
        );

    };

    switch (state.sort) {

        case "name-asc":

            results.sort(alphabetical);

            break;

        case "name-desc":

            results.sort(
                (a, b) => alphabetical(b, a)
            );

            break;

        case "newest":

            results.sort((a, b) => {

                return (
                    getTimestamp(b) -
                    getTimestamp(a)
                ) || alphabetical(a, b);

            });

            break;

        case "oldest":

            results.sort((a, b) => {

                return (
                    getTimestamp(a) -
                    getTimestamp(b)
                ) || alphabetical(a, b);

            });

            break;

        default:

            results.sort((a, b) => {

                return (
                    getOrder(a) -
                    getOrder(b)
                ) || alphabetical(a, b);

            });

    }

    state.filtered = results;

}


/* =====================================================
   10. SVG ICON
===================================================== */

function createExamIcon() {

    const namespace =
        "http://www.w3.org/2000/svg";

    const svg = document.createElementNS(
        namespace,
        "svg"
    );

    svg.setAttribute("width", "24");
    svg.setAttribute("height", "24");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.7");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");

    const paths = [

        ["rect", {
            x: "4",
            y: "3",
            width: "16",
            height: "18",
            rx: "2"
        }],

        ["path", {
            d: "M8 8h8"
        }],

        ["path", {
            d: "M8 12h8"
        }],

        ["path", {
            d: "M8 16h5"
        }]

    ];

    paths.forEach(([tag, attributes]) => {

        const node = document.createElementNS(
            namespace,
            tag
        );

        Object.entries(attributes).forEach(
            ([key, value]) => {

                node.setAttribute(
                    key,
                    value
                );

            }
        );

        svg.append(node);

    });

    return svg;

}


/* =====================================================
   11. CREATE EXAMINATION CARD
===================================================== */

function createExamCard(exam) {

    const id = safeIdentifier(exam.id);

    if (!id) {
        return null;
    }

    const card = createElement(
        "article",
        "exam-card"
    );

    /*
     * Icon
     */

    const icon = createElement(
        "div",
        "ui-icon"
    );

    icon.append(
        createExamIcon()
    );

    /*
     * Publication badge
     */

    const badge = createElement(
        "span",
        "ui-badge badge-success",
        "Available"
    );

    /*
     * Heading
     */

    const title = createElement(
        "h2",
        "exam-card-title",
        cleanText(exam.name)
    );

    /*
     * Description
     */

    const description = createElement(
        "p",
        "exam-card-description",
        cleanText(exam.description) ||
        "Explore available subjects and mock tests for this examination."
    );

    /*
     * Primary action
     */

    const actions = createElement(
        "div",
        "exam-card-actions"
    );

    const subjectsLink = createElement(
        "a",
        "btn btn-primary",
        "Explore Subjects"
    );

    subjectsLink.href =
        `subjects.html?exam=${encodeURIComponent(id)}`;

    const testsLink = createElement(
        "a",
        "text-link",
        "View Mock Tests"
    );

    testsLink.href =
        `mock-tests.html?exam=${encodeURIComponent(id)}`;

    actions.append(
        subjectsLink,
        testsLink
    );

    card.append(
        icon,
        badge,
        title,
        description,
        actions
    );

    return card;

}


/* =====================================================
   12. RENDER EXAMINATION GRID
===================================================== */

function renderExaminations() {

    el.grid.replaceChildren();

    el.grid.setAttribute(
        "aria-busy",
        "false"
    );

    const total = state.filtered.length;

    if (!total) {

        const templateContent =
            el.emptyTemplate.content.cloneNode(true);

        el.grid.append(
            templateContent
        );

        setText(
            el.resultCount,
            state.search
                ? "0 matching examinations"
                : "No published examinations available"
        );

        el.pagination.hidden = true;
        el.pagination.replaceChildren();

        return;

    }

    const totalPages = Math.ceil(
        total / CONFIG.itemsPerPage
    );

    state.page = Math.min(
        Math.max(1, state.page),
        totalPages
    );

    const start = (
        state.page - 1
    ) * CONFIG.itemsPerPage;

    const visible = state.filtered.slice(
        start,
        start + CONFIG.itemsPerPage
    );

    const fragment =
        document.createDocumentFragment();

    visible.forEach(exam => {

        const card = createExamCard(exam);

        if (card) {
            fragment.append(card);
        }

    });

    el.grid.append(fragment);

    const first = start + 1;

    const last = Math.min(
        start + CONFIG.itemsPerPage,
        total
    );

    setText(
        el.resultCount,
        `Showing ${first}–${last} of ${total} examinations`
    );

    renderPagination(totalPages);

}


/* =====================================================
   13. PAGINATION
===================================================== */

function createPaginationButton(
    label,
    page,
    options = {}
) {

    const button = createElement(
        "button",
        "pagination-button",
        label
    );

    button.type = "button";

    button.disabled =
        options.disabled === true;

    if (options.current) {

        button.classList.add(
            "active"
        );

        button.setAttribute(
            "aria-current",
            "page"
        );

    }

    if (options.ariaLabel) {

        button.setAttribute(
            "aria-label",
            options.ariaLabel
        );

    }

    button.addEventListener(
        "click",
        () => changePage(page)
    );

    return button;

}

function renderPagination(totalPages) {

    el.pagination.replaceChildren();

    if (totalPages <= 1) {

        el.pagination.hidden = true;

        return;

    }

    el.pagination.hidden = false;

    const fragment =
        document.createDocumentFragment();

    fragment.append(

        createPaginationButton(

            "Previous",

            state.page - 1,

            {

                disabled:
                    state.page === 1,

                ariaLabel:
                    "Go to previous page"

            }

        )

    );

    /*
     * Compact page range for mobile and desktop.
     */

    const maximumVisible = 5;

    let firstPage = Math.max(
        1,
        state.page - 2
    );

    let lastPage = Math.min(
        totalPages,
        firstPage + maximumVisible - 1
    );

    firstPage = Math.max(
        1,
        lastPage - maximumVisible + 1
    );

    for (
        let page = firstPage;
        page <= lastPage;
        page++
    ) {

        fragment.append(

            createPaginationButton(

                String(page),

                page,

                {

                    current:
                        page === state.page,

                    ariaLabel:
                        `Go to page ${page}`

                }

            )

        );

    }

    fragment.append(

        createPaginationButton(

            "Next",

            state.page + 1,

            {

                disabled:
                    state.page === totalPages,

                ariaLabel:
                    "Go to next page"

            }

        )

    );

    el.pagination.append(fragment);

}


/* =====================================================
   14. APPLY FILTERS
===================================================== */

function applyFilters(
    resetPage = false
) {

    if (resetPage) {
        state.page = 1;
    }

    filterExaminations();

    renderExaminations();

    synchronizeURL();

}


/* =====================================================
   15. CHANGE PAGE
===================================================== */

function changePage(page) {

    const totalPages = Math.ceil(

        state.filtered.length /
        CONFIG.itemsPerPage

    );

    if (

        !Number.isInteger(page) ||

        page < 1 ||

        page > totalPages ||

        page === state.page

    ) {

        return;

    }

    state.page = page;

    renderExaminations();

    synchronizeURL();

    /*
     * Return users to the result count
     * without abruptly moving focus.
     */

    el.resultCount.scrollIntoView({

        behavior: window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches
            ? "auto"
            : "smooth",

        block: "start"

    });

}


/* =====================================================
   16. HANDLE FILTER EVENTS
===================================================== */

function registerFilterEvents() {

    el.form.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            state.search = cleanSearch(
                el.search.value
            );

            applyFilters(true);

        }
    );

    el.search.addEventListener(
        "input",
        () => {

            state.search = cleanSearch(
                el.search.value
            );

            applyFilters(true);

        }
    );

    el.sort.addEventListener(
        "change",
        () => {

            state.sort =
                CONFIG.allowedSorts.includes(
                    el.sort.value
                )
                    ? el.sort.value
                    : CONFIG.defaultSort;

            applyFilters(true);

        }
    );

    el.reset.addEventListener(
        "click",
        () => {

            state.search = "";

            state.sort = CONFIG.defaultSort;

            state.page = 1;

            el.search.value = "";

            el.sort.value =
                CONFIG.defaultSort;

            applyFilters();

        }
    );

}


/* =====================================================
   17. FIREBASE SUBSCRIPTION
===================================================== */

function subscribeExaminations() {

    if (
        !isDatabaseConfigured() ||
        !database
    ) {

        renderError(
            "The examination directory is not configured yet. Please visit again later."
        );

        return;

    }

    renderLoading();

    state.unsubscribe = onValue(

        ref(
            database,
            CONFIG.databasePath
        ),

        snapshot => {

            const records = normalizeCollection(
                snapshot.val()
            );

            /*
             * Never display drafts or unpublished records.
             */

            state.exams = records.filter(exam => {

                return (

                    exam.published === true &&

                    Boolean(
                        safeIdentifier(exam.id)
                    ) &&

                    Boolean(
                        cleanText(exam.name)
                    )

                );

            });

            state.loaded = true;

            setControls(true);

            applyFilters();

        },

        error => {

            console.error(

                "[Public Exams] Firebase:",

                error?.code || error?.message

            );

            renderError(
                "We could not retrieve the examination directory. Please try again later."
            );

        }

    );

}


/* =====================================================
   18. CLEANUP
===================================================== */

function cleanup() {

    if (typeof state.unsubscribe === "function") {

        state.unsubscribe();

        state.unsubscribe = null;

    }

}


/* =====================================================
   19. INITIALIZATION
===================================================== */

function initialize() {

    if (

        state.initialized ||

        document.body.dataset.page !== "exams"

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

            "[Public Exams] Missing HTML elements:",

            missing

        );

        return;

    }

    state.initialized = true;

    setText(
        el.year,
        new Date().getFullYear()
    );

    readURLState();

    registerFilterEvents();

    setControls(false);

    subscribeExaminations();

    window.addEventListener(
        "pagehide",
        cleanup,
        { once: true }
    );

}


/* =====================================================
   20. START APPLICATION
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
   END OF EXAMS.JS
===================================================== */
