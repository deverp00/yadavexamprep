
/*
=========================================================
YADAV EXAMPREP
File: js/admin-login.js

Secure Administrator Login Controller

Designed and Developed by Yadav Web Technologies

IMPORTANT:
Client-side UID verification is only a UI access check.
Firebase Security Rules must independently enforce
administrator permissions.
=========================================================
*/

"use strict";


/* =====================================================
   01. FIREBASE IMPORTS
===================================================== */

import {

    auth

} from "./firebase-config.js";


import {

    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut

} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";


/* =====================================================
   02. ADMIN CONFIGURATION
===================================================== */

const ADMIN_CONFIG = Object.freeze({

    authorizedUID: "6HwAPbqwYBgg5Ih2zWycOZFBCe93",

    dashboardURL: "../admin/dashboard.html",

    selectors: {

        form: "#adminLoginForm",

        email: "#adminEmail",

        password: "#adminPassword",

        passwordToggle: "#adminPasswordToggle",

        submitButton: "#adminLoginButton",

        submitText: "#adminLoginButtonText",

        spinner: "#adminLoginSpinner",

        status: "#adminAuthStatus",

        statusMessage: "#adminAuthMessage",

        currentYear: "#currentYear"

    }

});


/* =====================================================
   03. APPLICATION STATE
===================================================== */

const state = {

    initialized: false,

    submitting: false,

    redirecting: false,

    authenticationResolved: false

};


const elements = {};


/* =====================================================
   04. STATUS MESSAGE
===================================================== */

function showStatus(message, type = "error") {

    elements.status.hidden = false;

    elements.status.classList.remove(

        "is-error",
        "is-success",
        "is-loading"

    );

    elements.status.classList.add(
        `is-${type}`
    );

    elements.statusMessage.textContent = message;

}


function clearStatus() {

    elements.status.hidden = true;

    elements.statusMessage.textContent = "";

    elements.status.classList.remove(

        "is-error",
        "is-success",
        "is-loading"

    );

}


/* =====================================================
   05. LOADING STATE
===================================================== */

function setLoading(loading) {

    state.submitting = loading;

    elements.submitButton.disabled = loading;

    elements.email.disabled = loading;

    elements.password.disabled = loading;

    elements.passwordToggle.disabled = loading;

    elements.spinner.hidden = !loading;

    elements.submitText.textContent = loading
        ? "Please Wait..."
        : "Sign In to Dashboard";

    elements.form.setAttribute(
        "aria-busy",
        String(loading)
    );

}


/* =====================================================
   06. INPUT VALIDATION
===================================================== */

function validateInputs() {

    const email = elements.email.value.trim();

    const password = elements.password.value;

    elements.email.removeAttribute("aria-invalid");

    elements.password.removeAttribute("aria-invalid");

    if (!email) {

        elements.email.setAttribute(
            "aria-invalid",
            "true"
        );

        elements.email.focus();

        showStatus(
            "Please enter your administrator email address."
        );

        return null;

    }

    if (!elements.email.validity.valid) {

        elements.email.setAttribute(
            "aria-invalid",
            "true"
        );

        elements.email.focus();

        showStatus(
            "Please enter a valid email address."
        );

        return null;

    }

    if (!password) {

        elements.password.setAttribute(
            "aria-invalid",
            "true"
        );

        elements.password.focus();

        showStatus(
            "Please enter your administrator password."
        );

        return null;

    }

    return {

        email,
        password

    };

}


/* =====================================================
   07. FIREBASE ERROR MESSAGES
===================================================== */

function getAuthenticationError(error) {

    const messages = {

        "auth/invalid-email":
            "Please enter a valid email address.",

        "auth/invalid-credential":
            "Incorrect email or password. Please try again.",

        "auth/wrong-password":
            "Incorrect email or password. Please try again.",

        "auth/user-not-found":
            "Incorrect email or password. Please try again.",

        "auth/user-disabled":
            "This administrator account has been disabled.",

        "auth/too-many-requests":
            "Too many login attempts. Please try again later.",

        "auth/network-request-failed":
            "Network connection failed. Please check your internet connection.",

        "auth/operation-not-allowed":
            "Email/Password Authentication is not enabled in Firebase.",

        "auth/invalid-api-key":
            "Firebase configuration is invalid.",

        "auth/unauthorized-domain":
            "This website domain is not authorized in Firebase Authentication."

    };

    return messages[error?.code] ||

        "Unable to sign in. Please try again.";

}


/* =====================================================
   08. ADMIN UID VERIFICATION
===================================================== */

function isAuthorizedAdministrator(user) {

    return Boolean(

        user &&

        typeof user.uid === "string" &&

        user.uid === ADMIN_CONFIG.authorizedUID

    );

}


/* =====================================================
   09. DASHBOARD REDIRECTION
===================================================== */

function redirectToDashboard() {

    if (state.redirecting) {
        return;
    }

    state.redirecting = true;

    showStatus(

        "Administrator verified. Opening your dashboard...",

        "success"

    );

    window.location.replace(
        ADMIN_CONFIG.dashboardURL
    );

}


/* =====================================================
   10. UNAUTHORIZED USER HANDLING
===================================================== */

async function rejectUnauthorizedUser() {

    try {

        await signOut(auth);

    } catch (error) {

        console.error(
            "[Yadav ExamPrep] Sign-out error:",
            error
        );

    }

    showStatus(

        "Access denied. This Firebase account is not authorized to manage Yadav ExamPrep.",

        "error"

    );

}


/* =====================================================
   11. ADMIN LOGIN SUBMISSION
===================================================== */

async function handleLogin(event) {

    event.preventDefault();

    if (
        state.submitting ||
        state.redirecting ||
        !state.authenticationResolved
    ) {
        return;
    }

    clearStatus();

    const credentials = validateInputs();

    if (!credentials) {
        return;
    }

    setLoading(true);

    showStatus(

        "Verifying administrator credentials...",

        "loading"

    );

    try {

        const credential = await signInWithEmailAndPassword(

            auth,

            credentials.email,

            credentials.password

        );

        const user = credential.user;

        if (!isAuthorizedAdministrator(user)) {

            await rejectUnauthorizedUser();

            elements.password.value = "";

            return;

        }

        redirectToDashboard();

    } catch (error) {

        console.error(

            "[Yadav ExamPrep] Authentication error:",

            error?.code || "unknown"

        );

        showStatus(
            getAuthenticationError(error),
            "error"
        );

        elements.password.value = "";

        elements.password.focus();

    } finally {

        if (!state.redirecting) {

            setLoading(false);

        }

    }

}


/* =====================================================
   12. EXISTING SESSION DETECTION
===================================================== */

function observeAuthentication() {

    onAuthStateChanged(

        auth,

        async user => {

            state.authenticationResolved = true;

            if (state.redirecting) {
                return;
            }

            if (!user) {

                if (!state.submitting) {

                    clearStatus();

                }

                return;

            }

            if (isAuthorizedAdministrator(user)) {

                redirectToDashboard();

                return;

            }

            /*
             * Avoid competing with the login handler
             * while it verifies a newly signed-in user.
             */

            if (state.submitting) {
                return;
            }

            await rejectUnauthorizedUser();

        },

        error => {

            state.authenticationResolved = true;

            console.error(

                "[Yadav ExamPrep] Session verification error:",

                error?.code || "unknown"

            );

            showStatus(

                "Unable to verify your administrator session. Please refresh and try again.",

                "error"

            );

        }

    );

}


/* =====================================================
   13. PASSWORD VISIBILITY TOGGLE
===================================================== */

function togglePasswordVisibility() {

    const currentlyHidden =

        elements.password.type === "password";

    elements.password.type = currentlyHidden
        ? "text"
        : "password";

    elements.passwordToggle.setAttribute(

        "aria-pressed",

        String(currentlyHidden)

    );

    elements.passwordToggle.setAttribute(

        "aria-label",

        currentlyHidden
            ? "Hide password"
            : "Show password"

    );

}


/* =====================================================
   14. REGISTER EVENT LISTENERS
===================================================== */

function registerEvents() {

    elements.form.addEventListener(

        "submit",

        handleLogin

    );

    elements.passwordToggle.addEventListener(

        "click",

        togglePasswordVisibility

    );

    elements.email.addEventListener(

        "input",

        () => {

            elements.email.removeAttribute(
                "aria-invalid"
            );

        }

    );

    elements.password.addEventListener(

        "input",

        () => {

            elements.password.removeAttribute(
                "aria-invalid"
            );

        }

    );

}


/* =====================================================
   15. CURRENT YEAR
===================================================== */

function updateCurrentYear() {

    if (!elements.currentYear) {
        return;
    }

    elements.currentYear.textContent =

        String(new Date().getFullYear());

}


/* =====================================================
   16. INITIALIZE ADMIN LOGIN
===================================================== */

function initializeAdminLogin() {

    if (

        document.body.dataset.page !== "admin-login" ||

        state.initialized

    ) {
        return;
    }

    Object.entries(
        ADMIN_CONFIG.selectors
    ).forEach(([key, selector]) => {

        elements[key] = document.querySelector(
            selector
        );

    });

    const requiredElements = [

        "form",
        "email",
        "password",
        "passwordToggle",
        "submitButton",
        "submitText",
        "spinner",
        "status",
        "statusMessage"

    ];

    const missing = requiredElements.filter(
        key => !elements[key]
    );

    if (missing.length > 0) {

        console.error(

            "[Yadav ExamPrep] Missing login elements:",

            missing

        );

        return;

    }

    state.initialized = true;

    updateCurrentYear();

    registerEvents();

    /*
     * Prevent submission until Firebase resolves
     * the existing authentication session.
     */

    elements.submitButton.disabled = true;

    showStatus(

        "Checking administrator session...",

        "loading"

    );

    observeAuthentication();

}


/* =====================================================
   17. START APPLICATION
===================================================== */

if (document.readyState === "loading") {

    document.addEventListener(

        "DOMContentLoaded",

        initializeAdminLogin,

        { once: true }

    );

} else {

    initializeAdminLogin();

}


/* =====================================================
   END OF ADMIN-LOGIN.JS
===================================================== */
