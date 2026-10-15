
/*
=========================================================
YADAV EXAMPREP
File: js/admin-login.js

Administrator Authentication Controller
Firebase Authentication

Designed and Developed by Yadav Web Technologies
=========================================================
*/

"use strict";

import {
    auth
} from "./firebase-config.js";

import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";


/* =====================================================
   01. CONFIGURATION
===================================================== */

const CONFIG = Object.freeze({

    adminUID: "6HwAPbqwYBgg5Ih2zWycOZFBCe93",

    dashboardURL: "dashboard.html",

    selectors: {

        form: "#adminLoginForm",

        email: "#adminEmail",

        password: "#adminPassword",

        passwordToggle: "#adminPasswordToggle",

        status: "#adminAuthStatus",

        message: "#adminAuthMessage",

        submitButton: "#adminLoginButton",

        submitText: "#adminLoginButtonText",

        spinner: "#adminLoginSpinner",

        year: "#currentYear"

    }

});


/* =====================================================
   02. STATE
===================================================== */

const state = {

    initialized: false,

    authenticationResolved: false,

    submitting: false,

    redirecting: false,

    rejectingUnauthorizedUser: false

};

const el = {};


/* =====================================================
   03. ELEMENT HELPERS
===================================================== */

function setText(element, value) {

    if (element) {
        element.textContent = String(value);
    }

}

function setStatus(message, type = "loading") {

    el.status.hidden = false;

    el.status.classList.remove(
        "is-error",
        "is-success",
        "is-loading"
    );

    el.status.classList.add(`is-${type}`);

    setText(el.message, message);

}

function clearStatus() {

    el.status.hidden = true;

    el.status.classList.remove(
        "is-error",
        "is-success",
        "is-loading"
    );

    setText(el.message, "");

}


/* =====================================================
   04. BUTTON STATE
===================================================== */

function updateSubmitButton() {

    const disabled = (

        !state.authenticationResolved ||

        state.submitting ||

        state.redirecting ||

        state.rejectingUnauthorizedUser

    );

    el.submitButton.disabled = disabled;

    el.spinner.hidden = !state.submitting;

    setText(
        el.submitText,
        state.redirecting
            ? "Opening Dashboard..."
            : state.submitting
                ? "Signing In..."
                : state.rejectingUnauthorizedUser
                    ? "Verifying Account..."
                    : "Sign In"
    );

}


/* =====================================================
   05. AUTHENTICATION ERRORS
===================================================== */

function getAuthenticationError(error) {

    switch (error?.code) {

        case "auth/invalid-email":

            return "Enter a valid email address.";

        case "auth/invalid-credential":

        case "auth/wrong-password":

        case "auth/user-not-found":

            return "Invalid administrator email or password.";

        case "auth/user-disabled":

            return "This administrator account has been disabled.";

        case "auth/too-many-requests":

            return "Too many unsuccessful attempts. Please try again later.";

        case "auth/network-request-failed":

            return "Network error. Check your internet connection and try again.";

        case "auth/operation-not-allowed":

            return "Email/Password authentication is not enabled in Firebase.";

        case "auth/unauthorized-domain":

            return "This website domain is not authorized in Firebase Authentication.";

        default:

            return "Unable to sign in. Please try again.";

    }

}


/* =====================================================
   06. REDIRECT
===================================================== */

function redirectToDashboard() {

    if (state.redirecting) {
        return;
    }

    state.redirecting = true;

    updateSubmitButton();

    setStatus(
        "Administrator verified. Opening dashboard...",
        "success"
    );

    window.location.replace(
        CONFIG.dashboardURL
    );

}


/* =====================================================
   07. REJECT UNAUTHORIZED ACCOUNT
===================================================== */

async function rejectUnauthorizedUser() {

    if (state.rejectingUnauthorizedUser) {
        return;
    }

    state.rejectingUnauthorizedUser = true;

    updateSubmitButton();

    try {

        await signOut(auth);

    } catch (error) {

        console.error(
            "[Admin Login] Unauthorized account sign-out failed:",
            error?.code
        );

    } finally {

        state.rejectingUnauthorizedUser = false;

        state.submitting = false;

        state.authenticationResolved = true;

        updateSubmitButton();

        setStatus(
            "Access denied. This account is not authorized as an administrator.",
            "error"
        );

    }

}


/* =====================================================
   08. OBSERVE AUTHENTICATION
===================================================== */

function observeAuthentication() {

    state.authenticationResolved = false;

    updateSubmitButton();

    setStatus(
        "Checking administrator session...",
        "loading"
    );

    onAuthStateChanged(

        auth,

        async user => {

            state.authenticationResolved = true;

            if (user) {

                if (user.uid === CONFIG.adminUID) {

                    redirectToDashboard();

                    return;

                }

                await rejectUnauthorizedUser();

                return;

            }

            /*
             * IMPORTANT LOGIN FIX:
             *
             * A signed-out visitor must be allowed
             * to use the Sign In button.
             *
             * Previously the button remained disabled
             * after the initial authentication check.
             */

            if (!state.submitting && !state.redirecting) {

                clearStatus();

            }

            updateSubmitButton();

        },

        error => {

            console.error(
                "[Admin Login] Authentication observer error:",
                error?.code
            );

            state.authenticationResolved = true;

            state.submitting = false;

            updateSubmitButton();

            setStatus(
                "Unable to verify the current session. Please try signing in.",
                "error"
            );

        }

    );

}


/* =====================================================
   09. FORM VALIDATION
===================================================== */

function validateForm() {

    const email = el.email.value.trim();

    const password = el.password.value;

    if (!email) {

        setStatus(
            "Enter your administrator email address.",
            "error"
        );

        el.email.focus();

        return null;

    }

    if (!el.email.validity.valid) {

        setStatus(
            "Enter a valid email address.",
            "error"
        );

        el.email.focus();

        return null;

    }

    if (!password) {

        setStatus(
            "Enter your administrator password.",
            "error"
        );

        el.password.focus();

        return null;

    }

    return {
        email,
        password
    };

}


/* =====================================================
   10. SIGN IN
===================================================== */

async function handleSignIn(event) {

    event.preventDefault();

    if (

        !state.authenticationResolved ||

        state.submitting ||

        state.redirecting ||

        state.rejectingUnauthorizedUser

    ) {
        return;
    }

    const values = validateForm();

    if (!values) {
        return;
    }

    state.submitting = true;

    updateSubmitButton();

    setStatus(
        "Signing in securely...",
        "loading"
    );

    try {

        const credential = await signInWithEmailAndPassword(

            auth,

            values.email,

            values.password

        );

        /*
         * Checking the UID here improves the UI flow.
         *
         * Actual database authorization MUST also be
         * enforced through Firebase Security Rules.
         */

        if (credential.user.uid !== CONFIG.adminUID) {

            await rejectUnauthorizedUser();

            return;

        }

        redirectToDashboard();

    } catch (error) {

        console.error(
            "[Admin Login] Sign-in failed:",
            error?.code
        );

        if (!state.redirecting) {

            setStatus(
                getAuthenticationError(error),
                "error"
            );

            el.password.focus();

        }

    } finally {

        state.submitting = false;

        updateSubmitButton();

    }

}


/* =====================================================
   11. PASSWORD VISIBILITY
===================================================== */

function togglePasswordVisibility() {

    const currentlyHidden =
        el.password.type === "password";

    el.password.type = currentlyHidden
        ? "text"
        : "password";

    el.passwordToggle.setAttribute(
        "aria-pressed",
        String(currentlyHidden)
    );

    el.passwordToggle.setAttribute(
        "aria-label",
        currentlyHidden
            ? "Hide password"
            : "Show password"
    );

    el.password.focus();

}


/* =====================================================
   12. INITIALIZATION
===================================================== */

function initialize() {

    if (

        state.initialized ||

        document.body.dataset.page !== "admin-login"

    ) {
        return;
    }

    Object.entries(CONFIG.selectors).forEach(
        ([key, selector]) => {

            el[key] = document.querySelector(selector);

        }
    );

    const missing = Object.keys(
        CONFIG.selectors
    ).filter(key => !el[key]);

    if (missing.length) {

        console.error(
            "[Admin Login] Missing HTML elements:",
            missing
        );

        return;

    }

    state.initialized = true;

    setText(
        el.year,
        new Date().getFullYear()
    );

    el.form.addEventListener(
        "submit",
        handleSignIn
    );

    el.passwordToggle.addEventListener(
        "click",
        togglePasswordVisibility
    );

    el.email.addEventListener("input", () => {

        if (!state.submitting) {
            clearStatus();
        }

    });

    el.password.addEventListener("input", () => {

        if (!state.submitting) {
            clearStatus();
        }

    });

    observeAuthentication();

}


/* =====================================================
   13. START APPLICATION
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
   END OF ADMIN-LOGIN.JS
===================================================== */
