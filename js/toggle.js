
/*
=========================================================
YADAV EXAMPREP
File: js/toggle.js

Universal Responsive Navigation Controller

Designed and Developed by Yadav Web Technologies
=========================================================
*/

"use strict";

(() => {

    /* =================================================
       01. CONFIGURATION
    ================================================= */

    const CONFIG = Object.freeze({

        mobileBreakpoint: 900,

        selectors: {
            header: "#siteHeader",
            toggle: "#menuToggle",
            navigation: "#mobileNavigation",
            navigationLinks: ".mobile-nav-link",
            mobileCTA: ".mobile-cta"
        },

        classes: {
            open: "is-open",
            active: "is-active"
        }

    });


    /* =================================================
       02. INITIALIZATION
    ================================================= */

    function initializeNavigation() {

        const header = document.querySelector(
            CONFIG.selectors.header
        );

        const toggle = document.querySelector(
            CONFIG.selectors.toggle
        );

        const navigation = document.querySelector(
            CONFIG.selectors.navigation
        );

        if (!header || !toggle || !navigation) {
            return;
        }

        let isMenuOpen = false;

        const mobileMediaQuery = window.matchMedia(
            `(max-width: ${CONFIG.mobileBreakpoint}px)`
        );


        /* =============================================
           03. ACCESSIBILITY HELPERS
        ============================================= */

        function updateAccessibility(open) {

            toggle.setAttribute(
                "aria-expanded",
                String(open)
            );

            toggle.setAttribute(
                "aria-label",
                open
                    ? "Close navigation menu"
                    : "Open navigation menu"
            );

            /*
             * Prevent keyboard focus inside a closed
             * navigation menu.
             */

            navigation.inert = !open;

        }


        /* =============================================
           04. OPEN NAVIGATION
        ============================================= */

        function openMenu() {

            if (isMenuOpen || !mobileMediaQuery.matches) {
                return;
            }

            isMenuOpen = true;

            navigation.classList.add(
                CONFIG.classes.open
            );

            toggle.classList.add(
                CONFIG.classes.active
            );

            updateAccessibility(true);

        }


        /* =============================================
           05. CLOSE NAVIGATION
        ============================================= */

        function closeMenu(restoreFocus = false) {

            if (!isMenuOpen) {
                return;
            }

            isMenuOpen = false;

            navigation.classList.remove(
                CONFIG.classes.open
            );

            toggle.classList.remove(
                CONFIG.classes.active
            );

            /*
             * Restore focus before making navigation
             * elements inert.
             */

            if (
                restoreFocus &&
                navigation.contains(document.activeElement)
            ) {
                toggle.focus();
            }

            updateAccessibility(false);

        }


        /* =============================================
           06. TOGGLE NAVIGATION
        ============================================= */

        function toggleMenu() {

            if (isMenuOpen) {
                closeMenu();
            } else {
                openMenu();
            }

        }


        /* =============================================
           07. TOGGLE BUTTON EVENT
        ============================================= */

        toggle.addEventListener(
            "click",
            toggleMenu
        );


        /* =============================================
           08. CLOSE AFTER LINK SELECTION
        ============================================= */

        const navigationLinks = navigation.querySelectorAll(
            `${CONFIG.selectors.navigationLinks}, ${CONFIG.selectors.mobileCTA}`
        );

        navigationLinks.forEach((link) => {

            link.addEventListener("click", () => {

                closeMenu();

            });

        });


        /* =============================================
           09. OUTSIDE CLICK DETECTION
        ============================================= */

        document.addEventListener("pointerdown", (event) => {

            if (!isMenuOpen) {
                return;
            }

            /*
             * Ignore interactions inside the header.
             */

            if (header.contains(event.target)) {
                return;
            }

            closeMenu();

        });


        /* =============================================
           10. ESCAPE KEY SUPPORT
        ============================================= */

        document.addEventListener("keydown", (event) => {

            if (event.key !== "Escape") {
                return;
            }

            if (!isMenuOpen) {
                return;
            }

            closeMenu(true);

            toggle.focus();

        });


        /* =============================================
           11. DESKTOP BREAKPOINT RESET
        ============================================= */

        function handleBreakpointChange(event) {

            if (!event.matches) {

                closeMenu(true);

            }

        }

        mobileMediaQuery.addEventListener(
            "change",
            handleBreakpointChange
        );


        /* =============================================
           12. INITIAL STATE
        ============================================= */

        navigation.classList.remove(
            CONFIG.classes.open
        );

        toggle.classList.remove(
            CONFIG.classes.active
        );

        isMenuOpen = false;

        updateAccessibility(false);


        /* =============================================
           13. OPTIONAL PUBLIC CONTROLLER
        ============================================= */

        /*
         * Other project modules can close the mobile
         * navigation without duplicating logic.
         */

        window.YadavNavigation = Object.freeze({

            open: openMenu,

            close: closeMenu,

            toggle: toggleMenu,

            isOpen: () => isMenuOpen

        });

    }


    /* =================================================
       14. SAFE DOM INITIALIZATION
    ================================================= */

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initializeNavigation,
            { once: true }
        );

    } else {

        initializeNavigation();

    }

})();
