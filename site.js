(function () {
    const nav = document.getElementById('main-nav');
    if (!nav) return;

    // Require this many px of continuous scroll in one direction before reacting
    const DIRECTION_THRESHOLD = 40;
    // Below this scroll position, nav is always transparent and visible
    const TOP_THRESHOLD = 10;

    let lastScrollY = window.scrollY;
    let lastDirection = null;
    let directionAccum = 0;

    function handleScroll() {
        const currentScrollY = window.scrollY;
        const delta = currentScrollY - lastScrollY;

        if (delta === 0) return;

        // At the top — always transparent, always visible
        if (currentScrollY <= TOP_THRESHOLD) {
            nav.classList.remove('nav--scrolled');
            nav.classList.remove('nav--hidden');
            directionAccum = 0;
            lastScrollY = currentScrollY;
            return;
        }

        const direction = delta > 0 ? 'down' : 'up';

        // Reset accumulator when direction changes
        if (direction !== lastDirection) {
            directionAccum = 0;
            lastDirection = direction;
        }

        directionAccum += Math.abs(delta);

        // Only act once the user has committed to the direction
        if (directionAccum >= DIRECTION_THRESHOLD) {
            if (direction === 'down') {
                nav.classList.add('nav--hidden');
            } else {
                nav.classList.remove('nav--hidden');
                nav.classList.add('nav--scrolled');
            }
        }

        lastScrollY = currentScrollY;
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
})();
