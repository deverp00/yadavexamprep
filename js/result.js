
/*
=========================================================
YADAV EXAMPREP
File: js/result.js

Mock Test Result Controller

Designed and Developed by Yadav Web Technologies

Responsibilities:
- Read completed examination result
- Validate stored result structure
- Display examination statistics
- Calculate answer accuracy
- Render question-wise answer review
- Filter correct / incorrect / unanswered answers
- Print examination result

No Firebase writes.
No student login.
No sample or default examination records.
=========================================================
*/

"use strict";


/* =====================================================
   01. CONFIGURATION
===================================================== */

const CONFIG = Object.freeze({

    storageKey: "yadav-examprep-result-v1",

    filters: [
        "all",
        "correct",
        "incorrect",
        "unanswered"
    ],

    selectors: {

        statusSection: "#resultStatusSection",
        statusTitle: "#resultStatusTitle",
        statusDescription: "#resultStatusDescription",
        statusSpinner: "#resultStatusSpinner",
        statusBackLink: "#resultStatusBackLink",

        content: "#resultContent",

        pageTitle: "#resultPageTitle",
        pageDescription: "#resultPageDescription",
        testTitle: "#resultTestTitle",

        obtainedMarks: "#resultObtainedMarks",
        maximumMarks: "#resultMaximumMarks",

        percentage: "#resultPercentage",
        percentageCircle: "#resultPercentageCircle",
        performanceMessage: "#resultPerformanceMessage",

        correctCount: "#resultCorrectCount",
        incorrectCount: "#resultIncorrectCount",
        unansweredCount: "#resultUnansweredCount",
        accuracy: "#resultAccuracy",

        totalQuestions: "#resultTotalQuestions",
        attempted: "#resultAttempted",
        duration: "#resultDuration",
        timeTaken: "#resultTimeTaken",
        submittedAt: "#resultSubmittedAt",

        printButton: "#printResultButton",

        reviewFilters: "#answerReviewFilters",
        reviewCount: "#answerReviewCount",
        reviewList: "#answerReviewList",
        reviewEmptyTemplate: "#answerReviewEmptyTemplate"

    }

});


/* =====================================================
   02. APPLICATION STATE
===================================================== */

const state = {

    initialized: false,

    result: null,

    activeFilter: "all"

};


const elements = {};


/* =====================================================
   03. GENERAL UTILITIES
===================================================== */

function createElement(
    tag,
    className = "",
    content = null
) {

    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (content !== null && content !== undefined) {
        element.textContent = String(content);
    }

    return element;

}


function cleanText(value, fallback = "") {

    if (typeof value !== "string") {
        return fallback;
    }

    return value.trim() || fallback;

}


function finiteNumber(value, fallback = 0) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return fallback;
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;

}


function nonNegativeInteger(value, fallback = 0) {

    const number = finiteNumber(value, fallback);

    return Number.isInteger(number) && number >= 0
        ? number
        : fallback;

}


function formatNumber(value, digits = 2) {

    const number = finiteNumber(value);

    return new Intl.NumberFormat("en-IN", {

        maximumFractionDigits: digits

    }).format(number);

}


function formatPercentage(value) {

    return `${formatNumber(value, 2)}%`;

}


function formatDuration(milliseconds) {

    const totalSeconds = Math.max(

        0,

        Math.floor(
            finiteNumber(milliseconds) / 1000
        )

    );

    const hours = Math.floor(
        totalSeconds / 3600
    );

    const minutes = Math.floor(
        (totalSeconds % 3600) / 60
    );

    const seconds = totalSeconds % 60;

    const parts = [];

    if (hours > 0) {

        parts.push(`${hours}h`);

    }

    if (minutes > 0 || hours > 0) {

        parts.push(`${minutes}m`);

    }

    parts.push(`${seconds}s`);

    return parts.join(" ");

}


function formatDate(timestamp) {

    const number = finiteNumber(
        timestamp,
        NaN
    );

    if (!Number.isFinite(number) || number <= 0) {
        return "Unavailable";
    }

    const date = new Date(number);

    if (Number.isNaN(date.getTime())) {
        return "Unavailable";
    }

    return new Intl.DateTimeFormat("en-IN", {

        day: "2-digit",
        month: "short",
        year: "numeric",

        hour: "2-digit",
        minute: "2-digit",

        hour12: true

    }).format(date);

}


/* =====================================================
   04. STATUS HANDLING
===================================================== */

function showStatus(
    title,
    description,
    isError = false
) {

    elements.content.hidden = true;

    elements.statusSection.hidden = false;

    elements.statusTitle.textContent = title;

    elements.statusDescription.textContent = description;

    elements.statusSpinner.hidden = isError;

    elements.statusBackLink.hidden = !isError;

}


function showResultContent() {

    elements.statusSection.hidden = true;

    elements.content.hidden = false;

}


/* =====================================================
   05. VALIDATE STORED RESULT
===================================================== */

function isValidResult(result) {

    if (
        !result ||
        typeof result !== "object" ||
        Array.isArray(result)
    ) {
        return false;
    }

    if (result.version !== 1) {
        return false;
    }

    if (
        !cleanText(result.testId) ||
        !cleanText(result.testTitle)
    ) {
        return false;
    }

    if (
        !Array.isArray(result.review) ||
        result.review.length === 0
    ) {
        return false;
    }

    const total = nonNegativeInteger(
        result.totalQuestions
    );

    const correct = nonNegativeInteger(
        result.correct
    );

    const incorrect = nonNegativeInteger(
        result.incorrect
    );

    const unanswered = nonNegativeInteger(
        result.unanswered
    );

    if (
        total === 0 ||
        total !== result.review.length ||
        correct + incorrect + unanswered !== total
    ) {
        return false;
    }

    if (
        !Number.isFinite(result.obtainedMarks) ||
        !Number.isFinite(result.maximumMarks) ||
        result.maximumMarks < 0
    ) {
        return false;
    }

    const validStatuses = new Set([

        "correct",
        "incorrect",
        "unanswered"

    ]);

    const observed = {

        correct: 0,
        incorrect: 0,
        unanswered: 0

    };

    const validReview = result.review.every(item => {

        if (
            !item ||
            typeof item !== "object" ||
            !cleanText(item.id) ||
            !cleanText(item.question) ||
            !Array.isArray(item.options) ||
            !validStatuses.has(item.status)
        ) {
            return false;
        }

        observed[item.status]++;

        if (
            !Number.isFinite(item.marks) ||
            !Number.isFinite(item.negativeMarks) ||
            !Number.isFinite(item.awardedMarks)
        ) {
            return false;
        }

        if (
            item.marks < 0 ||
            item.negativeMarks < 0
        ) {
            return false;
        }

        const optionIds = new Set();

        const optionsValid = item.options.every(option => {

            if (
                !option ||
                typeof option !== "object" ||
                !cleanText(option.id) ||
                !cleanText(option.text) ||
                optionIds.has(option.id)
            ) {
                return false;
            }

            optionIds.add(option.id);

            return true;

        });

        if (
            !optionsValid ||
            item.options.length < 2 ||
            !optionIds.has(item.correctOptionId)
        ) {
            return false;
        }

        if (
            item.selectedOptionId !== null &&
            !optionIds.has(item.selectedOptionId)
        ) {
            return false;
        }

        if (
            item.status === "correct" &&
            item.selectedOptionId !== item.correctOptionId
        ) {
            return false;
        }

        if (
            item.status === "incorrect" &&
            (
                item.selectedOptionId === null ||
                item.selectedOptionId === item.correctOptionId
            )
        ) {
            return false;
        }

        if (
            item.status === "unanswered" &&
            item.selectedOptionId !== null
        ) {
            return false;
        }

        return true;

    });

    return (

        validReview &&

        observed.correct === correct &&

        observed.incorrect === incorrect &&

        observed.unanswered === unanswered

    );

}


/* =====================================================
   06. LOAD RESULT FROM SESSION STORAGE
===================================================== */

function loadResult() {

    showStatus(
        "Preparing Your Result",
        "Please wait while your examination performance is being displayed."
    );

    try {

        const stored = sessionStorage.getItem(
            CONFIG.storageKey
        );

        if (!stored) {

            showStatus(
                "No Examination Result Found",
                "Complete a mock test first to view your marks, performance analysis, and answer review.",
                true
            );

            return;

        }

        const parsed = JSON.parse(stored);

        if (!isValidResult(parsed)) {

            showStatus(
                "Result Data Unavailable",
                "The saved examination result is incomplete or invalid. Please attempt the mock test again.",
                true
            );

            return;

        }

        state.result = parsed;

        renderResult();

        showResultContent();

    } catch (error) {

        console.error(
            "[Yadav ExamPrep] Result loading error:",
            error
        );

        showStatus(
            "Unable to Load Result",
            "Your browser could not read the completed examination result.",
            true
        );

    }

}


/* =====================================================
   07. PERFORMANCE CALCULATIONS
===================================================== */

function getAttemptedCount() {

    if (!state.result) {
        return 0;
    }

    return (
        state.result.correct +
        state.result.incorrect
    );

}


function getAccuracy() {

    if (!state.result) {
        return 0;
    }

    const attempted = getAttemptedCount();

    if (attempted === 0) {
        return 0;
    }

    return (
        state.result.correct / attempted
    ) * 100;

}


function getScorePercentage() {

    if (!state.result) {
        return 0;
    }

    const maximum = finiteNumber(
        state.result.maximumMarks
    );

    if (maximum <= 0) {
        return 0;
    }

    return (

        finiteNumber(
            state.result.obtainedMarks
        ) / maximum

    ) * 100;

}


/* =====================================================
   08. PERFORMANCE MESSAGE
===================================================== */

function getPerformanceMessage() {

    const result = state.result;

    if (!result) {
        return "";
    }

    if (getAttemptedCount() === 0) {

        return "No questions were attempted. Review the questions and continue practising.";

    }

    if (result.incorrect === 0 && result.unanswered === 0) {

        return "All questions were answered correctly. Keep practising to maintain your consistency.";

    }

    if (result.incorrect > 0) {

        return "Review your incorrect answers and their explanations to strengthen your understanding.";

    }

    return "Review the unanswered questions and revisit the related learning materials.";

}


/* =====================================================
   09. RENDER RESULT SUMMARY
===================================================== */

function renderSummary() {

    const result = state.result;

    const attempted = getAttemptedCount();

    const accuracy = getAccuracy();

    const percentage = getScorePercentage();

    elements.pageTitle.textContent =
        "Your Mock Test Result";

    elements.pageDescription.textContent =
        "Your examination has been completed. Review your performance and learn from your answers.";

    elements.testTitle.textContent =
        cleanText(
            result.testTitle,
            "Completed Mock Test"
        );

    elements.obtainedMarks.textContent =
        formatNumber(result.obtainedMarks);

    elements.maximumMarks.textContent =
        formatNumber(result.maximumMarks);

    elements.percentage.textContent =
        formatPercentage(percentage);

    elements.percentageCircle.setAttribute(

        "aria-label",

        `Score percentage: ${formatPercentage(percentage)}`

    );

    /*
     * A numeric custom property allows the upcoming
     * result stylesheet to draw a circular progress
     * indicator without hardcoding a result.
     */

    const visualPercentage = Math.min(
        100,
        Math.max(0, percentage)
    );

    elements.percentageCircle.style.setProperty(

        "--result-percentage",

        `${visualPercentage}%`

    );

    elements.performanceMessage.textContent =
        getPerformanceMessage();

    elements.correctCount.textContent =
        String(result.correct);

    elements.incorrectCount.textContent =
        String(result.incorrect);

    elements.unansweredCount.textContent =
        String(result.unanswered);

    elements.accuracy.textContent =
        formatPercentage(accuracy);

    elements.totalQuestions.textContent =
        String(result.totalQuestions);

    elements.attempted.textContent =
        String(attempted);

    const duration = finiteNumber(
        result.durationMinutes
    );

    elements.duration.textContent = duration > 0
        ? `${formatNumber(duration)} minutes`
        : "Untimed";

    const startedAt = finiteNumber(
        result.startedAt
    );

    const submittedAt = finiteNumber(
        result.submittedAt
    );

    const elapsed = (
        startedAt > 0 &&
        submittedAt >= startedAt
    )
        ? submittedAt - startedAt
        : 0;

    elements.timeTaken.textContent =
        formatDuration(elapsed);

    elements.submittedAt.textContent =
        formatDate(submittedAt);

    document.title =

        `${cleanText(result.testTitle)} Result | Yadav ExamPrep`;

}


/* =====================================================
   10. ANSWER REVIEW HELPERS
===================================================== */

function getOptionLetter(index) {

    if (index < 26) {

        return String.fromCharCode(
            65 + index
        );

    }

    return String(index + 1);

}


function getStatusLabel(status) {

    const labels = {

        correct: "Correct Answer",

        incorrect: "Incorrect Answer",

        unanswered: "Unanswered"

    };

    return labels[status] || "Answer Review";

}


function getAnswerText(item, optionId) {

    if (!optionId) {
        return "Not answered";
    }

    const option = item.options.find(
        entry => entry.id === optionId
    );

    return option
        ? cleanText(option.text, "Unavailable")
        : "Unavailable";

}


/* =====================================================
   11. RENDER INDIVIDUAL ANSWER CARD
===================================================== */

function createReviewCard(item) {

    const card = createElement(
        "article",
        "ui-card answer-review-card"
    );

    card.dataset.status = item.status;


    /* ---------------------------------------------
       Question Header
    ---------------------------------------------- */

    const header = createElement(
        "div",
        "answer-review-card-header"
    );

    const heading = createElement(
        "h3",
        "answer-review-question-title",
        `Question ${item.number}`
    );

    const badge = createElement(
        "span",
        `ui-badge answer-status-badge is-${item.status}`,
        getStatusLabel(item.status)
    );

    header.append(
        heading,
        badge
    );


    /* ---------------------------------------------
       Question Text
    ---------------------------------------------- */

    const question = createElement(
        "p",
        "answer-review-question",
        item.question
    );


    /* ---------------------------------------------
       Answer Options
    ---------------------------------------------- */

    const optionsList = createElement(
        "div",
        "answer-review-options"
    );

    item.options.forEach((option, index) => {

        const optionRow = createElement(
            "div",
            "answer-review-option"
        );

        const isCorrect =
            option.id === item.correctOptionId;

        const isSelected =
            option.id === item.selectedOptionId;

        if (isCorrect) {

            optionRow.classList.add(
                "is-correct"
            );

        }

        if (isSelected) {

            optionRow.classList.add(
                "is-selected"
            );

        }

        if (isSelected && !isCorrect) {

            optionRow.classList.add(
                "is-incorrect"
            );

        }

        const letter = createElement(
            "span",
            "option-letter",
            getOptionLetter(index)
        );

        const text = createElement(
            "span",
            "option-text",
            option.text
        );

        optionRow.append(
            letter,
            text
        );

        if (isCorrect) {

            optionRow.appendChild(

                createElement(
                    "span",
                    "answer-option-indicator",
                    "Correct"
                )

            );

        } else if (isSelected) {

            optionRow.appendChild(

                createElement(
                    "span",
                    "answer-option-indicator",
                    "Your Answer"
                )

            );

        }

        optionsList.appendChild(optionRow);

    });


    /* ---------------------------------------------
       Answer Comparison
    ---------------------------------------------- */

    const comparison = createElement(
        "div",
        "answer-review-comparison"
    );

    const selectedGroup = createElement(
        "div",
        "answer-comparison-item"
    );

    selectedGroup.append(

        createElement(
            "span",
            "answer-comparison-label",
            "Your Answer"
        ),

        createElement(
            "strong",
            "",
            getAnswerText(
                item,
                item.selectedOptionId
            )
        )

    );

    const correctGroup = createElement(
        "div",
        "answer-comparison-item"
    );

    correctGroup.append(

        createElement(
            "span",
            "answer-comparison-label",
            "Correct Answer"
        ),

        createElement(
            "strong",
            "",
            getAnswerText(
                item,
                item.correctOptionId
            )
        )

    );

    comparison.append(
        selectedGroup,
        correctGroup
    );


    /* ---------------------------------------------
       Awarded Marks
    ---------------------------------------------- */

    const marks = createElement(
        "div",
        "answer-review-marks"
    );

    const awarded = finiteNumber(
        item.awardedMarks
    );

    const awardedText = awarded > 0
        ? `+${formatNumber(awarded)}`
        : formatNumber(awarded);

    marks.append(

        createElement(
            "span",
            "",
            "Marks Awarded"
        ),

        createElement(
            "strong",
            "",
            awardedText
        )

    );


    /* ---------------------------------------------
       Explanation
    ---------------------------------------------- */

    const explanationText = cleanText(
        item.explanation
    );

    card.append(
        header,
        question,
        optionsList,
        comparison,
        marks
    );

    if (explanationText) {

        const explanation = createElement(
            "div",
            "answer-review-explanation"
        );

        explanation.append(

            createElement(
                "h4",
                "",
                "Explanation"
            ),

            createElement(
                "p",
                "",
                explanationText
            )

        );

        card.appendChild(explanation);

    }

    return card;

}


/* =====================================================
   12. FILTER ANSWER REVIEW
===================================================== */

function getFilteredReview() {

    if (!state.result) {
        return [];
    }

    if (state.activeFilter === "all") {

        return [...state.result.review];

    }

    return state.result.review.filter(
        item => item.status === state.activeFilter
    );

}


/* =====================================================
   13. RENDER ANSWER REVIEW
===================================================== */

function renderAnswerReview() {

    const review = getFilteredReview();

    const fragment = document.createDocumentFragment();

    if (review.length === 0) {

        const template = elements.reviewEmptyTemplate;

        fragment.appendChild(

            template.content.cloneNode(true)

        );

        elements.reviewCount.textContent =
            "No matching questions.";

    } else {

        review.forEach(item => {

            fragment.appendChild(
                createReviewCard(item)
            );

        });

        elements.reviewCount.textContent =

            `Showing ${review.length} of ${state.result.totalQuestions} questions`;

    }

    elements.reviewList.replaceChildren(
        fragment
    );

}


/* =====================================================
   14. UPDATE FILTER BUTTONS
===================================================== */

function updateFilterButtons() {

    const buttons = elements.reviewFilters.querySelectorAll(
        "[data-filter]"
    );

    buttons.forEach(button => {

        const active =
            button.dataset.filter === state.activeFilter;

        button.classList.toggle(
            "active",
            active
        );

        button.setAttribute(
            "aria-pressed",
            String(active)
        );

    });

}


/* =====================================================
   15. CHANGE ANSWER FILTER
===================================================== */

function changeFilter(filter) {

    if (
        !CONFIG.filters.includes(filter) ||
        !state.result
    ) {
        return;
    }

    state.activeFilter = filter;

    updateFilterButtons();

    renderAnswerReview();

}


/* =====================================================
   16. PRINT RESULT
===================================================== */

function printResult() {

    if (!state.result) {
        return;
    }

    /*
     * Display every reviewed question in the printout,
     * regardless of the currently selected screen filter.
     */

    const previousFilter = state.activeFilter;

    if (previousFilter !== "all") {

        changeFilter("all");

    }

    window.print();

    if (previousFilter !== "all") {

        changeFilter(previousFilter);

    }

}


/* =====================================================
   17. RENDER COMPLETE RESULT
===================================================== */

function renderResult() {

    if (!state.result) {
        return;
    }

    renderSummary();

    state.activeFilter = "all";

    updateFilterButtons();

    renderAnswerReview();

}


/* =====================================================
   18. REGISTER EVENTS
===================================================== */

function registerEvents() {

    elements.reviewFilters.addEventListener(
        "click",
        event => {

            const button = event.target.closest(
                "button[data-filter]"
            );

            if (
                !button ||
                !elements.reviewFilters.contains(button)
            ) {
                return;
            }

            changeFilter(
                button.dataset.filter
            );

        }
    );


    elements.printButton.addEventListener(
        "click",
        printResult
    );

}


/* =====================================================
   19. INITIALIZE RESULT PAGE
===================================================== */

function initializeResultPage() {

    if (
        document.body.dataset.page !== "result" ||
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

    const missing = Object.entries(elements)

        .filter(([, element]) => !element)

        .map(([key]) => key);

    if (missing.length > 0) {

        console.error(
            "[Yadav ExamPrep] Missing result elements:",
            missing
        );

        return;

    }

    state.initialized = true;

    registerEvents();

    loadResult();

}


/* =====================================================
   20. SAFE STARTUP
===================================================== */

if (document.readyState === "loading") {

    document.addEventListener(

        "DOMContentLoaded",

        initializeResultPage,

        { once: true }

    );

} else {

    initializeResultPage();

}
