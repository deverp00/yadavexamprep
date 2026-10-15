
/*
=========================================================
YADAV EXAMPREP
File: js/firebase-config.js

Firebase Initialization and Shared Services

Designed and Developed by Yadav Web Technologies
=========================================================
*/

"use strict";

/* =====================================================
   01. FIREBASE SDK IMPORTS
===================================================== */

import {
    initializeApp,
    getApps,
    getApp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import {
    getDatabase,
    ref,
    get,
    onValue
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";


/* =====================================================
   02. FIREBASE CONFIGURATION
===================================================== */

const firebaseConfig = {

    apiKey: "AIzaSyBdd3ZVxLNZleQ9OQzEZuIn26D_wkoQC2s",

    authDomain: "yadavexamprep.firebaseapp.com",

    databaseURL: "", // Add your actual Realtime Database URL

    projectId: "yadavexamprep",

    storageBucket: "yadavexamprep.firebasestorage.app",

    messagingSenderId: "1094544845777",

    appId: "1:1094544845777:web:4cff3ca3d33c3e6ae98ef0",

    measurementId: "G-YTPKGVDMKZ"

};


/* =====================================================
   03. INITIALIZE FIREBASE
===================================================== */

const app = getApps().length
    ? getApp()
    : initializeApp(firebaseConfig);


/* =====================================================
   04. INITIALIZE AUTHENTICATION
===================================================== */

const auth = getAuth(app);


/* =====================================================
   05. INITIALIZE REALTIME DATABASE
===================================================== */

const database = firebaseConfig.databaseURL
    ? getDatabase(app)
    : null;


/* =====================================================
   06. DATABASE STATUS
===================================================== */

function isDatabaseConfigured() {

    return Boolean(database);

}


/* =====================================================
   07. SAFE DATABASE REFERENCE
===================================================== */

function databaseReference(path) {

    if (!database) {

        throw new Error(
            "Firebase Realtime Database URL is not configured."
        );

    }

    if (
        typeof path !== "string" ||
        !/^[a-zA-Z0-9_/-]+$/.test(path) ||
        path.includes("//")
    ) {

        throw new Error(
            "Invalid database path."
        );

    }

    return ref(database, path);

}


/* =====================================================
   08. READ DATABASE CONTENT
===================================================== */

async function readData(path) {

    const snapshot = await get(
        databaseReference(path)
    );

    return snapshot.exists()
        ? snapshot.val()
        : null;

}


/* =====================================================
   09. REALTIME CONTENT LISTENER
===================================================== */

function subscribeToData(

    path,
    onData,
    onError = console.error

) {

    if (typeof onData !== "function") {

        throw new TypeError(
            "A valid data callback is required."
        );

    }

    return onValue(

        databaseReference(path),

        (snapshot) => {

            onData(
                snapshot.exists()
                    ? snapshot.val()
                    : null
            );

        },

        onError

    );

}


/* =====================================================
   10. PUBLIC CONTENT SUBSCRIPTIONS
===================================================== */

/*
Expected future database structure:

public/
    exams/
    subjects/
    tests/

Only published public content should be stored
under these publicly readable paths.

Administrative and private information must
remain protected by Firebase Security Rules.
*/

function subscribeToPublicContent(

    onContent,
    onError = console.error

) {

    if (typeof onContent !== "function") {

        throw new TypeError(
            "A valid content callback is required."
        );

    }

    const subscriptions = [];

    const paths = {

        exams: "public/exams",

        subjects: "public/subjects",

        tests: "public/tests"

    };

    Object.entries(paths).forEach(

        ([key, path]) => {

            const unsubscribe = subscribeToData(

                path,

                (data) => {

                    onContent({
                        [key]: data || {}
                    });

                },

                onError

            );

            subscriptions.push(unsubscribe);

        }

    );

    /*
     * Call the returned function to stop
     * all three realtime subscriptions.
     */

    return () => {

        subscriptions.forEach(
            unsubscribe => unsubscribe()
        );

    };

}


/* =====================================================
   11. EXPORT SHARED FIREBASE SERVICES
===================================================== */

export {

    app,

    auth,

    database,

    firebaseConfig,

    isDatabaseConfigured,

    databaseReference,

    readData,

    subscribeToData,

    subscribeToPublicContent

};
