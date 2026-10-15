
/*
=====================================================
YADAV EXAMPREP
File: css/animation.css

CSS INTEGRATION — FULL FILE REPLACEMENT

Designed and Developed by Yadav Web Technologies

RESPONSIBILITIES:
- Page entrance and exit transitions
- Scroll reveal effects
- Mobile navigation transitions
- Sticky-header visual effects
- Lightweight interaction animation
- Reduced-motion accessibility

IMPORTANT:
- No global font-size overrides.
- No grid layout definitions.
- No card padding or dimension overrides.
- No universal border-radius overrides.
- Hidden content must remain hidden.
=====================================================
*/

/* ================================================
   01. MOTION TOKENS
================================================ */

:root {
    --motion-fast: 150ms;
    --motion-normal: 250ms;
    --motion-slow: 450ms;

    --motion-easing: cubic-bezier(
        0.22,
        1,
        0.36,
        1
    );

    --motion-distance: 18px;
}

/* ================================================
   02. PAGE TRANSITIONS
================================================ */

/*
    Pages remain visible by default.

    Animation starts only when the JavaScript
    controller applies its transition classes.
*/

body.site-body {
    opacity: 1;
}

body.site-body.page-ready {
    animation:
        page-enter
        350ms
        var(--motion-easing)
        both;
}

body.site-body.page-exit {
    pointer-events: none;

    animation:
        page-leave
        180ms
        ease-in
        both;
}

@keyframes page-enter {

    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }

}

@keyframes page-leave {

    from {
        opacity: 1;
    }

    to {
        opacity: 0;
    }

}

/* ================================================
   03. SCROLL REVEAL SYSTEM
================================================ */

/*
    IMPORTANT:

    .reveal is visible by default.

    JavaScript adds .reveal-enabled only when
    the scroll-reveal controller is ready.

    This prevents invisible content when JS
    fails or IntersectionObserver is unavailable.
*/

.reveal {
    opacity: 1;
    transform: none;
}

/*
    Only unfinished reveal elements are hidden.

    Completed elements use .is-visible.
*/

.reveal-enabled .reveal:not(.is-visible) {
    opacity: 0;

    transform:
        translate3d(
            0,
            var(--motion-distance),
            0
        );
}

.reveal-enabled .reveal {
    transition:
        opacity
        var(--motion-slow)
        var(--motion-easing),

        transform
        var(--motion-slow)
        var(--motion-easing);
}

.reveal-enabled .reveal.is-visible {
    opacity: 1;
    transform: translate3d(0, 0, 0);
}

/* Reveal Variations */

.reveal-enabled .reveal-left:not(.is-visible) {
    transform:
        translate3d(
            calc(var(--motion-distance) * -1),
            0,
            0
        );
}

.reveal-enabled .reveal-right:not(.is-visible) {
    transform:
        translate3d(
            var(--motion-distance),
            0,
            0
        );
}

.reveal-enabled .reveal-scale:not(.is-visible) {
    transform: scale(0.97);
}

.reveal-enabled .reveal-left.is-visible,
.reveal-enabled .reveal-right.is-visible,
.reveal-enabled .reveal-scale.is-visible {
    transform: none;
}

/* Staggered Reveal */

.reveal-enabled .reveal[data-delay="1"] {
    transition-delay: 60ms;
}

.reveal-enabled .reveal[data-delay="2"] {
    transition-delay: 120ms;
}

.reveal-enabled .reveal[data-delay="3"] {
    transition-delay: 180ms;
}

.reveal-enabled .reveal[data-delay="4"] {
    transition-delay: 240ms;
}

.reveal-enabled .reveal[data-delay="5"] {
    transition-delay: 300ms;
}

.reveal-enabled .reveal[data-delay="6"] {
    transition-delay: 360ms;
}

/* ================================================
   04. STICKY HEADER EFFECT
================================================ */

/*
    style.css owns header dimensions,
    positioning and background.

    This file owns transition effects only.
*/

.site-header {
    transition:
        background-color var(--motion-normal) ease,
        border-color var(--motion-normal) ease,
        box-shadow var(--motion-normal) ease;
}

.site-header.is-scrolled {
    background: rgb(255 255 255 / 97%);
    border-bottom-color: var(--border-color);
    box-shadow: var(--shadow-sm);
}

/* ================================================
   05. MOBILE NAVIGATION
================================================ */

/*
    RESPONSIBILITY SPLIT:

    style.css:
        Desktop/mobile breakpoint and menu layout.

    animation.css:
        Closed/open transition states.

    toggle.js:
        aria-expanded, inert, .is-open and focus.

    The menu is closed by default on mobile.
*/

@media (max-width: 900px) {

    .mobile-nav {
        max-height: 0;
        overflow: hidden;

        opacity: 0;
        visibility: hidden;

        pointer-events: none;

        transition:
            max-height
            350ms
            var(--motion-easing),

            opacity
            var(--motion-normal)
            ease,

            visibility
            0s
            linear
            350ms;
    }

    .mobile-nav.is-open {
        max-height: min(
            650px,
            calc(100dvh - var(--header-height))
        );

        overflow-y: auto;
        overscroll-behavior: contain;

        opacity: 1;
        visibility: visible;

        pointer-events: auto;

        transition:
            max-height
            350ms
            var(--motion-easing),

            opacity
            var(--motion-normal)
            ease,

            visibility
            0s
            linear
            0s;
    }

    .mobile-nav-inner {
        transition:
            transform
            var(--motion-normal)
            var(--motion-easing);
    }

    .mobile-nav:not(.is-open) .mobile-nav-inner {
        transform: translateY(-8px);
    }

    .mobile-nav.is-open .mobile-nav-inner {
        transform: translateY(0);
    }

    /*
        The HTML inert attribute provides interaction
        protection while the menu is closed.
    */

    .mobile-nav-link,
    .mobile-cta {
        transition:
            background-color var(--motion-fast) ease,
            color var(--motion-fast) ease;
    }

}

/* ================================================
   06. MOBILE MENU TOGGLE
================================================ */

.menu-toggle {
    transition:
        background-color var(--motion-fast) ease,
        border-color var(--motion-fast) ease,
        color var(--motion-fast) ease;
}

.menu-toggle svg {
    transition:
        transform
        var(--motion-normal)
        var(--motion-easing);
}

.menu-toggle.is-active {
    border-color: var(--primary);
    background: var(--surface);
}

.menu-toggle.is-active svg {
    transform: rotate(90deg);
}

/* ================================================
   07. BUTTON INTERACTION
================================================ */

/*
    components.css owns button appearance.

    Animation rules only affect movement.
*/

@media (hover: hover) and (pointer: fine) {

    .btn:not(:disabled):not([aria-disabled="true"]):active {
        transform: translateY(1px);
    }

    .menu-toggle:not(:disabled):active {
        transform: scale(0.97);
    }

}

/* ================================================
   08. CARD INTERACTION
================================================ */

/*
    Do not animate all generic articles or sections.

    Only recognised card components may move.
*/

@media (hover: hover) and (pointer: fine) {

    :is(
        .ui-card,
        .exam-card,
        .subject-card,
        .mock-card,
        .feature-card,
        .learning-card
    ):hover {
        transform: translateY(-3px);
    }

    :is(
        .ui-card,
        .exam-card,
        .subject-card,
        .mock-card,
        .feature-card,
        .learning-card
    ):active {
        transform: translateY(-1px);
    }

}

/* ================================================
   09. QUESTION AND ANSWER INTERACTION
================================================ */

/*
    Avoid changing option height or font size.

    This prevents the question layout from jumping
    during answer selection.
*/

:is(
    .exam-answer-option,
    .answer-option,
    .question-option
) {
    transition:
        border-color var(--motion-fast) ease,
        background-color var(--motion-fast) ease,
        box-shadow var(--motion-fast) ease;
}

/* ================================================
   10. MODAL ANIMATION
================================================ */

/*
    components.css owns modal positioning and sizing.

    Animations apply only to visible modals.
*/

.modal-overlay:not([hidden]) {
    animation:
        modal-backdrop-enter
        180ms
        ease-out
        both;
}

.modal-overlay:not([hidden]) > :is(
    .modal-dialog,
    .modal-content
) {
    animation:
        modal-content-enter
        230ms
        var(--motion-easing)
        both;
}

@keyframes modal-backdrop-enter {

    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }

}

@keyframes modal-content-enter {

    from {
        opacity: 0;
        transform: translateY(10px) scale(0.985);
    }

    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }

}

/* ================================================
   11. PROGRESS INTERACTION
================================================ */

/*
    Width changes are already owned by
    components.css.

    No duplicate transition is defined here.
*/

/* ================================================
   12. HIDDEN-STATE SAFETY
================================================ */

/*
    Keep all hidden elements excluded from
    layout regardless of animation state.

    style.css already provides the global
    [hidden] rule, so it is not duplicated here.
*/

.reveal[hidden],
.modal-overlay[hidden],
.mobile-nav[hidden] {
    animation: none;
}

/* ================================================
   13. REDUCED MOTION
================================================ */

@media (prefers-reduced-motion: reduce) {

    :root {
        --motion-fast: 0ms;
        --motion-normal: 0ms;
        --motion-slow: 0ms;
        --motion-distance: 0px;
    }

    body.site-body.page-ready,
    body.site-body.page-exit {
        animation: none;
    }

    body.site-body.page-ready {
        opacity: 1;
    }

    /*
        Keep content accessible without requiring
        IntersectionObserver animations.
    */

    .reveal-enabled .reveal,
    .reveal-enabled .reveal:not(.is-visible),
    .reveal-enabled .reveal.is-visible,
    .reveal-enabled .reveal-left:not(.is-visible),
    .reveal-enabled .reveal-right:not(.is-visible),
    .reveal-enabled .reveal-scale:not(.is-visible) {
        opacity: 1;
        transform: none;
        transition: none;
    }

    .site-header,
    .mobile-nav,
    .mobile-nav-inner,
    .mobile-nav-link,
    .mobile-cta,
    .menu-toggle,
    .menu-toggle svg,
    .btn,
    .ui-card,
    .exam-card,
    .subject-card,
    .mock-card,
    .feature-card,
    .learning-card,
    .exam-answer-option,
    .answer-option,
    .question-option {
        transition: none;
    }

    .modal-overlay:not([hidden]),
    .modal-overlay:not([hidden]) > :is(
        .modal-dialog,
        .modal-content
    ) {
        animation: none;
    }

    .modal-overlay:not([hidden]) > :is(
        .modal-dialog,
        .modal-content
    ) {
        opacity: 1;
        transform: none;
    }

}

/* ================================================
   14. PRINT
================================================ */

@media print {

    body.site-body,
    body.site-body.page-ready,
    body.site-body.page-exit {
        opacity: 1;
        animation: none;
    }

    .reveal,
    .reveal-enabled .reveal,
    .reveal-enabled .reveal:not(.is-visible) {
        opacity: 1;
        transform: none;
        transition: none;
    }

    .site-header {
        box-shadow: none;
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
    }

    .mobile-nav,
    .menu-toggle {
        display: none !important;
    }

}

/* ================================================
   END OF FILE
================================================ */
