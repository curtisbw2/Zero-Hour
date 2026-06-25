(function () {
    const nav = document.getElementById('main-nav');
    if (!nav) return;

    // Let fixed mega-menu know exactly where the nav bottom is
    function setNavHeight() {
        document.documentElement.style.setProperty('--nav-height', nav.offsetHeight + 'px');
    }
    setNavHeight();
    window.addEventListener('resize', setNavHeight, { passive: true });

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

    // Our Focus carousel: velocity-sensitive drag + pagination dots
    (function () {
        var row = document.querySelector('.our-focus-row');
        var dots = document.querySelectorAll('.our-focus-dot');
        if (!row || !dots.length) return;

        var cards = [].slice.call(row.querySelectorAll('.our-focus-card'));

        // Snap targets (scrollLeft values) cached from stable offsetLeft — never
        // recomputed during scroll, so the scroll handler stays cheap.
        var positions = [];
        function computePositions() {
            var base = cards.length ? cards[0].offsetLeft : 0;
            positions = cards.map(function (c) { return c.offsetLeft - base; });
        }
        computePositions();
        window.addEventListener('resize', computePositions, { passive: true });

        function nearestIndex() {
            var idx = 0, best = Infinity;
            for (var i = 0; i < positions.length; i++) {
                var d = Math.abs(positions[i] - row.scrollLeft);
                if (d < best) { best = d; idx = i; }
            }
            return idx;
        }

        // Pagination dots — click to snap to card
        dots.forEach(function (dot, i) {
            dot.addEventListener('click', function () {
                if (positions[i] !== undefined) row.scrollTo({ left: positions[i], behavior: 'smooth' });
            });
        });

        // Sync dot state to scroll position — throttled to one update per frame
        var rafPending = false;
        function syncDots() {
            var idx = nearestIndex();
            dots.forEach(function (d, i) { d.classList.toggle('active', i === idx); });
        }
        row.addEventListener('scroll', function () {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(function () { rafPending = false; syncDots(); });
        }, { passive: true });

        var startX = 0, startScroll = 0, dragging = false, didDrag = false;
        var velocityX = 0, lastMoveX = 0, lastMoveTime = 0;

        row.addEventListener('pointerdown', function (e) {
            if (e.button !== 0) return;
            dragging = true;
            didDrag = false;
            startX = e.clientX;
            startScroll = row.scrollLeft;
            velocityX = 0;
            lastMoveX = e.clientX;
            lastMoveTime = Date.now();
            row.setPointerCapture(e.pointerId);
            row.classList.add('is-dragging');
        });

        row.addEventListener('pointermove', function (e) {
            if (!dragging) return;
            var now = Date.now();
            var dt = now - lastMoveTime;
            if (dt >= 16) {
                velocityX = (e.clientX - lastMoveX) / dt; // px/ms, positive = pointer moving right
                lastMoveX = e.clientX;
                lastMoveTime = now;
            }
            var delta = startX - e.clientX;
            if (Math.abs(delta) > 4) didDrag = true;
            row.scrollLeft = startScroll + delta;
        });

        function endDrag() {
            if (!dragging) return;
            dragging = false;

            var target;
            var FLICK = 0.15; // px/ms — threshold for velocity-based card advance

            if (Math.abs(velocityX) > FLICK) {
                // Current card = last snap point at/left of current scroll
                var curIdx = 0;
                positions.forEach(function (pos, i) { if (pos <= row.scrollLeft + 1) curIdx = i; });
                // velocityX < 0 = pointer moved left = scrolling forward (next card)
                if (velocityX < 0) {
                    target = positions[Math.min(curIdx + 1, positions.length - 1)];
                } else {
                    target = positions[Math.max(curIdx - 1, 0)];
                }
            } else {
                target = positions[nearestIndex()];
            }

            row.scrollTo({ left: target, behavior: 'smooth' });

            function cleanup() { row.classList.remove('is-dragging'); }
            if ('onscrollend' in window) {
                row.addEventListener('scrollend', cleanup, { once: true });
            } else {
                setTimeout(cleanup, 500);
            }
        }

        row.addEventListener('pointerup', endDrag);
        row.addEventListener('pointercancel', endDrag);

        // Swallow click if it followed a drag
        row.addEventListener('click', function (e) {
            if (didDrag) { e.preventDefault(); e.stopPropagation(); didDrag = false; }
        }, true);
    })();

    // Company cards: clicking anywhere on a card navigates to its company page.
    // Clicks on inner links (Interviews, Earnings, etc.) keep their own targets.
    document.querySelectorAll('.company-card[data-href]').forEach(function (card) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', function (e) {
            if (e.target.closest('a')) return;                 // let inner links work
            if (window.getSelection && String(window.getSelection())) return; // don't hijack text selection
            window.location.href = card.getAttribute('data-href');
        });
    });

    // Mega dropdown: show on link hover, hide on link-leave (with grace) or panel-leave
    const megaDropdown = nav.querySelector('.mega-dropdown');
    const megaLink = megaDropdown && megaDropdown.querySelector('.nav-link');
    const megaMenu = megaDropdown && megaDropdown.querySelector('.mega-menu');

    if (megaDropdown && megaLink && megaMenu) {
        let hideTimer = null;

        function openMega() {
            clearTimeout(hideTimer);
            megaDropdown.classList.add('mega-open');
        }

        function closeMega() {
            clearTimeout(hideTimer);
            megaDropdown.classList.remove('mega-open');
        }

        function scheduleClose() {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(closeMega, 150);
        }

        megaLink.addEventListener('mouseenter', openMega);
        megaLink.addEventListener('mouseleave', scheduleClose);
        megaMenu.addEventListener('mouseenter', openMega);
        megaMenu.addEventListener('mouseleave', closeMega);
    }
})();
