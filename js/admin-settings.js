
/*
=========================================================
YADAV EXAMPREP
File: js/admin-settings.js

Administrator Website Settings Controller

Designed and Developed by Yadav Web Technologies

Database:
    admin/settings
    public/settings

IMPORTANT:
- Firebase Realtime Database, not Firestore.
- Administrator authentication is mandatory.
- Public visitors do not need authentication.
- No educational seed records are generated.
- Protected settings and public mirrors are separate.
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
    onValue,
    update
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";


/* =====================================================
   01. CONFIGURATION
===================================================== */

const CONFIG = Object.freeze({

    adminUID: "6HwAPbqwYBgg5Ih2zWycOZFBCe93",

    adminPath: "admin/settings",

    publicPath: "public/settings",

    publicSections: [
        "identity",
        "contact",
        "homepage",
        "publicControls"
    ]

});


/* =====================================================
   02. ELEMENT SELECTORS
===================================================== */

const SELECTORS = {

    gate: "#adminAuthGate",
    gateSpinner: "#adminGateSpinner",
    gateTitle: "#adminGateTitle",
    gateDescription: "#adminGateDescription",
    gateLoginLink: "#adminGateLoginLink",

    app: "#adminSettingsApp",

    sidebar: "#adminSidebar",
    backdrop: "#adminSidebarBackdrop",
    menuToggle: "#adminMenuToggle",
    sidebarClose: "#adminSidebarClose",
    sidebarNavigation: "#adminSidebarNavigation",
    sidebarLogout: "#adminSidebarLogout",
    topbarLogout: "#adminTopbarLogout",
    userEmail: "#adminUserEmail",

    refresh: "#refreshSettingsButton",

    status: "#settingsManagementStatus",
    statusSpinner: "#settingsManagementSpinner",
    statusText: "#settingsManagementStatusText",

    identityForm: "#websiteIdentityForm",
    websiteName: "#websiteName",
    websiteTagline: "#websiteTagline",
    websiteDescription: "#websiteDescription",
    saveIdentity: "#saveIdentityButton",
    saveIdentityText: "#saveIdentityButtonText",
    saveIdentitySpinner: "#saveIdentitySpinner",

    contactForm: "#contactSettingsForm",
    contactEmail: "#contactEmail",
    contactPhone: "#contactPhone",
    contactAddress: "#contactAddress",
    contactMessage: "#contactMessage",
    saveContact: "#saveContactButton",
    saveContactText: "#saveContactButtonText",
    saveContactSpinner: "#saveContactSpinner",

    homepageForm: "#homepageSettingsForm",
    showFeaturedExams: "#showFeaturedExams",
    showFeaturedSubjects: "#showFeaturedSubjects",
    showFeaturedTests: "#showFeaturedTests",
    showLearningSection: "#showLearningSection",
    homepageExamLimit: "#homepageExamLimit",
    homepageTestLimit: "#homepageTestLimit",
    saveHomepage: "#saveHomepageButton",
    saveHomepageText: "#saveHomepageButtonText",
    saveHomepageSpinner: "#saveHomepageSpinner",

    defaultsForm: "#testDefaultsForm",
    defaultTestDuration: "#defaultTestDuration",
    defaultQuestionMarks: "#defaultQuestionMarks",
    defaultNegativeMarks: "#defaultNegativeMarks",
    saveDefaults: "#saveTestDefaultsButton",
    saveDefaultsText: "#saveTestDefaultsButtonText",
    saveDefaultsSpinner: "#saveTestDefaultsSpinner",

    publicForm: "#publicControlsForm",
    maintenanceMode: "#maintenanceMode",
    maintenanceMessage: "#maintenanceMessage",
    savePublic: "#savePublicControlsButton",
    savePublicText: "#savePublicControlsButtonText",
    savePublicSpinner: "#savePublicControlsSpinner",

    databaseStatus: "#settingsDatabaseStatus",
    administratorEmail: "#settingsAdministratorEmail",
    lastUpdated: "#settingsLastUpdated",

    year: "#currentYear"

};


/* =====================================================
   03. STATE
===================================================== */

const state = {

    initialized: false,

    authorized: false,

    loaded: false,

    busy: false,

    signingOut: false,

    session: 0,

    settings: {},

    unsubscribeSettings: null,

    activeSave: null,

    dirtySections: new Set()

};

const el = {};


/* =====================================================
   04. DEFAULT SETTINGS
===================================================== */

/*
These are generic website configuration defaults,
not sample educational content.

They are used for displaying an initially empty
settings form. They are not automatically written
to Firebase.
*/

const DEFAULTS = {

    identity: {

        websiteName: "Yadav ExamPrep",

        websiteTagline:
            "Learn, Practice and Prepare with Confidence",

        websiteDescription:
            "Free exam preparation, structured learning and mock tests."

    },

    contact: {

        contactEmail: "",

        contactPhone: "",

        contactAddress: "",

        contactMessage: ""

    },

    homepage: {

        showFeaturedExams: true,

        showFeaturedSubjects: true,

        showFeaturedTests: true,

        showLearningSection: true,

        homepageExamLimit: 8,

        homepageTestLimit: 6

    },

    testDefaults: {

        defaultTestDuration: 30,

        defaultQuestionMarks: 1,

        defaultNegativeMarks: 0

    },

    publicControls: {

        maintenanceMode: false,

        maintenanceMessage:
            "The website is temporarily undergoing maintenance. Please visit again later."

    }

};


/* =====================================================
   05. GENERAL HELPERS
===================================================== */

function setText(element, value) {

    if (element) {

        element.textContent = String(value);

    }

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

function clean(value) {

    return typeof value === "string"
        ? value.trim()
        : "";

}

function validNumber(
    value,
    minimum,
    maximum,
    integer = false
) {

    if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < minimum ||
        value > maximum
    ) {

        return false;

    }

    if (integer) {

        return Number.isInteger(value);

    }

    return Math.abs(

        value * 100 -

        Math.round(value * 100)

    ) < 0.000001;

}

function sessionValid(version) {

    return (

        state.authorized &&

        state.session === version &&

        auth.currentUser?.uid === CONFIG.adminUID

    );

}

function canEdit() {

    return (

        state.authorized &&

        state.loaded &&

        !state.busy &&

        Boolean(database) &&

        isDatabaseConfigured()

    );

}

function formatDate(value) {

    if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value <= 0
    ) {

        return "Not saved yet";

    }

    const milliseconds = value < 100000000000
        ? value * 1000
        : value;

    return new Intl.DateTimeFormat("en-IN", {

        dateStyle: "medium",

        timeStyle: "short"

    }).format(new Date(milliseconds));

}

function mergeSection(section, settings = state.settings) {

    return {

        ...DEFAULTS[section],

        ...normalize(settings?.[section])

    };

}


/* =====================================================
   06. STATUS DISPLAY
===================================================== */

function showGate(
    title,
    description,
    login = false
) {

    el.app.hidden = true;

    el.gate.hidden = false;

    setText(el.gateTitle, title);

    setText(el.gateDescription, description);

    el.gateSpinner.hidden = login;

    el.gateLoginLink.hidden = !login;

}

function showStatus(
    message,
    type = "loading"
) {

    el.status.hidden = false;

    el.status.classList.remove(

        "is-error",

        "is-success",

        "is-warning"

    );

    if (type !== "loading") {

        el.status.classList.add(
            `is-${type}`
        );

    }

    el.statusSpinner.hidden =
        type !== "loading";

    setText(
        el.statusText,
        message
    );

}


/* =====================================================
   07. FORM CONFIGURATION
===================================================== */

const FORM_CONFIG = {

    identity: {

        form: "identityForm",

        button: "saveIdentity",

        buttonText: "saveIdentityText",

        spinner: "saveIdentitySpinner",

        label: "Website Identity"

    },

    contact: {

        form: "contactForm",

        button: "saveContact",

        buttonText: "saveContactText",

        spinner: "saveContactSpinner",

        label: "Contact Information"

    },

    homepage: {

        form: "homepageForm",

        button: "saveHomepage",

        buttonText: "saveHomepageText",

        spinner: "saveHomepageSpinner",

        label: "Homepage Preferences"

    },

    testDefaults: {

        form: "defaultsForm",

        button: "saveDefaults",

        buttonText: "saveDefaultsText",

        spinner: "saveDefaultsSpinner",

        label: "Mock Test Defaults"

    },

    publicControls: {

        form: "publicForm",

        button: "savePublic",

        buttonText: "savePublicText",

        spinner: "savePublicSpinner",

        label: "Public Website Controls"

    }

};


/* =====================================================
   08. ENABLE / DISABLE CONTROLS
===================================================== */

function setControls() {

    const enabled = canEdit();

    el.refresh.disabled = !enabled;

    Object.entries(FORM_CONFIG).forEach(
        ([section, config]) => {

            const form = el[config.form];

            form.querySelectorAll(

                "input, textarea, select, button"

            ).forEach(control => {

                control.disabled = !enabled;

            });

            const saving =
                state.activeSave === section;

            el[config.spinner].hidden = !saving;

            setText(

                el[config.buttonText],

                saving
                    ? "Saving..."
                    : `Save ${config.label}`

            );

        }
    );

}


/* =====================================================
   09. RENDER WEBSITE IDENTITY
===================================================== */

function renderIdentity() {

    const data = mergeSection("identity");

    el.websiteName.value =
        data.websiteName;

    el.websiteTagline.value =
        data.websiteTagline;

    el.websiteDescription.value =
        data.websiteDescription;

}


/* =====================================================
   10. RENDER CONTACT INFORMATION
===================================================== */

function renderContact() {

    const data = mergeSection("contact");

    el.contactEmail.value =
        data.contactEmail;

    el.contactPhone.value =
        data.contactPhone;

    el.contactAddress.value =
        data.contactAddress;

    el.contactMessage.value =
        data.contactMessage;

}


/* =====================================================
   11. RENDER HOMEPAGE PREFERENCES
===================================================== */

function renderHomepage() {

    const data = mergeSection("homepage");

    el.showFeaturedExams.checked =
        data.showFeaturedExams === true;

    el.showFeaturedSubjects.checked =
        data.showFeaturedSubjects === true;

    el.showFeaturedTests.checked =
        data.showFeaturedTests === true;

    el.showLearningSection.checked =
        data.showLearningSection === true;

    el.homepageExamLimit.value =
        data.homepageExamLimit;

    el.homepageTestLimit.value =
        data.homepageTestLimit;

}


/* =====================================================
   12. RENDER MOCK TEST DEFAULTS
===================================================== */

function renderTestDefaults() {

    const data = mergeSection("testDefaults");

    el.defaultTestDuration.value =
        data.defaultTestDuration;

    el.defaultQuestionMarks.value =
        data.defaultQuestionMarks;

    el.defaultNegativeMarks.value =
        data.defaultNegativeMarks;

}


/* =====================================================
   13. RENDER PUBLIC CONTROLS
===================================================== */

function renderPublicControls() {

    const data = mergeSection("publicControls");

    el.maintenanceMode.checked =
        data.maintenanceMode === true;

    el.maintenanceMessage.value =
        data.maintenanceMessage;

}


/* =====================================================
   14. RENDER ALL SETTINGS
===================================================== */

const RENDERERS = {

    identity: renderIdentity,

    contact: renderContact,

    homepage: renderHomepage,

    testDefaults: renderTestDefaults,

    publicControls: renderPublicControls

};

function renderSettings() {

    Object.entries(RENDERERS).forEach(
        ([section, renderer]) => {

            /*
             * Preserve unsaved user input if another
             * administrator/database update arrives.
             */

            if (
                !state.dirtySections.has(section) &&
                state.activeSave !== section
            ) {

                renderer();

            }

        }
    );

    setText(

        el.lastUpdated,

        formatDate(
            state.settings.updatedAt
        )

    );

    setControls();

}


/* =====================================================
   15. DATABASE SUBSCRIPTION
===================================================== */

function stopSubscription() {

    if (state.unsubscribeSettings) {

        state.unsubscribeSettings();

        state.unsubscribeSettings = null;

    }

}

function subscribeSettings(version) {

    stopSubscription();

    state.loaded = false;

    showStatus(
        "Loading website settings..."
    );

    state.unsubscribeSettings = onValue(

        ref(
            database,
            CONFIG.adminPath
        ),

        snapshot => {

            if (!sessionValid(version)) {
                return;
            }

            state.settings = normalize(
                snapshot.val()
            );

            state.loaded = true;

            renderSettings();

            if (!state.busy) {

                showStatus(
                    "Website settings loaded successfully.",
                    "success"
                );

            }

        },

        error => {

            if (!sessionValid(version)) {
                return;
            }

            state.loaded = false;

            console.error(

                "[Admin Settings] Database subscription:",

                error?.code

            );

            showStatus(

                "Unable to load settings. Check Firebase Realtime Database permissions.",

                "error"

            );

            setControls();

        }

    );

}


/* =====================================================
   16. AUTHENTICATION
===================================================== */

function observeAuthentication() {

    onAuthStateChanged(

        auth,

        async user => {

            const version = ++state.session;

            stopSubscription();

            state.loaded = false;

            state.dirtySections.clear();

            if (
                !user ||
                user.uid !== CONFIG.adminUID
            ) {

                state.authorized = false;

                state.settings = {};

                setControls();

                showGate(

                    user
                        ? "Access Denied"
                        : "Sign In Required",

                    user
                        ? "This account is not authorized to manage website settings."
                        : "Sign in with your administrator account.",

                    true

                );

                if (user) {

                    try {

                        await signOut(auth);

                    } catch (error) {

                        console.error(

                            "[Admin Settings] Unauthorized sign-out:",

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

            setText(

                el.administratorEmail,

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

                    "Configure your actual Firebase Realtime Database URL in js/firebase-config.js.",

                    "error"

                );

                setControls();

                return;

            }

            setText(

                el.databaseStatus,

                "Configured"

            );

            subscribeSettings(version);

        },

        error => {

            ++state.session;

            stopSubscription();

            state.authorized = false;

            state.loaded = false;

            console.error(

                "[Admin Settings] Authentication:",

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
   17. READ FORM VALUES
===================================================== */

function readIdentity() {

    return {

        websiteName:
            clean(el.websiteName.value),

        websiteTagline:
            clean(el.websiteTagline.value),

        websiteDescription:
            clean(el.websiteDescription.value)

    };

}

function readContact() {

    return {

        contactEmail:
            clean(el.contactEmail.value),

        contactPhone:
            clean(el.contactPhone.value),

        contactAddress:
            clean(el.contactAddress.value),

        contactMessage:
            clean(el.contactMessage.value)

    };

}

function readHomepage() {

    return {

        showFeaturedExams:
            el.showFeaturedExams.checked,

        showFeaturedSubjects:
            el.showFeaturedSubjects.checked,

        showFeaturedTests:
            el.showFeaturedTests.checked,

        showLearningSection:
            el.showLearningSection.checked,

        homepageExamLimit:
            Number(el.homepageExamLimit.value),

        homepageTestLimit:
            Number(el.homepageTestLimit.value)

    };

}

function readTestDefaults() {

    return {

        defaultTestDuration:
            Number(el.defaultTestDuration.value),

        defaultQuestionMarks:
            Number(el.defaultQuestionMarks.value),

        defaultNegativeMarks:
            Number(el.defaultNegativeMarks.value)

    };

}

function readPublicControls() {

    return {

        maintenanceMode:
            el.maintenanceMode.checked,

        maintenanceMessage:
            clean(el.maintenanceMessage.value)

    };

}

const READERS = {

    identity: readIdentity,

    contact: readContact,

    homepage: readHomepage,

    testDefaults: readTestDefaults,

    publicControls: readPublicControls

};


/* =====================================================
   18. VALIDATION
===================================================== */

function validateIdentity(data) {

    if (
        !data.websiteName ||
        data.websiteName.length > 100
    ) {

        return "Website name must contain 1–100 characters.";

    }

    if (data.websiteTagline.length > 160) {

        return "Website tagline cannot exceed 160 characters.";

    }

    if (data.websiteDescription.length > 600) {

        return "Website description cannot exceed 600 characters.";

    }

    return null;

}

function validateContact(data) {

    if (data.contactEmail) {

        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (
            data.contactEmail.length > 254 ||
            !emailPattern.test(data.contactEmail)
        ) {

            return "Enter a valid public email address.";

        }

    }

    if (
        data.contactPhone &&
        (
            data.contactPhone.length > 20 ||
            !/^[+\d\s().-]+$/.test(
                data.contactPhone
            )
        )
    ) {

        return "Enter a valid phone number.";

    }

    if (data.contactAddress.length > 400) {

        return "Contact address cannot exceed 400 characters.";

    }

    if (data.contactMessage.length > 500) {

        return "Contact introduction cannot exceed 500 characters.";

    }

    return null;

}

function validateHomepage(data) {

    if (
        !validNumber(
            data.homepageExamLimit,
            1,
            24,
            true
        )
    ) {

        return "Featured exam limit must be a whole number between 1 and 24.";

    }

    if (
        !validNumber(
            data.homepageTestLimit,
            1,
            24,
            true
        )
    ) {

        return "Featured mock test limit must be a whole number between 1 and 24.";

    }

    return null;

}

function validateTestDefaults(data) {

    if (
        !validNumber(
            data.defaultTestDuration,
            0,
            360,
            true
        )
    ) {

        return "Default duration must be a whole number between 0 and 360 minutes.";

    }

    if (
        !validNumber(
            data.defaultQuestionMarks,
            0.01,
            1000
        )
    ) {

        return "Default question marks must be between 0.01 and 1000, with up to two decimal places.";

    }

    if (
        !validNumber(
            data.defaultNegativeMarks,
            0,
            1000
        )
    ) {

        return "Default negative marks must be between 0 and 1000, with up to two decimal places.";

    }

    return null;

}

function validatePublicControls(data) {

    if (data.maintenanceMessage.length > 500) {

        return "Maintenance notice cannot exceed 500 characters.";

    }

    if (
        data.maintenanceMode &&
        !data.maintenanceMessage
    ) {

        return "Enter a maintenance notice before enabling maintenance mode.";

    }

    return null;

}

const VALIDATORS = {

    identity: validateIdentity,

    contact: validateContact,

    homepage: validateHomepage,

    testDefaults: validateTestDefaults,

    publicControls: validatePublicControls

};


/* =====================================================
   19. SAVE INDIVIDUAL SETTINGS SECTION
===================================================== */

async function saveSection(section, event) {

    event.preventDefault();

    if (
        !canEdit() ||
        !FORM_CONFIG[section]
    ) {

        return;

    }

    const data = READERS[section]();

    const validationError =
        VALIDATORS[section](data);

    if (validationError) {

        showStatus(
            validationError,
            "error"
        );

        return;

    }

    const version = state.session;

    state.busy = true;

    state.activeSave = section;

    setControls();

    showStatus(

        `Saving ${FORM_CONFIG[section].label.toLowerCase()}...`

    );

    try {

        /*
         * Read the latest section before saving.
         * A section update must not replace unrelated
         * settings collections.
         */

        const snapshot = await get(

            ref(
                database,
                `${CONFIG.adminPath}/${section}`
            )

        );

        if (!sessionValid(version)) {

            throw new Error(
                "Administrator session changed."
            );

        }

        const previous = normalize(
            snapshot.val()
        );

        const now = Date.now();

        const record = {

            ...data,

            createdAt:
                typeof previous.createdAt === "number"
                    ? previous.createdAt
                    : now,

            updatedAt: now

        };

        const changes = {

            [`${CONFIG.adminPath}/${section}`]:
                record,

            [`${CONFIG.adminPath}/updatedAt`]:
                now

        };

        /*
         * Only safe public-facing settings are mirrored.
         *
         * Mock test defaults remain under admin/settings.
         */

        if (
            CONFIG.publicSections.includes(section)
        ) {

            changes[
                `${CONFIG.publicPath}/${section}`
            ] = record;

        }

        /*
         * Multi-location update keeps the admin section
         * and its public mirror in one atomic write.
         */

        await update(

            ref(database),

            changes

        );

        if (!sessionValid(version)) {
            return;
        }

        state.settings = {

            ...state.settings,

            [section]: record,

            updatedAt: now

        };

        state.dirtySections.delete(section);

        setText(

            el.lastUpdated,

            formatDate(now)

        );

        showStatus(

            `${FORM_CONFIG[section].label} saved successfully.`,

            "success"

        );

    } catch (error) {

        console.error(

            `[Admin Settings] Save ${section}:`,

            error?.code || error?.message

        );

        showStatus(

            error?.code
                ? "Unable to save settings. Check Firebase Security Rules and administrator permissions."
                : error.message,

            "error"

        );

    } finally {

        state.busy = false;

        state.activeSave = null;

        if (sessionValid(version)) {

            renderSettings();

        } else {

            setControls();

        }

    }

}


/* =====================================================
   20. MANUAL REFRESH
===================================================== */

async function refreshSettings() {

    if (!canEdit()) {
        return;
    }

    if (state.dirtySections.size > 0) {

        const confirmed = window.confirm(

            "You have unsaved changes. Discard them and reload saved settings?"

        );

        if (!confirmed) {
            return;
        }

    }

    const version = state.session;

    state.busy = true;

    setControls();

    showStatus(
        "Refreshing saved settings..."
    );

    try {

        const snapshot = await get(

            ref(
                database,
                CONFIG.adminPath
            )

        );

        if (!sessionValid(version)) {
            return;
        }

        state.settings = normalize(
            snapshot.val()
        );

        state.dirtySections.clear();

        renderSettings();

        showStatus(

            "Settings refreshed successfully.",

            "success"

        );

    } catch (error) {

        console.error(

            "[Admin Settings] Refresh:",

            error?.code

        );

        showStatus(

            "Unable to refresh settings.",

            "error"

        );

    } finally {

        state.busy = false;

        setControls();

    }

}


/* =====================================================
   21. TRACK UNSAVED CHANGES
===================================================== */

function registerDirtyTracking() {

    Object.entries(FORM_CONFIG).forEach(
        ([section, config]) => {

            const form = el[config.form];

            const markDirty = () => {

                if (
                    state.loaded &&
                    !state.busy
                ) {

                    state.dirtySections.add(section);

                }

            };

            form.addEventListener(
                "input",
                markDirty
            );

            form.addEventListener(
                "change",
                markDirty
            );

        }
    );

}


/* =====================================================
   22. SIDEBAR
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
   23. SIGN OUT
===================================================== */

async function logout() {

    if (state.signingOut) {
        return;
    }

    if (state.dirtySections.size > 0) {

        const confirmed = window.confirm(

            "You have unsaved settings. Sign out without saving?"

        );

        if (!confirmed) {
            return;
        }

    }

    state.signingOut = true;

    el.sidebarLogout.disabled = true;

    el.topbarLogout.disabled = true;

    try {

        stopSubscription();

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
   24. REGISTER EVENTS
===================================================== */

function registerEvents() {

    /*
     * Individual form submission.
     */

    Object.entries(FORM_CONFIG).forEach(
        ([section, config]) => {

            el[config.form].addEventListener(

                "submit",

                event => saveSection(
                    section,
                    event
                )

            );

        }
    );

    registerDirtyTracking();

    /*
     * Refresh.
     */

    el.refresh.addEventListener(

        "click",

        refreshSettings

    );

    /*
     * Mobile sidebar.
     */

    el.menuToggle.addEventListener(

        "click",

        () => setSidebar(

            !el.sidebar.classList.contains(
                "is-open"
            )

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

    /*
     * Close navigation when a sidebar link is selected.
     */

    el.sidebarNavigation.addEventListener(

        "click",

        event => {

            if (

                event.target.closest(
                    ".admin-nav-link"
                ) &&

                el.sidebar.classList.contains(
                    "is-open"
                )

            ) {

                setSidebar(false);

            }

        }

    );

    /*
     * Escape key.
     */

    document.addEventListener(

        "keydown",

        event => {

            if (

                event.key === "Escape" &&

                el.sidebar.classList.contains(
                    "is-open"
                )

            ) {

                setSidebar(false);

            }

        }

    );

    /*
     * Desktop breakpoint.
     */

    window.matchMedia(
        "(min-width: 901px)"
    ).addEventListener(

        "change",

        event => {

            if (event.matches) {

                el.sidebar.classList.remove(
                    "is-open"
                );

                el.backdrop.hidden = true;

                el.menuToggle.setAttribute(

                    "aria-expanded",

                    "false"

                );

            }

        }

    );

    /*
     * Sign-out buttons.
     */

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
   25. INITIALIZATION
===================================================== */

function initialize() {

    if (

        state.initialized ||

        document.body.dataset.page !==
            "admin-settings"

    ) {

        return;

    }

    /*
     * Match all required elements with
     * admin/settings.html.
     */

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

            "[Admin Settings] Missing HTML elements:",

            missing

        );

        return;

    }

    state.initialized = true;

    setText(

        el.year,

        new Date().getFullYear()

    );

    /*
     * Display generic defaults locally until
     * actual settings have been loaded.
     */

    renderSettings();

    registerEvents();

    setControls();

    showGate(

        "Verifying Administrator Access",

        "Checking your administrator session."

    );

    observeAuthentication();

}


/* =====================================================
   26. START APPLICATION
===================================================== */

if (
    document.readyState === "loading"
) {

    document.addEventListener(

        "DOMContentLoaded",

        initialize,

        { once: true }

    );

} else {

    initialize();

}

/* =====================================================
   END OF ADMIN-SETTINGS.JS
===================================================== */
