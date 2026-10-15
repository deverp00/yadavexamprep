
/*
=========================================================
YADAV EXAMPREP
File: js/animations.js

Universal Animation Controller

Designed and Developed by Yadav Web Technologies
=========================================================
*/

"use strict";

(() => {

    /* =================================================
       01. CONFIGURATION
    ================================================= */

    const CONFIG = Object.freeze({

        selectors: {
            header: "#siteHeader",
            reveal: ".reveal",
            transitionLinks: 'a[href]'
        },

        classes: {
            ready: "page-ready",
            exit: "page-exit",
            revealEnabled: "reveal-enabled",
            visible: "is-visible",
            scrolled: "is-scrolled"
        },

        revealThreshold: 0.08,

        revealRootMargin: "0px 0px -35px 0px",

        headerScrollThreshold: 12,

        pageExitDuration: 180

    });


    /* =================================================
       02. STATE
    ================================================= */

    const motionPreference = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    );

    let revealObserver = null;

    let pageIsLeaving = false;

    let headerFramePending = false;


    /* =================================================
       03. MOTION PREFERENCE
    ================================================= */

    function prefersReducedMotion() {

        return motionPreference.matches;

    }


    /* =================================================
       04. PAGE ENTRANCE
    ================================================= */

    function initializePageEntrance() {

        if (prefersReducedMotion()) {
            return;
        }

        /*
         * Restart the entrance animation safely
         * when the browser restores a cached page.
         */

        document.body.classList.remove(
            CONFIG.classes.exit
        );

        document.body.classList.add(
            CONFIG.classes.ready
        );

    }


    /* =================================================
       05. REVEAL OBSERVER
    ================================================= */

    function initializeRevealObserver() {

        if (
            prefersReducedMotion() ||
            !("IntersectionObserver" in window)
        ) {

            revealAll();

            return;

        }

        revealObserver = new IntersectionObserver(

            (entries, observer) => {

                entries.forEach((entry) => {

                    if (!entry.isIntersecting) {
                        return;
                    }

                    entry.target.classList.add(
                        CONFIG.classes.visible
                    );

                    observer.unobserve(
                        entry.target
                    );

                });

            },

            {
                threshold: CONFIG.revealThreshold,
                rootMargin: CONFIG.revealRootMargin
            }

        );

        /*
         * Enable hidden reveal states only after
         * the observer is successfully created.
         */

        document.body.classList.add(
            CONFIG.classes.revealEnabled
        );

        observeRevealElements();

    }


    /* =================================================
       06. REGISTER REVEAL ELEMENTS
    ================================================= */

    function observeRevealElements(root = document) {

        const elements = [];

        /*
         * Include the root itself when it has
         * the reveal class.
         */

        if (
            root.nodeType === Node.ELEMENT_NODE &&
            root.matches(CONFIG.selectors.reveal)
        ) {

            elements.push(root);

        }

        if (typeof root.querySelectorAll === "function") {

            elements.push(
                ...root.querySelectorAll(
                    CONFIG.selectors.reveal
                )
            );

        }

        elements.forEach((element) => {

            if (
                element.classList.contains(
                    CONFIG.classes.visible
                )
            ) {
                return;
            }

            if (
                prefersReducedMotion() ||
                !revealObserver
            ) {

                element.classList.add(
                    CONFIG.classes.visible
                );

                return;

            }

            revealObserver.observe(element);

        });

    }


    /* =================================================
       07. REVEAL ALL
    ================================================= */

    function revealAll() {

        document.body.classList.remove(
            CONFIG.classes.revealEnabled
        );

        document.querySelectorAll(
            CONFIG.selectors.reveal
        ).forEach((element) => {

            element.classList.add(
                CONFIG.classes.visible
            );

        });

    }


    /* =================================================
       08. STICKY HEADER EFFECT
    ================================================= */

    function updateHeaderState() {

        const header = document.querySelector(
            CONFIG.selectors.header
        );

        if (!header) {
            return;
        }

        header.classList.toggle(

            CONFIG.classes.scrolled,

            window.scrollY >
                CONFIG.headerScrollThreshold

        );

    }


    function handleHeaderScroll() {

        if (headerFramePending) {
            return;
        }

        headerFramePending = true;

        window.requestAnimationFrame(() => {

            updateHeaderState();

            headerFramePending = false;

        });

    }


    function initializeHeaderEffect() {

        updateHeaderState();

        window.addEventListener(
            "scroll",
            handleHeaderScroll,
            { passive: true }
        );

    }


    /* =================================================
       09. SAFE INTERNAL LINK DETECTION
    ================================================= */

    function isEligibleNavigationLink(link, event) {

        if (!link || !link.href) {
            return false;
        }

        /*
         * Do not intercept modified clicks,
         * downloads, new tabs, or cancelled events.
         */

        if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey
        ) {
            return false;
        }

        if (
            link.hasAttribute("download") ||
            link.hasAttribute("data-no-transition")
        ) {
            return false;
        }

        if (
            link.target &&
            link.target.toLowerCase() !== "_self"
        ) {
            return false;
        }

        let destination;

        try {

            destination = new URL(
                link.href,
                window.location.href
            );

        } catch {

            return false;

        }

        /*
         * Only transition normal HTTP(S) links
         * belonging to the current website.
         */

        if (
            !["http:", "https:"].includes(
                destination.protocol
            )
        ) {
            return false;
        }

        if (
            destination.origin !==
            window.location.origin
        ) {
            return false;
        }

        /*
         * Let the browser handle same-page anchors.
         */

        const current = new URL(
            window.location.href
        );

        const sameDocument =

            destination.pathname === current.pathname &&

            destination.search === current.search;

        if (sameDocument) {
            return false;
        }

        return true;

    }


    /* =================================================
       10. PAGE EXIT TRANSITION
    ================================================= */

    function navigateWithTransition(url) {

        if (pageIsLeaving) {
            return;
        }

        if (prefersReducedMotion()) {

            window.location.assign(url);

            return;

        }

        pageIsLeaving = true;

        document.body.classList.remove(
            CONFIG.classes.ready
        );

        document.body.classList.add(
            CONFIG.classes.exit
        );

        window.setTimeout(() => {

            window.location.assign(url);

        }, CONFIG.pageExitDuration);

    }


    /* =================================================
       11. LINK EVENT DELEGATION
    ================================================= */

    function initializePageTransitions() {

        document.addEventListener("click", (event) => {

            const target = event.target;

            if (!(target instanceof Element)) {
                return;
            }

            const link = target.closest(
                CONFIG.selectors.transitionLinks
            );

            if (
                !isEligibleNavigationLink(
                    link,
                    event
                )
            ) {
                return;
            }

            event.preventDefault();

            navigateWithTransition(link.href);

        });

    }


    /* =================================================
       12. DYNAMIC CONTENT SUPPORT
    ================================================= */

    /*
     * Firebase-loaded cards can be registered
     * after their HTML has been inserted.
     *
     * Example:
     *
     * window.YadavAnimations.refresh();
     */

    function refreshAnimations(root = document) {

        if (!root) {
            return;
        }

        observeRevealElements(root);

    }


    /* =================================================
       13. ACCESSIBILITY PREFERENCE CHANGES
    ================================================= */

    function handleMotionPreferenceChange(event) {

        if (event.matches) {

            if (revealObserver) {

                revealObserver.disconnect();

                revealObserver = null;

            }

            revealAll();

            document.body.classList.remove(
                CONFIG.classes.ready,
                CONFIG.classes.exit
            );

            return;

        }

        /*
         * Reinitialize the observer when the
         * user enables animations again.
         */

        if (!revealObserver) {

            initializeRevealObserver();

        }

    }


    /* =================================================
       14. BROWSER PAGE RESTORATION
    ================================================= */

    function handlePageRestore() {

        pageIsLeaving = false;

        document.body.classList.remove(
            CONFIG.classes.exit
        );

        if (!prefersReducedMotion()) {

            document.body.classList.add(
                CONFIG.classes.ready
            );

        }

        updateHeaderState();

        refreshAnimations();

    }


    /* =================================================
       15. INITIALIZATION
    ================================================= */

    function initializeAnimations() {

        initializePageEntrance();

        initializeRevealObserver();

        initializeHeaderEffect();

        initializePageTransitions();

        window.addEventListener(
            "pageshow",
            handlePageRestore
        );

        motionPreference.addEventListener(
            "change",
            handleMotionPreferenceChange
        );

    }


    /* =================================================
       16. PUBLIC ANIMATION CONTROLLER
    ================================================= */

    window.YadavAnimations = Object.freeze({

        refresh: refreshAnimations,

        revealAll: revealAll,

        navigate: navigateWithTransition,

        prefersReducedMotion: prefersReducedMotion

    });


    /* =================================================
       17. SAFE DOM INITIALIZATION
    ================================================= */

    if (document.readyState === "loading") {

        document.addEventListener(

            "DOMContentLoaded",

            initializeAnimations,

            { once: true }

        );

    } else {

        initializeAnimations();

    }

})();
