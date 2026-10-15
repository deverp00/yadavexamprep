
/*
=========================================================
YADAV EXAMPREP
File: js/learn.js

Public Learning System Controller

Designed and Developed by Yadav Web Technologies
=========================================================
*/

"use strict";

import {
    isDatabaseConfigured,
    subscribeToPublicContent,
    readData
} from "./firebase-config.js";


/* =====================================================
   01. CONFIGURATION
===================================================== */

const CONFIG = Object.freeze({

    progressKey: "yadav-examprep-learning-v1",

    selectors: {

        exam: "#learningExamSelect",
        subject: "#learningSubjectSelect",

        workspace: "#learningWorkspace",

        sidebar: "#learningSidebar",
        sidebarToggle: "#learningSidebarToggle",

        topicNavigation: "#learningTopicNavigation",

        examName: "#learningExamName",
        pageTitle: "#learningPageTitle",
        pageDescription: "#learningPageDescription",

        breadcrumbCurrent: "#breadcrumbCurrent",

        workspaceTitle: "#workspaceTitle",

        progressText: "#learningProgressText",
        progressTrack: "#learningProgressTrack",
        progressFill: "#learningProgressFill",

        lessonReader: "#lessonReader",
        lessonLoading: "#lessonLoadingState",
        lessonContent: "#lessonContent",

        lessonType: "#lessonTypeBadge",
        lessonPosition: "#lessonPosition",

        lessonTopic: "#lessonTopicName",
        lessonTitle: "#lessonTitle",
        lessonDescription: "#lessonDescription",
        lessonBody: "#lessonBody",

        completeButton: "#markLessonComplete",

        lessonNavigation: "#lessonNavigation",
        previousButton: "#previousLesson",
        nextButton: "#nextLesson",

        practicePanel: "#topicPracticePanel",
        practiceLink: "#topicPracticeLink",

        statusSection: "#learningStatusSection",
        status: "#learningStatus",
        statusTitle: "#learningStatusTitle",
        statusDescription: "#learningStatusDescription"

    }

});


/* =====================================================
   02. APPLICATION STATE
===================================================== */

const state = {

    exams: [],
    subjects: [],
    topics: [],
    lessons: [],

    examId: "",
    subjectId: "",
    lessonId: "",

    currentLessonIndex: -1,

    completedLessons: {},

    initialized: false,

    contentReceived: {
        exams: false,
        subjects: false
    },

    unsubscribe: null,

    requestVersion: 0

};


const elements = {};


/* =====================================================
   03. GENERAL UTILITIES
===================================================== */

function byId(selector) {

    return document.querySelector(selector);

}


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
        ? number
        : 0;

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


function isPublished(item) {

    return Boolean(
        item &&
        item.published === true &&
        cleanId(item.id)
    );

}


function sortByOrder(items) {

    return [...items].sort((a, b) => {

        const orderA = cleanNumber(a.order);
        const orderB = cleanNumber(b.order);

        if (orderA !== orderB) {
            return orderA - orderB;
        }

        return cleanText(
            a.title,
            cleanText(a.name)
        ).localeCompare(
            cleanText(
                b.title,
                cleanText(b.name)
            )
        );

    });

}


/* =====================================================
   04. URL PARAMETERS
===================================================== */

function readURL() {

    const params = new URLSearchParams(
        window.location.search
    );

    state.examId = cleanId(
        params.get("exam") || ""
    );

    state.subjectId = cleanId(
        params.get("subject") || ""
    );

    state.lessonId = cleanId(
        params.get("lesson") || ""
    );

}


function updateURL() {

    const url = new URL(window.location.href);

    ["exam", "subject", "lesson"].forEach(
        key => url.searchParams.delete(key)
    );

    if (state.examId) {
        url.searchParams.set("exam", state.examId);
    }

    if (state.subjectId) {
        url.searchParams.set("subject", state.subjectId);
    }

    if (state.lessonId) {
        url.searchParams.set("lesson", state.lessonId);
    }

    window.history.replaceState(
        null,
        "",
        url.pathname + url.search + url.hash
    );

}


/* =====================================================
   05. LOCAL LEARNING PROGRESS
===================================================== */

function loadProgress() {

    try {

        const stored = localStorage.getItem(
            CONFIG.progressKey
        );

        if (!stored) {
            return {};
        }

        const parsed = JSON.parse(stored);

        if (
            !parsed ||
            typeof parsed !== "object" ||
            Array.isArray(parsed)
        ) {
            return {};
        }

        return parsed;

    } catch (error) {

        console.warn(
            "[Yadav ExamPrep] Progress unavailable:",
            error
        );

        return {};

    }

}


function saveProgress() {

    try {

        localStorage.setItem(
            CONFIG.progressKey,
            JSON.stringify(state.completedLessons)
        );

        return true;

    } catch (error) {

        console.warn(
            "[Yadav ExamPrep] Could not save progress:",
            error
        );

        return false;

    }

}


function progressIdentifier(lessonId) {

    return [
        state.subjectId,
        lessonId
    ].join(":");

}


function isLessonCompleted(lessonId) {

    return state.completedLessons[
        progressIdentifier(lessonId)
    ] === true;

}


function markLessonCompleted() {

    const lesson = state.lessons[
        state.currentLessonIndex
    ];

    if (!lesson) {
        return;
    }

    const key = progressIdentifier(lesson.id);

    state.completedLessons[key] = true;

    const saved = saveProgress();

    updateProgress();

    renderTopicNavigation();

    updateCompletionButton();

    if (!saved) {

        elements.completeButton.textContent =
            "Completed (not saved on this device)";

    }

}


/* =====================================================
   06. STATUS AND VISIBILITY
===================================================== */

function showStatus(title, description) {

    elements.workspace.hidden = true;

    elements.statusSection.hidden = false;

    elements.statusTitle.textContent = title;

    elements.statusDescription.textContent = description;

}


function hideStatus() {

    elements.statusSection.hidden = true;

    elements.workspace.hidden = false;

}


function showLessonLoading() {

    elements.lessonReader.setAttribute(
        "aria-busy",
        "true"
    );

    elements.lessonLoading.hidden = false;

    elements.lessonContent.hidden = true;

    elements.lessonNavigation.hidden = true;

    elements.practicePanel.hidden = true;

}


function showLessonMessage(title, description) {

    elements.lessonLoading.hidden = true;

    elements.lessonContent.hidden = false;

    elements.lessonReader.setAttribute(
        "aria-busy",
        "false"
    );

    elements.lessonTopic.textContent = "";

    elements.lessonTitle.textContent = title;

    elements.lessonDescription.textContent = description;

    elements.lessonBody.replaceChildren();

    elements.completeButton.hidden = true;

    elements.lessonNavigation.hidden = true;

    elements.practicePanel.hidden = true;

    elements.lessonPosition.textContent = "";

}


/* =====================================================
   07. EXAMINATION AND SUBJECT RELATIONSHIPS
===================================================== */

function getPublishedExams() {

    return state.exams.filter(isPublished);

}


function subjectBelongsToExam(subject, examId) {

    if (!examId) {
        return false;
    }

    if (Array.isArray(subject.examIds)) {

        return subject.examIds.some(
            id => cleanId(id) === examId
        );

    }

    return cleanId(subject.examId) === examId;

}


function getPublishedSubjects(examId) {

    return state.subjects.filter(subject => {

        return (
            isPublished(subject) &&
            subjectBelongsToExam(subject, examId)
        );

    });

}


function getExam(id) {

    return getPublishedExams().find(
        exam => exam.id === id
    ) || null;

}


function getSubject(id, examId) {

    return getPublishedSubjects(examId).find(
        subject => subject.id === id
    ) || null;

}


/* =====================================================
   08. SELECT OPTIONS
===================================================== */

function fillSelect(
    select,
    items,
    placeholder,
    selectedId
) {

    const fragment = document.createDocumentFragment();

    fragment.appendChild(
        new Option(placeholder, "")
    );

    [...items]

        .sort((a, b) => {

            return cleanText(a.name).localeCompare(
                cleanText(b.name)
            );

        })

        .forEach(item => {

            fragment.appendChild(

                new Option(
                    cleanText(item.name, "Untitled"),
                    item.id
                )

            );

        });

    select.replaceChildren(fragment);

    const selectedExists = items.some(
        item => item.id === selectedId
    );

    select.value = selectedExists
        ? selectedId
        : "";

}


function populateExams() {

    fillSelect(
        elements.exam,
        getPublishedExams(),
        "Select Examination",
        state.examId
    );

}


function populateSubjects() {

    const subjects = getPublishedSubjects(
        state.examId
    );

    fillSelect(
        elements.subject,
        subjects,
        "Select Subject",
        state.subjectId
    );

    elements.subject.disabled = !state.examId;

}


/* =====================================================
   09. RESOLVE SUBJECT URL
===================================================== */

function resolveInitialSelection() {

    /*
     * Subject-directory links may provide only
     * ?subject=subjectId.
     *
     * Find the first published examination associated
     * with that subject.
     */

    if (state.subjectId && !state.examId) {

        const subject = state.subjects.find(item => {

            return (
                isPublished(item) &&
                item.id === state.subjectId
            );

        });

        if (subject) {

            const matchingExam = getPublishedExams().find(
                exam => subjectBelongsToExam(
                    subject,
                    exam.id
                )
            );

            if (matchingExam) {
                state.examId = matchingExam.id;
            }

        }

    }

    if (!getExam(state.examId)) {

        state.examId = "";
        state.subjectId = "";
        state.lessonId = "";

        return;

    }

    if (!getSubject(state.subjectId, state.examId)) {

        state.subjectId = "";
        state.lessonId = "";

    }

}


/* =====================================================
   10. LEARNING PAGE INFORMATION
===================================================== */

function updatePageInformation() {

    const exam = getExam(state.examId);

    const subject = getSubject(
        state.subjectId,
        state.examId
    );

    elements.examName.textContent = exam
        ? cleanText(exam.name, "Structured Learning")
        : "Structured Learning";

    elements.pageTitle.textContent = subject
        ? cleanText(subject.name, "Subject Learning")
        : "Explore Learning Resources";

    elements.pageDescription.textContent = subject
        ? cleanText(
            subject.description,
            "Explore the published topics and lessons for this subject."
        )
        : "Select an examination and subject to explore available learning resources.";

    elements.breadcrumbCurrent.textContent = subject
        ? cleanText(subject.name, "Learning")
        : "Learning";

    elements.workspaceTitle.textContent = subject
        ? cleanText(subject.name, "Subject Learning")
        : "Subject Learning";

    document.title = subject
        ? `${cleanText(subject.name)} | Yadav ExamPrep`
        : "Structured Learning | Yadav ExamPrep";

}


/* =====================================================
   11. FETCH PUBLISHED TOPICS AND LESSONS
===================================================== */

async function loadSubjectContent() {

    const subject = getSubject(
        state.subjectId,
        state.examId
    );

    const version = ++state.requestVersion;

    state.topics = [];
    state.lessons = [];

    state.currentLessonIndex = -1;

    updatePageInformation();

    updateURL();

    if (!subject) {

        showStatus(
            "Choose a Subject to Begin",
            "Select an examination and subject to explore available learning resources."
        );

        return;

    }

    hideStatus();

    showLessonLoading();

    elements.topicNavigation.setAttribute(
        "aria-busy",
        "true"
    );

    elements.topicNavigation.textContent =
        "Loading topics...";

    try {

        /*
         * Database structure:
         *
         * public/topics/{topicId}
         * public/lessons/{lessonId}
         *
         * Both collections are read, then filtered
         * by publication status and subject ownership.
         */

        const [topicsData, lessonsData] = await Promise.all([

            readData("public/topics"),

            readData("public/lessons")

        ]);

        /*
         * Ignore responses from an older selection.
         */

        if (version !== state.requestVersion) {
            return;
        }

        state.topics = sortByOrder(

            normalizeCollection(topicsData).filter(topic => {

                return (
                    isPublished(topic) &&
                    cleanId(topic.subjectId) === state.subjectId
                );

            })

        );

        const publishedTopicIds = new Set(
            state.topics.map(topic => topic.id)
        );

        state.lessons = sortByOrder(

            normalizeCollection(lessonsData).filter(lesson => {

                return (
                    isPublished(lesson) &&
                    cleanId(lesson.subjectId) === state.subjectId &&
                    publishedTopicIds.has(
                        cleanId(lesson.topicId)
                    )
                );

            })

        );

        /*
         * Arrange lessons by topic order first,
         * then by their individual lesson order.
         */

        const topicOrder = new Map(

            state.topics.map(
                (topic, index) => [topic.id, index]
            )

        );

        state.lessons.sort((a, b) => {

            const topicA = topicOrder.get(a.topicId) ?? 0;
            const topicB = topicOrder.get(b.topicId) ?? 0;

            if (topicA !== topicB) {
                return topicA - topicB;
            }

            return (
                cleanNumber(a.order) -
                cleanNumber(b.order)
            );

        });

        renderTopicNavigation();

        updateProgress();

        if (state.lessons.length === 0) {

            state.lessonId = "";

            showLessonMessage(
                "No Published Lessons Yet",
                "Learning materials for this subject will appear here once the administrator publishes them."
            );

            updateURL();

            return;

        }

        const requestedIndex = state.lessons.findIndex(
            lesson => lesson.id === state.lessonId
        );

        selectLesson(
            requestedIndex >= 0 ? requestedIndex : 0
        );

    } catch (error) {

        if (version !== state.requestVersion) {
            return;
        }

        console.error(
            "[Yadav ExamPrep] Learning content error:",
            error
        );

        elements.topicNavigation.setAttribute(
            "aria-busy",
            "false"
        );

        elements.topicNavigation.textContent =
            "Unable to load topics.";

        showLessonMessage(
            "Unable to Load Learning Materials",
            "Please check your connection and try again later."
        );

    }

}


/* =====================================================
   12. TOPIC NAVIGATION
===================================================== */

function renderTopicNavigation() {

    const fragment = document.createDocumentFragment();

    state.topics.forEach(topic => {

        const topicLessons = state.lessons.filter(
            lesson => lesson.topicId === topic.id
        );

        /*
         * Do not display empty topic groups.
         */

        if (topicLessons.length === 0) {
            return;
        }

        const group = createElement(
            "section",
            "learning-topic-group"
        );

        const heading = createElement(
            "h4",
            "learning-topic-title",
            cleanText(topic.name, "Untitled Topic")
        );

        const list = createElement(
            "div",
            "learning-lesson-list"
        );

        topicLessons.forEach(lesson => {

            const index = state.lessons.findIndex(
                item => item.id === lesson.id
            );

            const button = createElement(
                "button",
                "learning-lesson-link",
                cleanText(lesson.title, "Untitled Lesson")
            );

            button.type = "button";

            if (index === state.currentLessonIndex) {

                button.classList.add("active");

                button.setAttribute(
                    "aria-current",
                    "step"
                );

            }

            if (isLessonCompleted(lesson.id)) {

                button.classList.add("is-completed");

                button.setAttribute(
                    "aria-label",
                    `${cleanText(lesson.title)} — completed`
                );

            }

            button.addEventListener("click", () => {

                selectLesson(index);

                closeMobileSidebar();

            });

            list.appendChild(button);

        });

        group.append(heading, list);

        fragment.appendChild(group);

    });

    elements.topicNavigation.replaceChildren(fragment);

    elements.topicNavigation.setAttribute(
        "aria-busy",
        "false"
    );

    if (!fragment.childNodes.length && !state.topics.length) {

        elements.topicNavigation.textContent =
            "No published topics available.";

    }

}


/* =====================================================
   13. LESSON CONTENT RENDERING
===================================================== */

function renderLessonBody(content) {

    const container = elements.lessonBody;

    container.replaceChildren();

    /*
     * Render plain text safely.
     *
     * Blank lines separate paragraphs.
     * No untrusted HTML is injected.
     */

    const text = cleanText(content);

    if (!text) {

        container.appendChild(

            createElement(
                "p",
                "",
                "Lesson content is not available."
            )

        );

        return;

    }

    const paragraphs = text.split(/\n\s*\n/);

    paragraphs.forEach(paragraph => {

        const element = createElement(
            "p",
            "",
            paragraph.trim()
        );

        element.style.whiteSpace = "pre-line";

        container.appendChild(element);

    });

}


/* =====================================================
   14. LESSON SELECTION
===================================================== */

function selectLesson(index) {

    if (
        index < 0 ||
        index >= state.lessons.length
    ) {
        return;
    }

    state.currentLessonIndex = index;

    const lesson = state.lessons[index];

    const topic = state.topics.find(
        item => item.id === lesson.topicId
    );

    state.lessonId = lesson.id;

    elements.lessonLoading.hidden = true;

    elements.lessonContent.hidden = false;

    elements.lessonReader.setAttribute(
        "aria-busy",
        "false"
    );

    elements.lessonTopic.textContent = topic
        ? cleanText(topic.name, "Topic")
        : "Topic";

    elements.lessonTitle.textContent = cleanText(
        lesson.title,
        "Untitled Lesson"
    );

    elements.lessonDescription.textContent = cleanText(
        lesson.description
    );

    elements.lessonType.textContent = cleanText(
        lesson.type,
        "Learning Material"
    );

    elements.lessonPosition.textContent =

        `Lesson ${index + 1} of ${state.lessons.length}`;

    renderLessonBody(lesson.content);

    elements.completeButton.hidden = false;

    updateCompletionButton();

    updateLessonNavigation();

    updatePracticeLink(topic);

    renderTopicNavigation();

    updateURL();

}


/* =====================================================
   15. COMPLETION BUTTON
===================================================== */

function updateCompletionButton() {

    const lesson = state.lessons[
        state.currentLessonIndex
    ];

    if (!lesson) {
        return;
    }

    const completed = isLessonCompleted(lesson.id);

    elements.completeButton.textContent = completed
        ? "Completed"
        : "Mark as Completed";

    elements.completeButton.disabled = completed;

    elements.completeButton.setAttribute(
        "aria-pressed",
        String(completed)
    );

}


/* =====================================================
   16. LEARNING PROGRESS
===================================================== */

function updateProgress() {

    const total = state.lessons.length;

    const completed = state.lessons.filter(
        lesson => isLessonCompleted(lesson.id)
    ).length;

    const percentage = total > 0
        ? Math.round((completed / total) * 100)
        : 0;

    elements.progressText.textContent =
        `${percentage}%`;

    elements.progressTrack.setAttribute(
        "aria-valuenow",
        String(percentage)
    );

    elements.progressFill.style.width =
        `${percentage}%`;

}


/* =====================================================
   17. PREVIOUS / NEXT NAVIGATION
===================================================== */

function updateLessonNavigation() {

    const index = state.currentLessonIndex;

    const total = state.lessons.length;

    elements.lessonNavigation.hidden = total === 0;

    elements.previousButton.disabled = index <= 0;

    elements.nextButton.disabled = (
        index < 0 ||
        index >= total - 1
    );

}


/* =====================================================
   18. TOPIC PRACTICE LINK
===================================================== */

function updatePracticeLink(topic) {

    elements.practicePanel.hidden = true;

    if (!topic) {
        return;
    }

    /*
     * Practice is displayed only when the admin
     * associates a published test with the topic.
     */

    const testId = cleanId(
        topic.practiceTestId
    );

    if (!testId) {
        return;
    }

    const params = new URLSearchParams({
        test: testId
    });

    elements.practiceLink.href =
        `mock-test.html?${params.toString()}`;

    elements.practicePanel.hidden = false;

}


/* =====================================================
   19. MOBILE TOPIC SIDEBAR
===================================================== */

function closeMobileSidebar() {

    elements.sidebar.classList.remove(
        "is-open"
    );

    elements.sidebarToggle.setAttribute(
        "aria-expanded",
        "false"
    );

}


function registerSidebarEvents() {

    elements.sidebarToggle.addEventListener(
        "click",
        () => {

            const isOpen = elements.sidebar.classList.toggle(
                "is-open"
            );

            elements.sidebarToggle.setAttribute(
                "aria-expanded",
                String(isOpen)
            );

        }
    );

    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {
            closeMobileSidebar();
        }

    });

}


/* =====================================================
   20. SELECTION EVENTS
===================================================== */

function registerSelectionEvents() {

    elements.exam.addEventListener(
        "change",
        () => {

            state.examId = cleanId(
                elements.exam.value
            );

            state.subjectId = "";
            state.lessonId = "";

            populateSubjects();

            closeMobileSidebar();

            loadSubjectContent();

        }
    );


    elements.subject.addEventListener(
        "change",
        () => {

            state.subjectId = cleanId(
                elements.subject.value
            );

            state.lessonId = "";

            closeMobileSidebar();

            loadSubjectContent();

        }
    );


    elements.completeButton.addEventListener(
        "click",
        markLessonCompleted
    );


    elements.previousButton.addEventListener(
        "click",
        () => {

            selectLesson(
                state.currentLessonIndex - 1
            );

        }
    );


    elements.nextButton.addEventListener(
        "click",
        () => {

            selectLesson(
                state.currentLessonIndex + 1
            );

        }
    );

}


/* =====================================================
   21. FIREBASE PUBLIC CONTENT UPDATES
===================================================== */

function handlePublicContent(update) {

    if (
        Object.prototype.hasOwnProperty.call(
            update,
            "exams"
        )
    ) {

        state.exams = normalizeCollection(
            update.exams
        );

        state.contentReceived.exams = true;

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

        state.contentReceived.subjects = true;

    }

    const ready = Object.values(
        state.contentReceived
    ).every(Boolean);

    if (!ready) {
        return;
    }

    resolveInitialSelection();

    populateExams();

    populateSubjects();

    loadSubjectContent();

}


/* =====================================================
   22. FIREBASE ERROR HANDLING
===================================================== */

function handleFirebaseError(error) {

    console.error(
        "[Yadav ExamPrep] Firebase error:",
        error
    );

    showStatus(
        "Unable to Load Learning Resources",
        "The learning directory is temporarily unavailable. Please check your connection and try again."
    );

}


/* =====================================================
   23. CONNECT DATABASE
===================================================== */

function connectDatabase() {

    if (!isDatabaseConfigured()) {

        showStatus(
            "Learning Resources Not Available Yet",
            "The database is being configured. Published learning resources will appear here once available."
        );

        return;

    }

    try {

        state.unsubscribe = subscribeToPublicContent(

            handlePublicContent,

            handleFirebaseError

        );

    } catch (error) {

        handleFirebaseError(error);

    }

}


/* =====================================================
   24. INITIALIZATION
===================================================== */

function initializeLearning() {

    if (
        document.body.dataset.page !== "learn" ||
        state.initialized
    ) {
        return;
    }

    Object.entries(CONFIG.selectors).forEach(
        ([key, selector]) => {

            elements[key] = byId(selector);

        }
    );

    const missing = Object.entries(elements)

        .filter(([, element]) => !element)

        .map(([key]) => key);

    if (missing.length > 0) {

        console.error(
            "[Yadav ExamPrep] Missing learning elements:",
            missing
        );

        return;

    }

    state.initialized = true;

    state.completedLessons = loadProgress();

    readURL();

    registerSelectionEvents();

    registerSidebarEvents();

    showStatus(
        "Loading Learning Resources",
        "Please wait while available examinations and subjects are loaded."
    );

    connectDatabase();

}


/* =====================================================
   25. CLEANUP
===================================================== */

window.addEventListener("pagehide", () => {

    state.requestVersion++;

    if (typeof state.unsubscribe === "function") {

        state.unsubscribe();

        state.unsubscribe = null;

    }

});


/* =====================================================
   26. SAFE STARTUP
===================================================== */

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initializeLearning,
        { once: true }
    );

} else {

    initializeLearning();

}
