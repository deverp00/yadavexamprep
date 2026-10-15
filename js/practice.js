
/*
=========================================================
YADAV EXAMPREP
File: js/practice.js

Public Topic-Wise Question Practice Controller

Designed and Developed by Yadav Web Technologies

DATABASE:
    public/exams
    public/subjects
    public/topics
    public/questions

IMPORTANT:
- Firebase Realtime Database only.
- No public login or payment.
- Only published content is eligible.
- No sample, default or fabricated questions.
- Practice results remain in the current browser session.
- Answers are checked locally, not server-proctored.
=========================================================
*/

"use strict";

import {
    database,
    isDatabaseConfigured
} from "./firebase-config.js";

import {
    ref,
    get,
    onValue
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";


/* =====================================================
   01. CONFIGURATION
===================================================== */

const CONFIG = Object.freeze({

    paths: {
        exams: "public/exams",
        subjects: "public/subjects",
        topics: "public/topics",
        questions: "public/questions"
    },

    allowedLimits: ["10", "20", "30", "all"],

    defaultLimit: "10",

    optionKeys: ["A", "B", "C", "D"]

});


/* =====================================================
   02. ELEMENT SELECTORS
===================================================== */

const SELECTORS = {

    pageTitle: "#practicePageTitle",
    pageDescription: "#practicePageDescription",

    selectionSection: "#practiceSelectionSection",
    selectionForm: "#practiceSelectionForm",
    examSelect: "#practiceExamSelect",
    subjectSelect: "#practiceSubjectSelect",
    topicSelect: "#practiceTopicSelect",
    limitSelect: "#practiceQuestionLimit",
    startButton: "#startPracticeButton",

    statusSection: "#practiceStatusSection",
    status: "#practiceStatus",
    statusSpinner: "#practiceStatusSpinner",
    statusTitle: "#practiceStatusTitle",
    statusDescription: "#practiceStatusDescription",

    workspace: "#practiceWorkspace",
    workspaceTitle: "#practiceWorkspaceTitle",
    workspaceSubtitle: "#practiceWorkspaceSubtitle",
    exitButton: "#exitPracticeButton",

    progressText: "#practiceProgressText",
    progressPercentage: "#practiceProgressPercentage",
    progressTrack: "#practiceProgressTrack",
    progressFill: "#practiceProgressFill",

    questionCard: "#practiceQuestionCard",
    questionCategory: "#practiceQuestionCategory",
    questionNumber: "#practiceQuestionNumber",
    questionTitle: "#practiceQuestionTitle",
    questionContent: "#practiceQuestionContent",
    answerFieldset: "#practiceAnswerFieldset",
    answerOptions: "#practiceAnswerOptions",

    feedback: "#practiceFeedback",
    feedbackTitle: "#practiceFeedbackTitle",
    feedbackMessage: "#practiceFeedbackMessage",

    explanationPanel: "#practiceExplanationPanel",
    explanationText: "#practiceExplanationText",

    checkButton: "#checkPracticeAnswerButton",
    skipButton: "#skipPracticeQuestionButton",
    nextButton: "#nextPracticeQuestionButton",

    totalCount: "#practiceTotalCount",
    correctCount: "#practiceCorrectCount",
    incorrectCount: "#practiceIncorrectCount",
    skippedCount: "#practiceSkippedCount",

    resultSection: "#practiceResultSection",
    resultTitle: "#practiceResultTitle",
    resultDescription: "#practiceResultDescription",
    resultTotal: "#practiceResultTotal",
    resultCorrect: "#practiceResultCorrect",
    resultIncorrect: "#practiceResultIncorrect",
    resultSkipped: "#practiceResultSkipped",
    resultAccuracy: "#practiceResultAccuracy",

    restartButton: "#restartPracticeButton",
    changeTopicButton: "#changePracticeTopicButton",

    year: "#currentYear"

};


/* =====================================================
   03. STATE
===================================================== */

const state = {

    initialized: false,
    loading: true,
    starting: false,
    active: false,
    finished: false,

    exams: [],
    subjects: [],
    topics: [],
    questions: [],

    selectedExamId: "",
    selectedSubjectId: "",
    selectedTopicId: "",

    sessionQuestions: [],
    responses: [],

    currentIndex: 0,
    selectedAnswer: "",
    questionResolved: false,

    unsubscribe: [],

    loadVersion: 0,

    initialURL: null

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

function create(tag, className = "", text) {

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

function clean(value) {

    return typeof value === "string"
        ? value.trim()
        : "";

}

function validId(value) {

    return (
        typeof value === "string" &&
        value.length > 0 &&
        !/[.#$\[\]\/\u0000-\u001f\u007f]/.test(value)
    );

}

function orderOf(record) {

    const value = Number(record.order);

    return Number.isFinite(value)
        ? value
        : Number.MAX_SAFE_INTEGER;

}

function sortRecords(records) {

    return [...records].sort((a, b) => {

        return (
            orderOf(a) - orderOf(b)
        ) || clean(a.name || a.question).localeCompare(
            clean(b.name || b.question)
        );

    });

}

function published(record) {

    return record?.published === true;

}

function findRecord(collection, id) {

    return state[collection].find(
        record => record.id === id
    ) || null;

}

function showSection(section) {

    el.selectionSection.hidden =
        section !== "selection";

    el.workspace.hidden =
        section !== "workspace";

    el.resultSection.hidden =
        section !== "result";

}

function showStatus(title, description, loading = false) {

    el.statusSection.hidden = false;

    el.status.hidden = false;

    el.statusSpinner.hidden = !loading;

    setText(el.statusTitle, title);
    setText(el.statusDescription, description);

}

function hideStatus() {

    el.statusSection.hidden = true;

}

function createOption(value, label) {

    const option = document.createElement("option");

    option.value = value;
    option.textContent = label;

    return option;

}

function populateSelect(
    select,
    records,
    placeholder,
    selectedId = ""
) {

    select.replaceChildren(
        createOption("", placeholder)
    );

    records.forEach(record => {

        select.append(
            createOption(
                record.id,
                clean(record.name)
            )
        );

    });

    if (
        selectedId &&
        records.some(record => record.id === selectedId)
    ) {

        select.value = selectedId;

    } else {

        select.value = "";

    }

    select.disabled =
        state.loading ||
        state.starting ||
        state.active ||
        records.length === 0;

}


/* =====================================================
   05. URL PARAMETERS
===================================================== */

function readInitialURL() {

    const params = new URLSearchParams(
        window.location.search
    );

    state.initialURL = {

        exam: params.get("exam") || "",
        subject: params.get("subject") || "",
        topic: params.get("topic") || ""

    };

}

function synchronizeURL() {

    const url = new URL(
        window.location.href
    );

    const values = {

        exam: state.selectedExamId,
        subject: state.selectedSubjectId,
        topic: state.selectedTopicId

    };

    Object.entries(values).forEach(([key, value]) => {

        if (value) {
            url.searchParams.set(key, value);
        } else {
            url.searchParams.delete(key);
        }

    });

    window.history.replaceState(
        null,
        "",
        url
    );

}


/* =====================================================
   06. ELIGIBLE CONTENT
===================================================== */

function eligibleExams() {

    return sortRecords(
        state.exams.filter(record =>
            published(record) &&
            validId(record.id) &&
            clean(record.name)
        )
    );

}

function eligibleSubjects(examId) {

    if (!findRecord("exams", examId)) {
        return [];
    }

    return sortRecords(
        state.subjects.filter(record =>
            published(record) &&
            validId(record.id) &&
            clean(record.name) &&
            record.examId === examId
        )
    );

}

function eligibleTopics(subjectId) {

    const subject = findRecord(
        "subjects",
        subjectId
    );

    if (
        !subject ||
        !published(subject) ||
        subject.examId !== state.selectedExamId
    ) {
        return [];
    }

    return sortRecords(
        state.topics.filter(record =>
            published(record) &&
            validId(record.id) &&
            clean(record.name) &&
            record.examId === state.selectedExamId &&
            record.subjectId === subjectId
        )
    );

}

function validQuestion(question) {

    if (
        !published(question) ||
        !validId(question.id) ||
        !clean(question.question)
    ) {
        return false;
    }

    if (
        question.examId !== state.selectedExamId ||
        question.subjectId !== state.selectedSubjectId ||
        question.topicId !== state.selectedTopicId
    ) {
        return false;
    }

    const options = question.options;

    if (
        !options ||
        typeof options !== "object" ||
        Array.isArray(options)
    ) {
        return false;
    }

    if (
        !CONFIG.optionKeys.every(key =>
            clean(options[key])
        )
    ) {
        return false;
    }

    return CONFIG.optionKeys.includes(
        question.correctOptionId
    );

}


/* =====================================================
   07. CASCADING SELECTION
===================================================== */

function updateStartButton() {

    el.startButton.disabled = (
        state.loading ||
        state.starting ||
        state.active ||
        !state.selectedExamId ||
        !state.selectedSubjectId ||
        !state.selectedTopicId
    );

    el.limitSelect.disabled =
        state.loading ||
        state.starting ||
        state.active;

}

function populateExams() {

    const records = eligibleExams();

    populateSelect(
        el.examSelect,
        records,
        records.length
            ? "Select examination"
            : "No published examinations",
        state.selectedExamId
    );

    state.selectedExamId = el.examSelect.value;

}

function populateSubjects() {

    const records = eligibleSubjects(
        state.selectedExamId
    );

    populateSelect(
        el.subjectSelect,
        records,
        state.selectedExamId
            ? (
                records.length
                    ? "Select subject"
                    : "No published subjects"
            )
            : "Select an examination first",
        state.selectedSubjectId
    );

    state.selectedSubjectId =
        el.subjectSelect.value;

}

function populateTopics() {

    const records = eligibleTopics(
        state.selectedSubjectId
    );

    populateSelect(
        el.topicSelect,
        records,
        state.selectedSubjectId
            ? (
                records.length
                    ? "Select topic"
                    : "No published topics"
            )
            : "Select a subject first",
        state.selectedTopicId
    );

    state.selectedTopicId =
        el.topicSelect.value;

    updateStartButton();

}

function refreshSelectors() {

    populateExams();
    populateSubjects();
    populateTopics();

    synchronizeURL();

}

function handleExamChange() {

    state.selectedExamId =
        el.examSelect.value;

    state.selectedSubjectId = "";
    state.selectedTopicId = "";

    populateSubjects();
    populateTopics();

    synchronizeURL();

}

function handleSubjectChange() {

    state.selectedSubjectId =
        el.subjectSelect.value;

    state.selectedTopicId = "";

    populateTopics();

    synchronizeURL();

}

function handleTopicChange() {

    state.selectedTopicId =
        el.topicSelect.value;

    updateStartButton();

    synchronizeURL();

}


/* =====================================================
   08. LOAD PUBLIC CONTENT
===================================================== */

function subscribeContent() {

    if (
        !isDatabaseConfigured() ||
        !database
    ) {

        state.loading = false;

        showStatus(
            "Practice Unavailable",
            "The Firebase Realtime Database connection has not been configured."
        );

        refreshSelectors();

        return;

    }

    const received = {
        exams: false,
        subjects: false,
        topics: false
    };

    const version = ++state.loadVersion;

    ["exams", "subjects", "topics"].forEach(collection => {

        const unsubscribe = onValue(

            ref(
                database,
                CONFIG.paths[collection]
            ),

            snapshot => {

                if (version !== state.loadVersion) {
                    return;
                }

                state[collection] = normalizeCollection(
                    snapshot.val()
                );

                received[collection] = true;

                if (
                    !Object.values(received).every(Boolean)
                ) {
                    return;
                }

                state.loading = false;

                if (state.initialURL) {

                    state.selectedExamId =
                        state.initialURL.exam;

                    state.selectedSubjectId =
                        state.initialURL.subject;

                    state.selectedTopicId =
                        state.initialURL.topic;

                    state.initialURL = null;

                }

                if (!state.active) {

                    refreshSelectors();

                    if (eligibleExams().length) {

                        hideStatus();

                    } else {

                        showStatus(
                            "No Published Examinations",
                            "Practice will become available when examination content is published by the administrator."
                        );

                    }

                }

            },

            error => {

                if (version !== state.loadVersion) {
                    return;
                }

                console.error(
                    `[Practice] ${collection}:`,
                    error?.code
                );

                state.loading = true;

                showStatus(
                    "Unable to Load Practice Content",
                    "Please check your connection and try again later."
                );

                updateStartButton();

            }

        );

        state.unsubscribe.push(unsubscribe);

    });

}


/* =====================================================
   09. QUESTION LOADING
===================================================== */

async function loadQuestions() {

    const snapshot = await get(
        ref(
            database,
            CONFIG.paths.questions
        )
    );

    return sortRecords(
        normalizeCollection(snapshot.val())
            .filter(validQuestion)
    );

}

function selectedLimit() {

    const value = el.limitSelect.value;

    if (!CONFIG.allowedLimits.includes(value)) {
        return CONFIG.defaultLimit;
    }

    return value;

}

function prepareSession(questions) {

    const limit = selectedLimit();

    state.sessionQuestions = limit === "all"
        ? [...questions]
        : questions.slice(0, Number(limit));

    state.responses = [];

    state.currentIndex = 0;
    state.selectedAnswer = "";
    state.questionResolved = false;

    state.active = true;
    state.finished = false;

}


/* =====================================================
   10. START PRACTICE
===================================================== */

async function startPractice(event) {

    event?.preventDefault();

    if (
        state.loading ||
        state.starting ||
        state.active ||
        !database
    ) {
        return;
    }

    const exam = findRecord(
        "exams",
        state.selectedExamId
    );

    const subject = findRecord(
        "subjects",
        state.selectedSubjectId
    );

    const topic = findRecord(
        "topics",
        state.selectedTopicId
    );

    if (
        !published(exam) ||
        !published(subject) ||
        !published(topic) ||
        subject.examId !== exam.id ||
        topic.examId !== exam.id ||
        topic.subjectId !== subject.id
    ) {

        showStatus(
            "Invalid Practice Selection",
            "Select a valid published examination, subject and topic."
        );

        return;

    }

    state.starting = true;

    const version = ++state.loadVersion;

    updateStartButton();

    showStatus(
        "Preparing Your Practice",
        "Loading available published questions...",
        true
    );

    try {

        const questions = await loadQuestions();

        if (version !== state.loadVersion) {
            return;
        }

        if (!questions.length) {

            showStatus(
                "No Practice Questions Available",
                "This topic does not currently contain any eligible published questions. Select another topic or visit again later."
            );

            return;

        }

        state.questions = questions;

        prepareSession(questions);

        setText(
            el.workspaceTitle,
            topic.name
        );

        setText(
            el.workspaceSubtitle,
            `${exam.name} / ${subject.name}`
        );

        hideStatus();

        showSection("workspace");

        renderQuestion();

        el.workspace.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {

        console.error(
            "[Practice] Question loading:",
            error?.code || error?.message
        );

        showStatus(
            "Unable to Start Practice",
            "The questions could not be loaded. Please try again."
        );

    } finally {

        state.starting = false;

        updateStartButton();

    }

}


/* =====================================================
   11. CURRENT QUESTION
===================================================== */

function currentQuestion() {

    return state.sessionQuestions[
        state.currentIndex
    ] || null;

}

function createAnswerOption(question, key) {

    const label = create(
        "label",
        "exam-answer-option"
    );

    const input = create("input");

    input.type = "radio";
    input.name = "practiceAnswer";
    input.value = key;

    input.checked =
        state.selectedAnswer === key;

    input.disabled =
        state.questionResolved;

    const letter = create(
        "span",
        "option-letter",
        key
    );

    const text = create(
        "span",
        "option-text",
        clean(question.options[key])
    );

    label.append(
        input,
        letter,
        text
    );

    input.addEventListener("change", () => {

        if (state.questionResolved) {
            return;
        }

        state.selectedAnswer = key;

        el.checkButton.disabled = false;

    });

    return label;

}

function renderAnswerOptions(question) {

    el.answerOptions.replaceChildren();

    const fragment =
        document.createDocumentFragment();

    CONFIG.optionKeys.forEach(key => {

        fragment.append(
            createAnswerOption(question, key)
        );

    });

    el.answerOptions.append(fragment);

}

function renderQuestion() {

    const question = currentQuestion();

    if (!question) {

        finishPractice();
        return;

    }

    state.selectedAnswer = "";
    state.questionResolved = false;

    const number = state.currentIndex + 1;
    const total = state.sessionQuestions.length;

    setText(
        el.questionNumber,
        `Question ${number} of ${total}`
    );

    setText(
        el.questionTitle,
        `Question ${number}`
    );

    setText(
        el.questionCategory,
        findRecord(
            "topics",
            state.selectedTopicId
        )?.name || "Topic Practice"
    );

    setText(
        el.questionContent,
        clean(question.question)
    );

    renderAnswerOptions(question);

    el.answerFieldset.disabled = false;

    el.feedback.hidden = true;
    el.explanationPanel.hidden = true;

    el.feedback.classList.remove(
        "is-success",
        "is-error"
    );

    el.checkButton.hidden = false;
    el.checkButton.disabled = true;

    el.skipButton.hidden = false;

    el.nextButton.hidden = true;

    setText(
        el.nextButton,
        number === total
            ? "View Results"
            : "Next Question"
    );

    updateProgress();
    updateStatistics();

}


/* =====================================================
   12. ANSWER FEEDBACK
===================================================== */

function showFeedback(
    correct,
    correctKey,
    explanation
) {

    el.feedback.hidden = false;

    el.feedback.classList.remove(
        "is-success",
        "is-error"
    );

    el.feedback.classList.add(
        correct
            ? "is-success"
            : "is-error"
    );

    setText(
        el.feedbackTitle,
        correct
            ? "Correct Answer"
            : "Incorrect Answer"
    );

    setText(
        el.feedbackMessage,
        correct
            ? "Your selected answer is correct."
            : `The correct answer is Option ${correctKey}.`
    );

    if (clean(explanation)) {

        el.explanationPanel.hidden = false;

        setText(
            el.explanationText,
            explanation
        );

    } else {

        el.explanationPanel.hidden = true;

    }

}

function highlightResolvedOptions(
    question,
    selectedKey
) {

    el.answerOptions.querySelectorAll(
        'input[name="practiceAnswer"]'
    ).forEach(input => {

        input.disabled = true;

        const label = input.closest(
            ".exam-answer-option"
        );

        if (!label) {
            return;
        }

        if (
            input.value === question.correctOptionId
        ) {

            label.classList.add(
                "is-correct"
            );

        } else if (
            input.value === selectedKey
        ) {

            label.classList.add(
                "is-incorrect"
            );

        }

    });

}

function resolveQuestion(
    status,
    selectedKey = ""
) {

    if (
        !state.active ||
        state.questionResolved
    ) {
        return;
    }

    const question = currentQuestion();

    if (!question) {
        return;
    }

    state.questionResolved = true;

    state.responses.push({

        questionId: question.id,

        selectedOptionId: selectedKey,

        correctOptionId:
            question.correctOptionId,

        status

    });

    el.answerFieldset.disabled = true;

    el.checkButton.hidden = true;
    el.skipButton.hidden = true;

    el.nextButton.hidden = false;

    highlightResolvedOptions(
        question,
        selectedKey
    );

    if (status === "skipped") {

        el.feedback.hidden = false;

        el.feedback.classList.remove(
            "is-success",
            "is-error"
        );

        setText(
            el.feedbackTitle,
            "Question Skipped"
        );

        setText(
            el.feedbackMessage,
            `The correct answer is Option ${question.correctOptionId}.`
        );

        if (clean(question.explanation)) {

            el.explanationPanel.hidden = false;

            setText(
                el.explanationText,
                question.explanation
            );

        }

    } else {

        showFeedback(
            status === "correct",
            question.correctOptionId,
            question.explanation
        );

    }

    updateProgress();
    updateStatistics();

    el.nextButton.focus();

}

function checkAnswer() {

    if (
        !state.active ||
        state.questionResolved ||
        !state.selectedAnswer
    ) {
        return;
    }

    const question = currentQuestion();

    resolveQuestion(
        state.selectedAnswer === question.correctOptionId
            ? "correct"
            : "incorrect",
        state.selectedAnswer
    );

}

function skipQuestion() {

    resolveQuestion("skipped");

}


/* =====================================================
   13. PROGRESS AND STATISTICS
===================================================== */

function countResponses(status) {

    return state.responses.filter(
        response => response.status === status
    ).length;

}

function updateStatistics() {

    setText(
        el.totalCount,
        state.sessionQuestions.length
    );

    setText(
        el.correctCount,
        countResponses("correct")
    );

    setText(
        el.incorrectCount,
        countResponses("incorrect")
    );

    setText(
        el.skippedCount,
        countResponses("skipped")
    );

}

function updateProgress() {

    const total = state.sessionQuestions.length;

    const completed = state.responses.length;

    const percentage = total
        ? Math.round(
            (completed / total) * 100
        )
        : 0;

    setText(
        el.progressText,
        `${completed} of ${total} questions completed`
    );

    setText(
        el.progressPercentage,
        `${percentage}%`
    );

    el.progressFill.style.width =
        `${percentage}%`;

    el.progressTrack.setAttribute(
        "aria-valuenow",
        String(percentage)
    );

}


/* =====================================================
   14. NEXT QUESTION
===================================================== */

function nextQuestion() {

    if (
        !state.active ||
        !state.questionResolved
    ) {
        return;
    }

    if (
        state.currentIndex + 1 >=
        state.sessionQuestions.length
    ) {

        finishPractice();
        return;

    }

    state.currentIndex++;

    renderQuestion();

    el.questionTitle.focus?.();

}


/* =====================================================
   15. COMPLETE SESSION
===================================================== */

function finishPractice() {

    if (!state.active) {
        return;
    }

    state.active = false;
    state.finished = true;

    const total =
        state.sessionQuestions.length;

    const correct =
        countResponses("correct");

    const incorrect =
        countResponses("incorrect");

    const skipped =
        countResponses("skipped");

    const attempted =
        correct + incorrect;

    /*
     * Accuracy excludes skipped questions.
     * The result also displays skipped count separately.
     */

    const accuracy = attempted
        ? Math.round(
            (correct / attempted) * 100
        )
        : 0;

    setText(
        el.resultTotal,
        total
    );

    setText(
        el.resultCorrect,
        correct
    );

    setText(
        el.resultIncorrect,
        incorrect
    );

    setText(
        el.resultSkipped,
        skipped
    );

    setText(
        el.resultAccuracy,
        `${accuracy}%`
    );

    const topic = findRecord(
        "topics",
        state.selectedTopicId
    );

    setText(
        el.resultDescription,
        topic
            ? `Your practice session for ${topic.name} is complete. Accuracy is calculated from attempted questions.`
            : "Your practice session is complete. Accuracy is calculated from attempted questions."
    );

    showSection("result");

    hideStatus();

    el.resultSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


/* =====================================================
   16. EXIT AND RESTART
===================================================== */

function resetSession() {

    state.active = false;
    state.finished = false;

    state.sessionQuestions = [];
    state.responses = [];

    state.currentIndex = 0;
    state.selectedAnswer = "";
    state.questionResolved = false;

    showSection("selection");

    refreshSelectors();

    if (eligibleExams().length) {

        hideStatus();

    } else {

        showStatus(
            "No Published Examinations",
            "There is currently no available practice content."
        );

    }

}

function exitPractice() {

    if (!state.active) {
        return;
    }

    const confirmed = window.confirm(
        "Exit this practice session? Your current session results will be discarded."
    );

    if (!confirmed) {
        return;
    }

    ++state.loadVersion;

    resetSession();

    el.selectionSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}

function restartPractice() {

    if (!state.finished) {
        return;
    }

    resetSession();

    startPractice();

}

function changeTopic() {

    resetSession();

    el.selectionSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


/* =====================================================
   17. REGISTER EVENTS
===================================================== */

function registerEvents() {

    el.examSelect.addEventListener(
        "change",
        handleExamChange
    );

    el.subjectSelect.addEventListener(
        "change",
        handleSubjectChange
    );

    el.topicSelect.addEventListener(
        "change",
        handleTopicChange
    );

    el.selectionForm.addEventListener(
        "submit",
        startPractice
    );

    el.checkButton.addEventListener(
        "click",
        checkAnswer
    );

    el.skipButton.addEventListener(
        "click",
        skipQuestion
    );

    el.nextButton.addEventListener(
        "click",
        nextQuestion
    );

    el.exitButton.addEventListener(
        "click",
        exitPractice
    );

    el.restartButton.addEventListener(
        "click",
        restartPractice
    );

    el.changeTopicButton.addEventListener(
        "click",
        changeTopic
    );

}


/* =====================================================
   18. CLEANUP
===================================================== */

function cleanup() {

    ++state.loadVersion;

    state.unsubscribe.forEach(unsubscribe => {

        if (typeof unsubscribe === "function") {
            unsubscribe();
        }

    });

    state.unsubscribe = [];

}


/* =====================================================
   19. INITIALIZATION
===================================================== */

function initialize() {

    if (
        state.initialized ||
        document.body.dataset.page !== "practice"
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
            "[Practice] Missing HTML elements:",
            missing
        );

        return;

    }

    state.initialized = true;

    setText(
        el.year,
        new Date().getFullYear()
    );

    readInitialURL();

    registerEvents();

    showSection("selection");

    showStatus(
        "Loading Practice Content",
        "Retrieving published examinations, subjects and topics.",
        true
    );

    updateStartButton();

    subscribeContent();

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
   END OF PRACTICE.JS
===================================================== */
