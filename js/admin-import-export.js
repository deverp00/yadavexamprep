
/*
=========================================================
YADAV EXAMPREP
File: js/admin-import-export.js

Administrator JSON Import / Export Controller

Designed and Developed by Yadav Web Technologies

IMPORTANT:
- No sample or seeded educational records.
- Imports write protected admin records only.
- Imported records are always drafts.
- Existing published records cannot be overwritten.
- Public mirrors are never imported directly.
=========================================================
*/

"use strict";

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
    get,
    update
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";


/* =====================================================
   01. CONFIGURATION
===================================================== */

const CONFIG = Object.freeze({

    adminUID: "6HwAPbqwYBgg5Ih2zWycOZFBCe93",

    maxFileSize: 5 * 1024 * 1024,

    collections: [
        "exams",
        "subjects",
        "topics",
        "lessons",
        "questions",
        "tests"
    ],

    labels: {
        exams: "Exams",
        subjects: "Subjects",
        topics: "Topics",
        lessons: "Lessons",
        questions: "Question Bank",
        tests: "Mock Tests"
    },

    backupFormat: "yadav-examprep-backup",

    backupVersion: 1

});

const SELECTORS = {

    gate: "#adminAuthGate",
    gateSpinner: "#adminGateSpinner",
    gateTitle: "#adminGateTitle",
    gateDescription: "#adminGateDescription",
    gateLoginLink: "#adminGateLoginLink",

    app: "#adminImportExportApp",

    sidebar: "#adminSidebar",
    backdrop: "#adminSidebarBackdrop",
    menuToggle: "#adminMenuToggle",
    sidebarClose: "#adminSidebarClose",
    sidebarNavigation: "#adminSidebarNavigation",
    sidebarLogout: "#adminSidebarLogout",
    topbarLogout: "#adminTopbarLogout",
    userEmail: "#adminUserEmail",

    status: "#importExportStatus",
    statusSpinner: "#importExportSpinner",
    statusText: "#importExportStatusText",

    importForm: "#importDataForm",
    file: "#importJsonFile",
    mode: "#importMode",
    scope: "#importCollectionScope",
    validate: "#validateImportButton",
    validateText: "#validateImportButtonText",
    validateSpinner: "#validateImportSpinner",
    reset: "#resetImportButton",

    preview: "#importPreviewSection",
    badge: "#importValidationBadge",
    previewFile: "#importPreviewFileName",
    previewSize: "#importPreviewFileSize",
    found: "#importRecordsFound",
    valid: "#importValidRecords",
    skipped: "#importSkippedRecords",
    errors: "#importErrorCount",
    previewTable: "#importPreviewTableBody",
    messages: "#importValidationMessages",
    openConfirmation: "#openImportConfirmationButton",
    cancelPreview: "#cancelImportPreviewButton",

    exportForm: "#exportDataForm",
    exportButton: "#exportDataButton",
    exportText: "#exportDataButtonText",
    exportSpinner: "#exportDataSpinner",
    selectAll: "#selectAllExportButton",
    clearExport: "#clearExportSelectionButton",

    databaseStatus: "#backupDatabaseStatus",
    lastExport: "#lastExportTime",
    lastImport: "#lastImportTime",

    modal: "#importConfirmationModal",
    modalTitle: "#importConfirmationTitle",
    modalDescription: "#importConfirmationDescription",
    modalFile: "#importConfirmationFileName",
    modalMode: "#importConfirmationMode",
    modalCount: "#importConfirmationCount",
    agreement: "#importConfirmationAgreement",
    confirm: "#confirmImportButton",
    confirmText: "#confirmImportButtonText",
    confirmSpinner: "#confirmImportSpinner",
    closeModal: "#closeImportConfirmationModal",
    cancelModal: "#cancelImportConfirmation",

    year: "#currentYear"

};


/* =====================================================
   02. STATE
===================================================== */

const state = {

    initialized: false,
    authorized: false,
    busy: false,
    signingOut: false,

    session: 0,

    preview: null,

    modalOpen: false,
    returnFocus: null

};

const el = {};


/* =====================================================
   03. GENERAL HELPERS
===================================================== */

function setText(target, value) {

    if (target) {
        target.textContent = String(value);
    }

}

function create(tag, className = "", value) {

    const node = document.createElement(tag);

    if (className) {
        node.className = className;
    }

    if (value !== undefined) {
        node.textContent = String(value);
    }

    return node;

}

function isObject(value) {

    return Boolean(
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
    );

}

function normalize(value) {

    return isObject(value) ? value : {};

}

function validKey(value) {

    return (
        typeof value === "string" &&
        value.length > 0 &&
        value.length <= 768 &&
        !/[.#$\[\]\/\u0000-\u001f\u007f]/.test(value)
    );

}

function cleanString(value) {

    return typeof value === "string"
        ? value.trim()
        : "";

}

function validNumber(value, min, max, integer = false) {

    if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < min ||
        value > max
    ) {
        return false;
    }

    if (integer) {
        return Number.isInteger(value);
    }

    return (
        Math.abs(
            value * 100 - Math.round(value * 100)
        ) < 0.000001
    );

}

function validTimestamp(value) {

    return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value > 0
    );

}

function sessionValid(version) {

    return (
        state.authorized &&
        state.session === version &&
        auth.currentUser?.uid === CONFIG.adminUID
    );

}

function formatSize(bytes) {

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1048576) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / 1048576).toFixed(2)} MB`;

}

function currentTime() {

    return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(new Date());

}

function selectedCollections() {

    return CONFIG.collections.filter(collection => {

        const checkbox = el.exportForm.querySelector(
            `input[name="exportCollection"][value="${collection}"]`
        );

        return checkbox?.checked === true;

    });

}

function requiredString(value, max) {

    return Boolean(
        typeof value === "string" &&
        value.trim() &&
        value.trim().length <= max
    );

}

function optionalString(value, max) {

    return (
        value === undefined ||
        (
            typeof value === "string" &&
            value.length <= max
        )
    );

}


/* =====================================================
   04. STATUS AND CONTROLS
===================================================== */

function showGate(title, description, login = false) {

    el.app.hidden = true;
    el.gate.hidden = false;

    setText(el.gateTitle, title);
    setText(el.gateDescription, description);

    el.gateSpinner.hidden = login;
    el.gateLoginLink.hidden = !login;

}

function showStatus(message, type = "loading") {

    el.status.hidden = false;

    el.status.classList.remove(
        "is-error",
        "is-success",
        "is-warning"
    );

    if (type !== "loading") {
        el.status.classList.add(`is-${type}`);
    }

    el.statusSpinner.hidden = type !== "loading";

    setText(el.statusText, message);

}

function setControls() {

    const enabled = (
        state.authorized &&
        Boolean(database) &&
        isDatabaseConfigured() &&
        !state.busy
    );

    [
        el.file,
        el.mode,
        el.scope,
        el.validate,
        el.reset,
        el.exportButton,
        el.selectAll,
        el.clearExport
    ].forEach(control => {
        control.disabled = !enabled;
    });

    el.exportForm.querySelectorAll(
        'input[name="exportCollection"]'
    ).forEach(control => {
        control.disabled = !enabled;
    });

    el.openConfirmation.disabled = (
        !enabled ||
        !state.preview ||
        state.preview.errors.length > 0 ||
        state.preview.operations.length === 0
    );

    el.confirm.disabled = (
        !enabled ||
        !state.modalOpen ||
        !el.agreement.checked
    );

    el.validateSpinner.hidden = !state.busy;
    el.exportSpinner.hidden = !state.busy;
    el.confirmSpinner.hidden = !state.busy;

    setText(
        el.validateText,
        state.busy ? "Processing..." : "Validate & Preview"
    );

    setText(
        el.exportText,
        state.busy
            ? "Processing..."
            : "Export Selected Collections"
    );

    setText(
        el.confirmText,
        state.busy ? "Importing..." : "Import Records"
    );

}

function setBusy(value) {

    state.busy = value;
    setControls();

}


/* =====================================================
   05. AUTHENTICATION
===================================================== */

function observeAuthentication() {

    onAuthStateChanged(

        auth,

        async user => {

            const version = ++state.session;

            state.preview = null;

            closeConfirmation(true);

            if (
                !user ||
                user.uid !== CONFIG.adminUID
            ) {

                state.authorized = false;

                setControls();

                showGate(
                    user ? "Access Denied" : "Sign In Required",
                    user
                        ? "This account is not authorized."
                        : "Sign in with your administrator account.",
                    true
                );

                if (user) {

                    try {
                        await signOut(auth);
                    } catch (error) {
                        console.error(
                            "[Import / Export] Unauthorized sign-out:",
                            error?.code
                        );
                    }

                }

                return;

            }

            state.authorized = true;

            setText(
                el.userEmail,
                user.email || "Administrator"
            );

            el.gate.hidden = true;
            el.app.hidden = false;

            if (
                !isDatabaseConfigured() ||
                !database
            ) {

                setText(
                    el.databaseStatus,
                    "Not Configured"
                );

                showStatus(
                    "Add your actual Firebase Realtime Database URL to js/firebase-config.js.",
                    "error"
                );

                setControls();

                return;

            }

            setText(
                el.databaseStatus,
                "Configured"
            );

            setControls();

            if (sessionValid(version)) {

                showStatus(
                    "Import / Export tools are ready.",
                    "success"
                );

            }

        },

        error => {

            ++state.session;

            state.authorized = false;

            console.error(
                "[Import / Export] Authentication:",
                error?.code
            );

            showGate(
                "Session Verification Failed",
                "Unable to verify administrator access.",
                true
            );

        }

    );

}


/* =====================================================
   06. IMPORT FILE FORMAT
===================================================== */

/*
Accepted backup format:

{
    "format": "yadav-examprep-backup",
    "version": 1,
    "collections": {
        "exams": {},
        "subjects": {},
        "topics": {},
        "lessons": {},
        "questions": {},
        "tests": {},
        "testQuestions": {}
    }
}

No records are generated automatically.
*/

function parseBackup(value) {

    if (!isObject(value)) {

        throw new Error(
            "The JSON root must be an object."
        );

    }

    if (
        value.format !== CONFIG.backupFormat ||
        value.version !== CONFIG.backupVersion
    ) {

        throw new Error(
            "Unsupported backup format or version. Use a Yadav ExamPrep version 1 export."
        );

    }

    if (!isObject(value.collections)) {

        throw new Error(
            "The backup must contain a collections object."
        );

    }

    const allowed = new Set([
        ...CONFIG.collections,
        "testQuestions"
    ]);

    for (const key of Object.keys(value.collections)) {

        if (!allowed.has(key)) {

            throw new Error(
                `Unsupported collection: ${key}`
            );

        }

        if (!isObject(value.collections[key])) {

            throw new Error(
                `Collection "${key}" must be an object.`
            );

        }

    }

    return value.collections;

}


/* =====================================================
   07. RECORD SCHEMA VALIDATION
===================================================== */

function validateRecord(collection, record) {

    const errors = [];

    if (!isObject(record)) {
        return ["Record must be an object."];
    }

    const name = cleanString(record.name);
    const title = cleanString(record.title);

    if (collection === "exams") {

        if (!requiredString(name, 120)) {
            errors.push("Invalid examination name.");
        }

        if (!optionalString(record.description, 600)) {
            errors.push("Invalid examination description.");
        }

    }

    if (collection === "subjects") {

        if (!requiredString(name, 120)) {
            errors.push("Invalid subject name.");
        }

        if (!validKey(record.examId)) {
            errors.push("Invalid parent examination ID.");
        }

        if (!optionalString(record.description, 600)) {
            errors.push("Invalid subject description.");
        }

    }

    if (collection === "topics") {

        if (!requiredString(name, 150)) {
            errors.push("Invalid topic name.");
        }

        if (
            !validKey(record.examId) ||
            !validKey(record.subjectId)
        ) {
            errors.push("Invalid topic parent identifiers.");
        }

        if (!optionalString(record.description, 800)) {
            errors.push("Invalid topic description.");
        }

    }

    if (collection === "lessons") {

        if (!requiredString(title, 180)) {
            errors.push("Invalid lesson title.");
        }

        if (
            !validKey(record.examId) ||
            !validKey(record.subjectId) ||
            !validKey(record.topicId)
        ) {
            errors.push("Invalid lesson parent identifiers.");
        }

        if (!requiredString(record.content, 100000)) {
            errors.push("Lesson content is missing or invalid.");
        }

        if (!optionalString(record.description, 800)) {
            errors.push("Invalid lesson description.");
        }

    }

    if (collection === "questions") {

        if (!requiredString(record.question, 5000)) {
            errors.push("Invalid question text.");
        }

        if (
            !validKey(record.examId) ||
            !validKey(record.subjectId) ||
            !validKey(record.topicId)
        ) {
            errors.push("Invalid question parent identifiers.");
        }

        const options = record.options;

        if (
            !isObject(options) ||
            !["A", "B", "C", "D"].every(key =>
                requiredString(options[key], 1500)
            ) ||
            Object.keys(options).length !== 4
        ) {

            errors.push(
                "Questions must contain four valid options: A, B, C and D."
            );

        } else {

            const unique = new Set(
                ["A", "B", "C", "D"].map(key =>
                    options[key].trim().toLowerCase()
                )
            );

            if (unique.size !== 4) {
                errors.push("Question options must be distinct.");
            }

        }

        if (
            !["A", "B", "C", "D"].includes(
                record.correctOptionId
            )
        ) {
            errors.push("Invalid correct answer.");
        }

        if (!optionalString(record.explanation, 5000)) {
            errors.push("Invalid answer explanation.");
        }

        if (!validNumber(record.marks, 0.01, 1000)) {
            errors.push("Invalid question marks.");
        }

        if (!validNumber(record.negativeMarks, 0, 1000)) {
            errors.push("Invalid negative marks.");
        }

    }

    if (collection === "tests") {

        if (!requiredString(title, 180)) {
            errors.push("Invalid mock test title.");
        }

        if (!validKey(record.examId)) {
            errors.push("Invalid parent examination ID.");
        }

        if (
            record.subjectId !== undefined &&
            !validKey(record.subjectId)
        ) {
            errors.push("Invalid optional subject ID.");
        }

        if (!optionalString(record.description, 1000)) {
            errors.push("Invalid test description.");
        }

        if (!validNumber(record.duration, 0, 1440, true)) {
            errors.push("Invalid test duration.");
        }

        if (
            !validNumber(
                record.marksPerQuestion,
                0.01,
                1000
            )
        ) {
            errors.push("Invalid default marks.");
        }

        if (
            !validNumber(
                record.negativeMarks,
                0,
                1000
            )
        ) {
            errors.push("Invalid default negative marks.");
        }

        if (
            !Array.isArray(record.questionIds) ||
            record.questionIds.some(id => !validKey(id)) ||
            new Set(record.questionIds).size !==
                record.questionIds.length
        ) {
            errors.push("Invalid test question IDs.");
        }

    }

    if (
        record.order !== undefined &&
        !validNumber(record.order, 0, 99999, true)
    ) {
        errors.push("Invalid display order.");
    }

    return errors;

}


/* =====================================================
   08. PREPARE DRAFT RECORDS
===================================================== */

function prepareRecord(record, existing = null) {

    const now = Date.now();

    const result = {
        ...record,
        published: false,
        createdAt:
            existing?.createdAt ||
            (validTimestamp(record.createdAt)
                ? record.createdAt
                : now),
        updatedAt: now
    };

    delete result.id;

    return result;

}

function validateTestCopies(testId, test, collections) {

    const errors = [];

    const copies = normalize(
        collections.testQuestions?.[testId]
    );

    const ids = Array.isArray(test.questionIds)
        ? test.questionIds
        : [];

    if (Object.keys(copies).length !== ids.length) {

        errors.push(
            "Test question copies do not match the selected question IDs."
        );

    }

    ids.forEach((id, index) => {

        const copy = copies[id];

        if (!isObject(copy)) {

            errors.push(
                `Missing assembled question: ${id}`
            );

            return;

        }

        if (copy.sourceQuestionId !== id) {

            errors.push(
                `Invalid sourceQuestionId for ${id}.`
            );

        }

        if (
            !requiredString(copy.question, 5000) ||
            !isObject(copy.options) ||
            !["A", "B", "C", "D"].every(key =>
                requiredString(copy.options[key], 1500)
            ) ||
            !["A", "B", "C", "D"].includes(
                copy.correctOptionId
            )
        ) {

            errors.push(
                `Invalid assembled question: ${id}`
            );

        }

        if (
            copy.order !== undefined &&
            copy.order !== index
        ) {

            errors.push(
                `Question ordering mismatch: ${id}`
            );

        }

    });

    return errors;

}


/* =====================================================
   09. VALIDATE IMPORT PREVIEW
===================================================== */

async function buildPreview(file, mode, scope, version) {

    if (
        !file ||
        !file.name.toLowerCase().endsWith(".json")
    ) {

        throw new Error(
            "Select a valid .json backup file."
        );

    }

    if (file.size > CONFIG.maxFileSize) {

        throw new Error(
            "JSON file exceeds the 5 MB import limit."
        );

    }

    if (file.size === 0) {

        throw new Error(
            "The selected JSON file is empty."
        );

    }

    const contents = await file.text();

    let parsed;

    try {

        parsed = JSON.parse(contents);

    } catch {

        throw new Error(
            "The selected file does not contain valid JSON."
        );

    }

    const collections = parseBackup(parsed);

    const snapshot = await get(
        ref(database, "admin")
    );

    if (!sessionValid(version)) {

        throw new Error(
            "Administrator session changed."
        );

    }

    const existing = snapshot.val() || {};

    const chosen = scope === "all"
        ? CONFIG.collections
        : [scope];

    const summary = {};
    const operations = [];
    const errors = [];

    let found = 0;
    let skipped = 0;

    chosen.forEach(collection => {

        const incoming = normalize(
            collections[collection]
        );

        const stored = normalize(
            existing[collection]
        );

        const stats = {
            found: 0,
            added: 0,
            updated: 0,
            skipped: 0,
            errors: 0
        };

        for (const [id, record] of Object.entries(incoming)) {

            found++;
            stats.found++;

            const prefix = `${collection}/${id}`;

            if (!validKey(id)) {

                errors.push(
                    `${prefix}: Invalid Firebase identifier.`
                );

                stats.errors++;
                continue;

            }

            const validation = validateRecord(
                collection,
                record
            );

            if (validation.length) {

                validation.forEach(message => {

                    errors.push(
                        `${prefix}: ${message}`
                    );

                });

                stats.errors++;
                continue;

            }

            const previous = stored[id] || null;

            if (previous && mode === "skip") {

                skipped++;
                stats.skipped++;

                continue;

            }

            if (
                previous &&
                previous.published === true
            ) {

                errors.push(
                    `${prefix}: Existing published records cannot be overwritten through import.`
                );

                stats.errors++;

                continue;

            }

            if (collection === "tests") {

                const copyErrors = validateTestCopies(
                    id,
                    record,
                    collections
                );

                if (copyErrors.length) {

                    copyErrors.forEach(message => {

                        errors.push(
                            `${prefix}: ${message}`
                        );

                    });

                    stats.errors++;
                    continue;

                }

            }

            operations.push({

                collection,
                id,

                record: prepareRecord(
                    record,
                    previous
                ),

                existing: Boolean(previous)

            });

            if (previous) {
                stats.updated++;
            } else {
                stats.added++;
            }

        }

        summary[collection] = stats;

    });

    /*
     * Cross-reference checks are performed against the
     * proposed protected database state.
     */

    const proposed = structuredClone(existing);

    operations.forEach(operation => {

        proposed[operation.collection] ||= {};

        proposed[operation.collection][operation.id] =
            operation.record;

    });

    const lookup = (collection, id) =>
        proposed?.[collection]?.[id] || null;

    operations.forEach(operation => {

        const record = operation.record;

        if (operation.collection === "subjects") {

            if (!lookup("exams", record.examId)) {

                errors.push(
                    `subjects/${operation.id}: Parent examination does not exist.`
                );

            }

        }

        if ([
            "topics",
            "lessons",
            "questions"
        ].includes(operation.collection)) {

            const exam = lookup(
                "exams",
                record.examId
            );

            const subject = lookup(
                "subjects",
                record.subjectId
            );

            if (!exam || !subject) {

                errors.push(
                    `${operation.collection}/${operation.id}: Missing examination or subject.`
                );

            } else if (
                subject.examId !== record.examId
            ) {

                errors.push(
                    `${operation.collection}/${operation.id}: Subject hierarchy mismatch.`
                );

            }

        }

        if ([
            "lessons",
            "questions"
        ].includes(operation.collection)) {

            const topic = lookup(
                "topics",
                record.topicId
            );

            if (
                !topic ||
                topic.examId !== record.examId ||
                topic.subjectId !== record.subjectId
            ) {

                errors.push(
                    `${operation.collection}/${operation.id}: Invalid parent topic.`
                );

            }

        }

        if (operation.collection === "tests") {

            if (!lookup("exams", record.examId)) {

                errors.push(
                    `tests/${operation.id}: Parent examination is missing.`
                );

            }

            if (record.subjectId) {

                const subject = lookup(
                    "subjects",
                    record.subjectId
                );

                if (
                    !subject ||
                    subject.examId !== record.examId
                ) {

                    errors.push(
                        `tests/${operation.id}: Invalid parent subject.`
                    );

                }

            }

            record.questionIds.forEach(id => {

                if (!lookup("questions", id)) {

                    errors.push(
                        `tests/${operation.id}: Source question ${id} is missing.`
                    );

                }

            });

        }

    });

    return {

        fileName: file.name,
        fileSize: file.size,

        mode,
        scope,

        summary,
        found,
        skipped,

        operations,
        errors,

        /*
         * Used to invalidate stale previews when the
         * administrator changes the file or settings.
         */

        sourceFile: file

    };

}


/* =====================================================
   10. RENDER PREVIEW
===================================================== */

function renderPreview(preview) {

    el.preview.hidden = false;

    setText(el.previewFile, preview.fileName);

    setText(
        el.previewSize,
        formatSize(preview.fileSize)
    );

    setText(el.found, preview.found);

    setText(
        el.valid,
        preview.operations.length
    );

    setText(el.skipped, preview.skipped);

    setText(
        el.errors,
        preview.errors.length
    );

    el.badge.className = preview.errors.length
        ? "admin-status-badge is-draft"
        : "admin-status-badge is-published";

    setText(
        el.badge,
        preview.errors.length
            ? "Validation Failed"
            : "Validation Passed"
    );

    el.previewTable.replaceChildren();

    const fragment = document.createDocumentFragment();

    Object.entries(preview.summary).forEach(
        ([collection, stats]) => {

            const row = create("tr");

            [
                CONFIG.labels[collection],
                stats.found,
                stats.added,
                stats.updated,
                stats.skipped,
                stats.errors
            ].forEach(value => {

                row.append(
                    create("td", "", value)
                );

            });

            fragment.append(row);

        }
    );

    el.previewTable.append(fragment);

    el.messages.replaceChildren();

    if (preview.errors.length) {

        const heading = create(
            "h3",
            "",
            "Validation Errors"
        );

        const list = create("ul");

        preview.errors.forEach(message => {

            list.append(
                create("li", "", message)
            );

        });

        el.messages.append(heading, list);

    } else {

        el.messages.append(
            create(
                "p",
                "admin-form-help",
                "Validation completed. Imported records will remain unpublished drafts."
            )
        );

    }

    setControls();

}


/* =====================================================
   11. FILE VALIDATION HANDLER
===================================================== */

async function handleValidation(event) {

    event.preventDefault();

    if (
        !state.authorized ||
        state.busy ||
        !database
    ) {
        return;
    }

    const file = el.file.files?.[0];

    if (!file) {

        showStatus(
            "Select a JSON backup file first.",
            "error"
        );

        return;

    }

    state.preview = null;

    el.preview.hidden = true;

    const version = state.session;

    setBusy(true);

    showStatus(
        "Validating the selected backup..."
    );

    try {

        const preview = await buildPreview(
            file,
            el.mode.value,
            el.scope.value,
            version
        );

        if (!sessionValid(version)) {
            return;
        }

        state.preview = preview;

        renderPreview(preview);

        showStatus(
            preview.errors.length
                ? "Validation failed. Review the reported errors."
                : "Validation completed. Review the import preview.",
            preview.errors.length
                ? "error"
                : "success"
        );

    } catch (error) {

        console.error(
            "[Import / Export] Validation:",
            error?.code || error?.message
        );

        showStatus(
            error?.code
                ? "Unable to validate the backup. Check database permissions."
                : error.message,
            "error"
        );

    } finally {

        setBusy(false);

    }

}


/* =====================================================
   12. RESET IMPORT
===================================================== */

function resetImport() {

    if (state.busy) {
        return;
    }

    el.importForm.reset();

    state.preview = null;

    el.preview.hidden = true;

    closeConfirmation(true);

    setControls();

}

function invalidatePreview() {

    if (state.busy) {
        return;
    }

    state.preview = null;

    el.preview.hidden = true;

    setControls();

}


/* =====================================================
   13. CONFIRMATION MODAL
===================================================== */

function openConfirmation() {

    if (
        state.busy ||
        !state.preview ||
        state.preview.errors.length ||
        !state.preview.operations.length
    ) {
        return;
    }

    state.returnFocus = document.activeElement;

    state.modalOpen = true;

    el.modal.hidden = false;

    el.agreement.checked = false;

    setText(
        el.modalFile,
        state.preview.fileName
    );

    setText(
        el.modalMode,
        state.preview.mode === "skip"
            ? "Add New Records Only"
            : "Add and Update Matching Drafts"
    );

    setText(
        el.modalCount,
        state.preview.operations.length
    );

    document.body.style.overflow = "hidden";

    setControls();

    el.agreement.focus();

}

function closeConfirmation(force = false) {

    if (state.busy && !force) {
        return;
    }

    if (!state.modalOpen) {
        return;
    }

    state.modalOpen = false;

    el.modal.hidden = true;

    el.agreement.checked = false;

    document.body.style.overflow = "";

    if (
        state.returnFocus?.isConnected &&
        !el.app.hidden
    ) {
        state.returnFocus.focus();
    }

    state.returnFocus = null;

    setControls();

}


/* =====================================================
   14. EXECUTE IMPORT
===================================================== */

async function executeImport() {

    if (
        !state.modalOpen ||
        !el.agreement.checked ||
        !state.preview ||
        state.busy
    ) {
        return;
    }

    const preview = state.preview;

    const version = state.session;

    setBusy(true);

    showStatus(
        "Revalidating database records before import..."
    );

    try {

        /*
         * Re-run validation against fresh database data.
         * This prevents blindly applying a stale preview.
         */

        const refreshed = await buildPreview(
            preview.sourceFile,
            preview.mode,
            preview.scope,
            version
        );

        if (!sessionValid(version)) {
            return;
        }

        if (refreshed.errors.length) {

            throw new Error(
                "Database content changed or validation failed. Review a new preview before importing."
            );

        }

        if (!refreshed.operations.length) {

            throw new Error(
                "No eligible records remain to import."
            );

        }

        const changes = {};

        refreshed.operations.forEach(operation => {

            changes[
                `admin/${operation.collection}/${operation.id}`
            ] = operation.record;

        });

        /*
         * Preserve assembled test questions as drafts.
         * Never import public mirrors directly.
         */

        const fileContents =
            await preview.sourceFile.text();

        const collections = parseBackup(
            JSON.parse(fileContents)
        );

        refreshed.operations
            .filter(operation =>
                operation.collection === "tests"
            )
            .forEach(operation => {

                const copies = normalize(
                    collections.testQuestions?.[operation.id]
                );

                const prepared = {};

                Object.entries(copies).forEach(([id, copy]) => {

                    prepared[id] = {
                        ...copy,
                        published: false
                    };

                });

                changes[
                    `admin/testQuestions/${operation.id}`
                ] = Object.keys(prepared).length
                    ? prepared
                    : null;

            });

        if (!sessionValid(version)) {
            return;
        }

        /*
         * All writes are submitted as one atomic
         * Firebase multi-location update.
         */

        await update(
            ref(database),
            changes
        );

        closeConfirmation(true);

        setText(
            el.lastImport,
            currentTime()
        );

        state.preview = null;

        el.preview.hidden = true;

        el.importForm.reset();

        showStatus(
            `${refreshed.operations.length} record(s) imported as protected drafts. No public content was published.`,
            "success"
        );

    } catch (error) {

        console.error(
            "[Import / Export] Import:",
            error?.code || error?.message
        );

        state.preview = null;

        closeConfirmation(true);

        el.preview.hidden = true;

        showStatus(
            error?.code
                ? "Import failed. Check Firebase Security Rules and database permissions."
                : error.message,
            "error"
        );

    } finally {

        setBusy(false);

    }

}


/* =====================================================
   15. EXPORT DATA
===================================================== */

async function exportData(event) {

    event.preventDefault();

    if (
        !state.authorized ||
        state.busy ||
        !database
    ) {
        return;
    }

    const chosen = selectedCollections();

    if (!chosen.length) {

        showStatus(
            "Select at least one collection to export.",
            "error"
        );

        return;

    }

    const version = state.session;

    setBusy(true);

    showStatus(
        "Preparing your JSON backup..."
    );

    try {

        const snapshot = await get(
            ref(database, "admin")
        );

        if (!sessionValid(version)) {
            return;
        }

        const master = snapshot.val() || {};

        const collections = {};

        chosen.forEach(collection => {

            collections[collection] = normalize(
                master[collection]
            );

        });

        if (chosen.includes("tests")) {

            collections.testQuestions = normalize(
                master.testQuestions
            );

        }

        const backup = {

            format: CONFIG.backupFormat,

            version: CONFIG.backupVersion,

            exportedAt: new Date().toISOString(),

            collections

        };

        const content = JSON.stringify(
            backup,
            null,
            2
        );

        const blob = new Blob(
            [content],
            {
                type: "application/json;charset=utf-8"
            }
        );

        const url = URL.createObjectURL(blob);

        const date = new Date()
            .toISOString()
            .slice(0, 10);

        const anchor = document.createElement("a");

        anchor.href = url;

        anchor.download =
            `yadav-examprep-backup-${date}.json`;

        document.body.append(anchor);

        anchor.click();
        anchor.remove();

        URL.revokeObjectURL(url);

        setText(
            el.lastExport,
            currentTime()
        );

        showStatus(
            "JSON backup prepared successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "[Import / Export] Export:",
            error?.code || error?.message
        );

        showStatus(
            "Unable to export records. Check database permissions.",
            "error"
        );

    } finally {

        setBusy(false);

    }

}


/* =====================================================
   16. EXPORT SELECTION
===================================================== */

function setExportSelection(checked) {

    if (state.busy) {
        return;
    }

    el.exportForm.querySelectorAll(
        'input[name="exportCollection"]'
    ).forEach(input => {

        input.checked = checked;

    });

}


/* =====================================================
   17. RESPONSIVE SIDEBAR
===================================================== */

function setSidebar(open) {

    el.sidebar.classList.toggle(
        "is-open",
        open
    );

    el.backdrop.hidden = !open;

    el.menuToggle.setAttribute(
        "aria-expanded",
        String(open)
    );

    if (open) {

        el.sidebarClose.focus();

    } else {

        el.menuToggle.focus();

    }

}


/* =====================================================
   18. SIGN OUT
===================================================== */

async function logout() {

    if (state.signingOut) {
        return;
    }

    state.signingOut = true;

    el.sidebarLogout.disabled = true;
    el.topbarLogout.disabled = true;

    try {

        await signOut(auth);

        window.location.replace(
            "index.html"
        );

    } catch (error) {

        state.signingOut = false;

        el.sidebarLogout.disabled = false;
        el.topbarLogout.disabled = false;

        showStatus(
            "Unable to sign out. Please try again.",
            "error"
        );

    }

}


/* =====================================================
   19. KEYBOARD ACCESSIBILITY
===================================================== */

function handleModalKeyboard(event) {

    if (!state.modalOpen) {
        return;
    }

    if (event.key === "Escape") {

        event.preventDefault();

        closeConfirmation();

        return;

    }

    if (event.key !== "Tab") {
        return;
    }

    const controls = Array.from(
        el.modal.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), a[href]'
        )
    ).filter(item =>
        item.getClientRects().length > 0
    );

    if (!controls.length) {
        return;
    }

    const first = controls[0];
    const last = controls[controls.length - 1];

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


/* =====================================================
   20. REGISTER EVENTS
===================================================== */

function registerEvents() {

    el.importForm.addEventListener(
        "submit",
        handleValidation
    );

    el.file.addEventListener(
        "change",
        invalidatePreview
    );

    el.mode.addEventListener(
        "change",
        invalidatePreview
    );

    el.scope.addEventListener(
        "change",
        invalidatePreview
    );

    el.reset.addEventListener(
        "click",
        resetImport
    );

    el.cancelPreview.addEventListener(
        "click",
        resetImport
    );

    el.openConfirmation.addEventListener(
        "click",
        openConfirmation
    );

    el.agreement.addEventListener(
        "change",
        setControls
    );

    el.confirm.addEventListener(
        "click",
        executeImport
    );

    [
        el.closeModal,
        el.cancelModal
    ].forEach(control => {

        control.addEventListener(
            "click",
            () => closeConfirmation()
        );

    });

    el.modal.addEventListener("click", event => {

        if (event.target === el.modal) {
            closeConfirmation();
        }

    });

    document.addEventListener(
        "keydown",
        handleModalKeyboard
    );

    el.exportForm.addEventListener(
        "submit",
        exportData
    );

    el.selectAll.addEventListener(
        "click",
        () => setExportSelection(true)
    );

    el.clearExport.addEventListener(
        "click",
        () => setExportSelection(false)
    );

    el.menuToggle.addEventListener(
        "click",
        () => setSidebar(
            !el.sidebar.classList.contains("is-open")
        )
    );

    el.sidebarClose.addEventListener(
        "click",
        () => setSidebar(false)
    );

    el.backdrop.addEventListener(
        "click",
        () => setSidebar(false)
    );

    el.sidebarNavigation.addEventListener(
        "click",
        event => {

            if (
                event.target.closest(".admin-nav-link") &&
                el.sidebar.classList.contains("is-open")
            ) {
                setSidebar(false);
            }

        }
    );

    document.addEventListener("keydown", event => {

        if (
            event.key === "Escape" &&
            !state.modalOpen &&
            el.sidebar.classList.contains("is-open")
        ) {
            setSidebar(false);
        }

    });

    window.matchMedia("(min-width: 901px)")
        .addEventListener("change", event => {

            if (event.matches) {

                el.sidebar.classList.remove("is-open");

                el.backdrop.hidden = true;

                el.menuToggle.setAttribute(
                    "aria-expanded",
                    "false"
                );

            }

        });

    el.sidebarLogout.addEventListener(
        "click",
        logout
    );

    el.topbarLogout.addEventListener(
        "click",
        logout
    );

}


/* =====================================================
   21. INITIALIZATION
===================================================== */

function initialize() {

    if (
        state.initialized ||
        document.body.dataset.page !== "admin-import-export"
    ) {
        return;
    }

    Object.entries(SELECTORS).forEach(
        ([key, selector]) => {

            el[key] = document.querySelector(selector);

        }
    );

    const missing = Object.keys(
        SELECTORS
    ).filter(key => !el[key]);

    if (missing.length) {

        console.error(
            "[Import / Export] Missing HTML elements:",
            missing
        );

        return;

    }

    state.initialized = true;

    setText(
        el.year,
        new Date().getFullYear()
    );

    registerEvents();

    setControls();

    showGate(
        "Verifying Administrator Access",
        "Checking your administrator session."
    );

    observeAuthentication();

}


/* =====================================================
   22. START APPLICATION
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
   END OF ADMIN-IMPORT-EXPORT.JS
===================================================== */
