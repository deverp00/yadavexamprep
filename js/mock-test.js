
/*
=========================================================
YADAV EXAMPREP
File: js/mock-test.js

Actual Mock Examination Controller

Designed and Developed by Yadav Web Technologies

IMPORTANT:
This file controls mock-test.html (singular).
It does not control the mock-test listing page.
=========================================================
*/

"use strict";

import {
    isDatabaseConfigured,
    readData
} from "./firebase-config.js";


/* =====================================================
   01. CONFIGURATION
===================================================== */

const CONFIG = Object.freeze({

    resultStorageKey: "yadav-examprep-result-v1",

    /*
     * Public examination data:
     *
     * public/tests/{testId}
     * public/testQuestions/{testId}/{questionId}
     *
     * Correct answers are exposed to the browser for
     * instant client-side evaluation. This system is
     * intended for free preparation, not secure or
     * proctored examinations.
     */

    selectors: {

        statusSection: "#examStatusSection",
        statusTitle: "#examStatusTitle",
        statusDescription: "#examStatusDescription",
        statusSpinner: "#examStatusSpinner",
        statusBackLink: "#examStatusBackLink",

        instructions: "#examInstructionsSection",
        instructionTitle: "#instructionTestTitle",
        instructionDescription: "#instructionTestDescription",
        instructionQuestionCount: "#instructionQuestionCount",
        instructionDuration: "#instructionDuration",
        instructionTotalMarks: "#instructionTotalMarks",
        instructionNegativeMarking: "#instructionNegativeMarking",

        agreement: "#examAgreement",
        startButton: "#startExamButton",

        workspace: "#examWorkspace",
        activeTitle: "#activeExamTitle",
        activeSubtitle: "#activeExamSubtitle",

        timer: "#examTimer",
        timerValue: "#examTimerValue",

        progressText: "#examProgressText",
        progressPercentage: "#examProgressPercentage",
        progressTrack: "#examProgressTrack",
        progressFill: "#examProgressFill",

        questionCategory: "#examQuestionCategory",
        questionTitle: "#examQuestionTitle",
        questionMarks: "#examQuestionMarks",
        questionContent: "#examQuestionContent",
        answerOptions: "#examAnswerOptions",

        clearButton: "#clearAnswerButton",
        reviewButton: "#markReviewButton",

        previousButton: "#previousQuestionButton",
        nextButton: "#nextQuestionButton",

        palette: "#examQuestionPalette",

        answeredCount: "#answeredCount",
        unansweredCount: "#unansweredCount",
        reviewCount: "#reviewCount",
        totalCount: "#totalQuestionCount",

        submitButton: "#submitExamButton",
        sidebarSubmitButton: "#sidebarSubmitButton",

        modal: "#submitConfirmationModal",
        modalAnswered: "#submitAnsweredCount",
        modalUnanswered: "#submitUnansweredCount",
        modalReview: "#submitReviewCount",
        cancelSubmit: "#cancelSubmitButton",
        confirmSubmit: "#confirmSubmitButton"

    }

});


/* =====================================================
   02. APPLICATION STATE
===================================================== */

const state = {

    testId: "",

    test: null,

    questions: [],

    answers: {},

    reviewed: new Set(),

    currentIndex: 0,

    started: false,

    submitted: false,

    initialized: false,

    startedAt: null,

    deadline: null,

    timerInterval: null,

    submitting: false,

    lastFocusedElement: null

};


const elements = {};


/* =====================================================
   03. GENERAL UTILITIES
===================================================== */

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


function cleanText(value, fallback = "") {

    if (typeof value !== "string") {
        return fallback;
    }

    return value.trim() || fallback;

}


function numberOr(value, fallback = 0) {

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


function normalizeCollection(collection) {

    if (!collection || typeof collection !== "object") {
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
                id: cleanId(id)
            };

        })

        .filter(item => item && item.id);

}


/* =====================================================
   04. EXAMINATION STATUS
===================================================== */

function showStatus(title, description, isError = false) {

    elements.statusSection.hidden = false;

    elements.instructions.hidden = true;

    elements.workspace.hidden = true;

    elements.statusTitle.textContent = title;

    elements.statusDescription.textContent = description;

    elements.statusSpinner.hidden = isError;

    elements.statusBackLink.hidden = !isError;

}


function hideStatus() {

    elements.statusSection.hidden = true;

}


/* =====================================================
   05. LOAD EXAMINATION
===================================================== */

async function loadExamination() {

    const params = new URLSearchParams(
        window.location.search
    );

    state.testId = cleanId(
        params.get("test") || ""
    );

    if (!state.testId) {

        showStatus(
            "No Mock Test Selected",
            "Please select a published mock test from the test directory.",
            true
        );

        return;

    }

    if (!isDatabaseConfigured()) {

        showStatus(
            "Database Not Configured",
            "The examination database is not configured yet.",
            true
        );

        return;

    }

    showStatus(
        "Loading Mock Test",
        "Please wait while the examination is being prepared."
    );

    try {

        const [testData, questionData] = await Promise.all([

            readData(`public/tests/${state.testId}`),

            readData(`public/testQuestions/${state.testId}`)

        ]);

        if (
            !testData ||
            typeof testData !== "object" ||
            testData.published !== true
        ) {

            showStatus(
                "Mock Test Unavailable",
                "This examination is not published or could not be found.",
                true
            );

            return;

        }

        const questions = normalizeCollection(
            questionData
        )

            .filter(question => {

                return (
                    question.published === true &&
                    cleanText(question.question) &&
                    question.options &&
                    typeof question.options === "object"
                );

            })

            .sort((a, b) => {

                return numberOr(a.order) -
                    numberOr(b.order);

            });

        /*
         * Validate question structure before allowing
         * a student to begin the examination.
         */

        const validQuestions = questions.filter(question => {

            const options = normalizeOptions(
                question.options
            );

            const correctAnswer = cleanId(
                question.correctOptionId
            );

            return (
                options.length >= 2 &&
                options.some(
                    option => option.id === correctAnswer
                )
            );

        });

        if (
            validQuestions.length === 0 ||
            validQuestions.length !== questions.length
        ) {

            showStatus(
                "Examination Not Ready",
                "This test has no valid published questions or contains incomplete question records.",
                true
            );

            return;

        }

        state.test = {
            ...testData,
            id: state.testId
        };

        state.questions = validQuestions;

        renderInstructions();

    } catch (error) {

        console.error(
            "[Yadav ExamPrep] Examination loading failed:",
            error
        );

        showStatus(
            "Unable to Load Mock Test",
            "Please check your internet connection and try again.",
            true
        );

    }

}


/* =====================================================
   06. NORMALIZE ANSWER OPTIONS
===================================================== */

function normalizeOptions(options) {

    if (!options || typeof options !== "object") {
        return [];
    }

    return Object.entries(options)

        .map(([id, value]) => {

            const optionId = cleanId(id);

            const text = typeof value === "string"
                ? value
                : cleanText(value?.text);

            if (!optionId || !text) {
                return null;
            }

            return {
                id: optionId,
                text
            };

        })

        .filter(Boolean);

}


/* =====================================================
   07. MARKING SCHEME
===================================================== */

function getQuestionMarks(question) {

    return Math.max(

        0,

        numberOr(
            question.marks,
            numberOr(state.test?.marksPerQuestion, 1)
        )

    );

}


function getNegativeMarks(question) {

    return Math.max(

        0,

        numberOr(
            question.negativeMarks,
            numberOr(state.test?.negativeMarks, 0)
        )

    );

}


function getMaximumMarks() {

    return state.questions.reduce(

        (total, question) => {

            return total + getQuestionMarks(question);

        },

        0

    );

}


/* =====================================================
   08. EXAMINATION INSTRUCTIONS
===================================================== */

function renderInstructions() {

    const title = cleanText(
        state.test.title,
        "Mock Test"
    );

    const duration = Math.max(
        0,
        numberOr(state.test.duration, 0)
    );

    elements.instructionTitle.textContent = title;

    elements.instructionDescription.textContent =
        cleanText(state.test.description);

    elements.instructionQuestionCount.textContent =
        String(state.questions.length);

    elements.instructionDuration.textContent = duration > 0
        ? `${duration} minutes`
        : "Untimed";

    elements.instructionTotalMarks.textContent =
        String(getMaximumMarks());

    const negative = Math.max(
        0,
        numberOr(state.test.negativeMarks, 0)
    );

    const hasQuestionOverrides = state.questions.some(
        question => question.negativeMarks !== undefined
    );

    elements.instructionNegativeMarking.textContent =
        hasQuestionOverrides
            ? "Question-wise"
            : negative > 0
                ? `${negative} per incorrect answer`
                : "No";

    elements.agreement.checked = false;

    elements.startButton.disabled = true;

    hideStatus();

    elements.instructions.hidden = false;

    document.title = `${title} | Yadav ExamPrep`;

}


/* =====================================================
   09. START EXAMINATION
===================================================== */

function startExamination() {

    if (
        state.started ||
        state.submitted ||
        !elements.agreement.checked ||
        state.questions.length === 0
    ) {
        return;
    }

    state.started = true;

    state.startedAt = Date.now();

    state.currentIndex = 0;

    const duration = Math.max(
        0,
        numberOr(state.test.duration, 0)
    );

    state.deadline = duration > 0
        ? state.startedAt + duration * 60 * 1000
        : null;

    elements.instructions.hidden = true;

    elements.workspace.hidden = false;

    elements.activeTitle.textContent = cleanText(
        state.test.title,
        "Mock Test"
    );

    elements.activeSubtitle.textContent = cleanText(
        state.test.description
    );

    renderQuestion();

    updateStatistics();

    startTimer();

}


/* =====================================================
   10. EXAMINATION TIMER
===================================================== */

function formatTime(milliseconds) {

    const totalSeconds = Math.max(
        0,
        Math.ceil(milliseconds / 1000)
    );

    const hours = Math.floor(
        totalSeconds / 3600
    );

    const minutes = Math.floor(
        (totalSeconds % 3600) / 60
    );

    const seconds = totalSeconds % 60;

    const pad = value => String(value).padStart(2, "0");

    return hours > 0
        ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
        : `${pad(minutes)}:${pad(seconds)}`;

}


function stopTimer() {

    if (state.timerInterval !== null) {

        window.clearInterval(
            state.timerInterval
        );

        state.timerInterval = null;

    }

}


function updateTimer() {

    if (
        !state.started ||
        state.submitted
    ) {
        return;
    }

    if (state.deadline === null) {

        elements.timerValue.textContent = "Untimed";

        return;

    }

    const remaining = state.deadline - Date.now();

    elements.timerValue.textContent = formatTime(
        remaining
    );

    elements.timer.classList.toggle(
        "is-warning",
        remaining > 0 && remaining <= 60000
    );

    if (remaining <= 0) {

        stopTimer();

        submitExamination();

    }

}


function startTimer() {

    stopTimer();

    updateTimer();

    if (state.deadline !== null && !state.submitted) {

        state.timerInterval = window.setInterval(
            updateTimer,
            250
        );

    }

}


/* =====================================================
   11. CURRENT QUESTION
===================================================== */

function currentQuestion() {

    return state.questions[
        state.currentIndex
    ] || null;

}


/* =====================================================
   12. RENDER QUESTION
===================================================== */

function renderQuestion() {

    if (!state.started || state.submitted) {
        return;
    }

    const question = currentQuestion();

    if (!question) {
        return;
    }

    const number = state.currentIndex + 1;

    elements.questionCategory.textContent =
        cleanText(question.category, "Question");

    elements.questionTitle.textContent =
        `Question ${number}`;

    elements.questionMarks.textContent =
        `${getQuestionMarks(question)} marks`;

    elements.questionContent.replaceChildren(

        createElement(
            "p",
            "",
            cleanText(question.question)
        )

    );

    renderAnswerOptions(question);

    const reviewed = state.reviewed.has(
        question.id
    );

    elements.reviewButton.setAttribute(
        "aria-pressed",
        String(reviewed)
    );

    elements.reviewButton.textContent = reviewed
        ? "Remove Review Mark"
        : "Mark for Review";

    elements.clearButton.disabled =
        state.answers[question.id] === undefined;

    elements.previousButton.disabled =
        state.currentIndex === 0;

    elements.nextButton.textContent =
        state.currentIndex === state.questions.length - 1
            ? "Review & Submit"
            : "Save & Next";

    renderPalette();

    updateStatistics();

}


/* =====================================================
   13. ANSWER OPTIONS
===================================================== */

function renderAnswerOptions(question) {

    const fragment = document.createDocumentFragment();

    const options = normalizeOptions(
        question.options
    );

    options.forEach((option, index) => {

        const label = createElement(
            "label",
            "exam-answer-option"
        );

        const input = createElement("input");

        input.type = "radio";

        input.name = "examAnswer";

        input.value = option.id;

        input.checked =
            state.answers[question.id] === option.id;

        const letter = createElement(
            "span",
            "option-letter",
            String.fromCharCode(65 + index)
        );

        const text = createElement(
            "span",
            "option-text",
            option.text
        );

        input.addEventListener("change", () => {

            if (state.submitted) {
                return;
            }

            state.answers[question.id] = option.id;

            elements.clearButton.disabled = false;

            renderPalette();

            updateStatistics();

        });

        label.append(
            input,
            letter,
            text
        );

        fragment.appendChild(label);

    });

    elements.answerOptions.replaceChildren(fragment);

}


/* =====================================================
   14. CLEAR ANSWER / REVIEW
===================================================== */

function clearCurrentAnswer() {

    const question = currentQuestion();

    if (!question || state.submitted) {
        return;
    }

    delete state.answers[question.id];

    renderQuestion();

}


function toggleCurrentReview() {

    const question = currentQuestion();

    if (!question || state.submitted) {
        return;
    }

    if (state.reviewed.has(question.id)) {

        state.reviewed.delete(question.id);

    } else {

        state.reviewed.add(question.id);

    }

    renderQuestion();

}


/* =====================================================
   15. QUESTION NAVIGATION
===================================================== */

function goToQuestion(index) {

    if (
        !state.started ||
        state.submitted ||
        index < 0 ||
        index >= state.questions.length
    ) {
        return;
    }

    state.currentIndex = index;

    renderQuestion();

}


function goToNextQuestion() {

    if (
        state.currentIndex >= state.questions.length - 1
    ) {

        openSubmitModal();

        return;

    }

    goToQuestion(
        state.currentIndex + 1
    );

}


/* =====================================================
   16. QUESTION STATISTICS
===================================================== */

function getStatistics() {

    const total = state.questions.length;

    const answered = state.questions.filter(
        question => state.answers[question.id] !== undefined
    ).length;

    const review = state.questions.filter(
        question => state.reviewed.has(question.id)
    ).length;

    return {

        total,

        answered,

        unanswered: total - answered,

        review

    };

}


function updateStatistics() {

    const stats = getStatistics();

    elements.answeredCount.textContent =
        String(stats.answered);

    elements.unansweredCount.textContent =
        String(stats.unanswered);

    elements.reviewCount.textContent =
        String(stats.review);

    elements.totalCount.textContent =
        String(stats.total);

    const percentage = stats.total > 0
        ? Math.round(
            (stats.answered / stats.total) * 100
        )
        : 0;

    elements.progressText.textContent =
        `${stats.answered} of ${stats.total} questions answered`;

    elements.progressPercentage.textContent =
        `${percentage}%`;

    elements.progressTrack.setAttribute(
        "aria-valuenow",
        String(percentage)
    );

    elements.progressFill.style.width =
        `${percentage}%`;

}


/* =====================================================
   17. QUESTION PALETTE
===================================================== */

function renderPalette() {

    const fragment = document.createDocumentFragment();

    state.questions.forEach((question, index) => {

        const button = createElement(
            "button",
            "exam-palette-button",
            String(index + 1)
        );

        button.type = "button";

        const answered =
            state.answers[question.id] !== undefined;

        const reviewed =
            state.reviewed.has(question.id);

        const current =
            index === state.currentIndex;

        button.classList.add(
            answered ? "is-answered" : "is-unanswered"
        );

        if (reviewed) {
            button.classList.add("is-review");
        }

        if (current) {

            button.classList.add("is-current");

            button.setAttribute(
                "aria-current",
                "step"
            );

        }

        const status = [

            answered ? "answered" : "unanswered",

            reviewed ? "marked for review" : "",

            current ? "current question" : ""

        ].filter(Boolean).join(", ");

        button.setAttribute(
            "aria-label",
            `Question ${index + 1}: ${status}`
        );

        button.addEventListener("click", () => {

            goToQuestion(index);

        });

        fragment.appendChild(button);

    });

    elements.palette.replaceChildren(fragment);

}


/* =====================================================
   18. SUBMISSION CONFIRMATION
===================================================== */

function openSubmitModal() {

    if (
        !state.started ||
        state.submitted ||
        state.submitting
    ) {
        return;
    }

    const stats = getStatistics();

    elements.modalAnswered.textContent =
        String(stats.answered);

    elements.modalUnanswered.textContent =
        String(stats.unanswered);

    elements.modalReview.textContent =
        String(stats.review);

    state.lastFocusedElement =
        document.activeElement;

    elements.modal.hidden = false;

    elements.cancelSubmit.focus();

}


function closeSubmitModal() {

    elements.modal.hidden = true;

    if (
        state.lastFocusedElement &&
        typeof state.lastFocusedElement.focus === "function"
    ) {

        state.lastFocusedElement.focus();

    }

}


/* =====================================================
   19. CALCULATE EXAMINATION RESULT
===================================================== */

function calculateResult() {

    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;

    let obtainedMarks = 0;

    const review = state.questions.map(
        (question, index) => {

            const selectedOptionId =
                state.answers[question.id] ?? null;

            const correctOptionId = cleanId(
                question.correctOptionId
            );

            const marks = getQuestionMarks(question);

            const negativeMarks = getNegativeMarks(question);

            let status = "unanswered";

            let awardedMarks = 0;

            if (selectedOptionId === null) {

                unanswered++;

            } else if (
                selectedOptionId === correctOptionId
            ) {

                correct++;

                status = "correct";

                awardedMarks = marks;

            } else {

                incorrect++;

                status = "incorrect";

                awardedMarks = -negativeMarks;

            }

            obtainedMarks += awardedMarks;

            return {

                id: question.id,

                number: index + 1,

                question: cleanText(question.question),

                options: normalizeOptions(question.options),

                selectedOptionId,

                correctOptionId,

                explanation: cleanText(question.explanation),

                marks,

                negativeMarks,

                awardedMarks,

                status,

                markedForReview: state.reviewed.has(
                    question.id
                )

            };

        }
    );

    const maximumMarks = getMaximumMarks();

    const percentage = maximumMarks > 0
        ? (obtainedMarks / maximumMarks) * 100
        : 0;

    return {

        version: 1,

        testId: state.testId,

        testTitle: cleanText(
            state.test.title,
            "Mock Test"
        ),

        startedAt: state.startedAt,

        submittedAt: Date.now(),

        durationMinutes: Math.max(
            0,
            numberOr(state.test.duration, 0)
        ),

        totalQuestions: state.questions.length,

        correct,

        incorrect,

        unanswered,

        obtainedMarks: Number(
            obtainedMarks.toFixed(2)
        ),

        maximumMarks: Number(
            maximumMarks.toFixed(2)
        ),

        percentage: Number(
            percentage.toFixed(2)
        ),

        review

    };

}


/* =====================================================
   20. SUBMIT EXAMINATION
===================================================== */

function submitExamination() {

    if (
        !state.started ||
        state.submitted ||
        state.submitting
    ) {
        return;
    }

    state.submitting = true;

    stopTimer();

    closeSubmitModal();

    const result = calculateResult();

    try {

        /*
         * Results are stored locally because public
         * students do not need an account.
         *
         * No examination result is written to Firebase.
         */

        sessionStorage.setItem(

            CONFIG.resultStorageKey,

            JSON.stringify(result)

        );

        state.submitted = true;

        window.location.assign("result.html");

    } catch (error) {

        console.error(
            "[Yadav ExamPrep] Result storage failed:",
            error
        );

        state.submitting = false;

        showStatus(
            "Unable to Save Result",
            "Your browser could not store the examination result. Please check your browser storage settings.",
            true
        );

    }

}


/* =====================================================
   21. REGISTER EVENTS
===================================================== */

function registerEvents() {

    elements.agreement.addEventListener(
        "change",
        () => {

            elements.startButton.disabled =
                !elements.agreement.checked;

        }
    );

    elements.startButton.addEventListener(
        "click",
        startExamination
    );

    elements.clearButton.addEventListener(
        "click",
        clearCurrentAnswer
    );

    elements.reviewButton.addEventListener(
        "click",
        toggleCurrentReview
    );

    elements.previousButton.addEventListener(
        "click",
        () => {

            goToQuestion(
                state.currentIndex - 1
            );

        }
    );

    elements.nextButton.addEventListener(
        "click",
        goToNextQuestion
    );

    elements.submitButton.addEventListener(
        "click",
        openSubmitModal
    );

    elements.sidebarSubmitButton.addEventListener(
        "click",
        openSubmitModal
    );

    elements.cancelSubmit.addEventListener(
        "click",
        closeSubmitModal
    );

    elements.confirmSubmit.addEventListener(
        "click",
        submitExamination
    );

    /*
     * Keyboard handling for the confirmation dialog.
     */

    document.addEventListener("keydown", event => {

        if (elements.modal.hidden) {
            return;
        }

        if (event.key === "Escape") {

            event.preventDefault();

            closeSubmitModal();

        }

        if (event.key === "Tab") {

            const first = elements.cancelSubmit;
            const last = elements.confirmSubmit;

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

    });

    /*
     * Recalculate against the actual deadline whenever
     * the student returns to the browser tab.
     */

    document.addEventListener(
        "visibilitychange",
        () => {

            if (!document.hidden) {
                updateTimer();
            }

        }
    );

}


/* =====================================================
   22. INITIALIZE EXAMINATION
===================================================== */

function initializeExamination() {

    if (
        document.body.dataset.page !== "mock-test" ||
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
            "[Yadav ExamPrep] Missing examination elements:",
            missing
        );

        return;

    }

    state.initialized = true;

    registerEvents();

    loadExamination();

}


/* =====================================================
   23. CLEANUP
===================================================== */

window.addEventListener("pagehide", () => {

    stopTimer();

});


/* =====================================================
   24. SAFE INITIALIZATION
===================================================== */

if (document.readyState === "loading") {

    document.addEventListener(

        "DOMContentLoaded",

        initializeExamination,

        { once: true }

    );

} else {

    initializeExamination();

}
