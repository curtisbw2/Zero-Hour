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

    // Mega dropdowns: show on link hover, hide on link-leave (with grace) or panel-leave.
    // Opening one closes the others so two panels never overlap.
    const megaDropdowns = Array.from(nav.querySelectorAll('.mega-dropdown'));

    megaDropdowns.forEach(function (megaDropdown) {
        const megaLink = megaDropdown.querySelector('.nav-link');
        const megaMenu = megaDropdown.querySelector('.mega-menu');
        if (!megaLink || !megaMenu) return;

        let hideTimer = null;

        function openMega() {
            clearTimeout(hideTimer);
            megaDropdowns.forEach(function (d) {
                if (d !== megaDropdown) d.classList.remove('mega-open');
            });
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
    });
})();

// Click-to-play YouTube facade (.yt-lite): thumbnail + play chip until clicked,
// then the (privacy-enhanced) YouTube iframe is injected with autoplay.
(function () {
    document.querySelectorAll('.yt-lite').forEach(function (el) {
        if (el.dataset.ytBound) return;
        el.dataset.ytBound = '1';
        el.addEventListener('click', function () {
            var iframe = document.createElement('iframe');
            iframe.src = 'https://www.youtube-nocookie.com/embed/' + el.dataset.id + '?autoplay=1&rel=0';
            iframe.title = el.dataset.title || 'YouTube video';
            iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
            iframe.setAttribute('allowfullscreen', '');
            el.innerHTML = '';
            el.appendChild(iframe);
        }, { once: true });
    });
})();

// Newsletter signup: ZHG's own form, in three places.
//   1. Footer box on every page (always there, for people who go looking for it).
//   2. Desktop: centered popup card.
//   3. Phones (<=640px): a small bar that slides up from the bottom instead of covering the page
//      (Google can demote mobile pages whose content gets covered by a popup).
// The popup/bar shows once per visitor after 15s or 40% scroll; dismissing hides it for 30 days,
// subscribing (anywhere) hides it for a year. ?nl=1 forces it, ?nl=0 suppresses it.
// Forms post to the zhg-newsletter Worker (zhg-newsletter-worker/), which adds the address to the
// Resend audience and sends the welcome email from newsletter@thezerohourgroup.com.
(function () {
    var KEY = 'zhg_nl_popup_until';
    var API = 'https://zhg-newsletter.zerohourgroup.workers.dev/subscribe';
    var DAY = 864e5;
    var TITLE = 'Get The Zero Hour Group in your inbox';
    var BLURB = 'CEO interviews, earnings breakdowns and defense tech coverage from Benny and JT.';
    var THANKS_TITLE = 'Thanks for subscribing';
    var THANKS_BODY = 'You&#39;ll now receive our latest CEO interviews, earnings coverage and livestreams on small-cap defense and drone stocks, straight to your inbox. Keep an eye out for a welcome email from The Zero Hour Group.';

    function snooze(days) {
        try { localStorage.setItem(KEY, String(Date.now() + days * DAY)); } catch (e) {}
    }
    function snoozed() {
        try { return Number(localStorage.getItem(KEY) || 0) > Date.now(); } catch (e) { return false; }
    }
    function track(name) { if (window.gtag) gtag('event', name); }

    var css = document.createElement('style');
    css.textContent =
        // shared form
        '.zhg-nl-form{display:flex;gap:8px;flex-wrap:wrap}' +
        '.zhg-nl-form input[type=email]{flex:1 1 200px;min-width:0;padding:12px 14px;font:inherit;font-size:1rem;color:#fff;background:#151515;border:1px solid #333;border-radius:4px}' +
        '.zhg-nl-form input[type=email]:focus{outline:none;border-color:var(--accent-orange,#f07020)}' +
        '.zhg-nl-form button{flex:0 0 auto;padding:12px 20px;font:inherit;font-weight:700;color:#fff;background:var(--accent-orange,#f07020);border:0;border-radius:4px;cursor:pointer}' +
        '.zhg-nl-form button:disabled{opacity:.6;cursor:default}' +
        '.zhg-nl-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}' +
        '.zhg-nl-msg{min-height:1.2em;font-size:.85rem;margin:8px 0 0;color:#c0c0c0}' +
        '.zhg-nl-msg.is-err{color:#ff8a65}' +
        '.zhg-nl-kicker{font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;color:var(--accent-orange,#f07020);font-weight:700;margin:0 0 8px}' +
        '.zhg-nl-x{position:absolute;top:8px;right:10px;width:36px;height:36px;border:0;background:none;color:#888;font-size:1.6rem;line-height:1;cursor:pointer}' +
        '.zhg-nl-x:hover,.zhg-nl-x:focus-visible{color:#fff}' +
        // desktop popup
        '.zhg-nl{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.72);opacity:0;transition:opacity .25s}' +
        '.zhg-nl.is-open{opacity:1}' +
        '.zhg-nl-card{position:relative;width:100%;max-width:440px;max-height:calc(100vh - 32px);overflow:auto;background:#0b0b0b;border:1px solid #2a2a2a;border-top:3px solid var(--accent-orange,#f07020);border-radius:6px;padding:28px 24px 16px;color:#fff;font-family:Inter,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.6);transform:translateY(12px);transition:transform .25s}' +
        '.zhg-nl.is-open .zhg-nl-card{transform:none}' +
        '.zhg-nl-card h2{font-size:1.5rem;line-height:1.2;margin:0 0 10px;font-weight:800}' +
        '.zhg-nl-card .zhg-nl-blurb{color:var(--text-muted,#c0c0c0);font-size:.95rem;line-height:1.5;margin:0 0 16px}' +
        '.zhg-nl-foot{display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:.78rem;color:#777}' +
        '.zhg-nl-foot a{color:#999}' +
        '.zhg-nl-later{padding:8px 0;border:0;background:none;color:#777;font:inherit;cursor:pointer}' +
        '.zhg-nl-later:hover,.zhg-nl-foot a:hover{color:#bbb}' +
        // phone bar
        '.zhg-nl-bar{position:fixed;left:0;right:0;bottom:0;z-index:10000;background:#0b0b0b;border-top:3px solid var(--accent-orange,#f07020);box-shadow:0 -10px 30px rgba(0,0,0,.6);padding:14px 16px calc(14px + env(safe-area-inset-bottom));color:#fff;font-family:Inter,sans-serif;transform:translateY(110%);transition:transform .3s}' +
        '.zhg-nl-bar.is-open{transform:none}' +
        '.zhg-nl-bar .zhg-nl-x{top:4px;right:4px}' +
        '.zhg-nl-bar-title{font-weight:800;font-size:1rem;line-height:1.3;margin:0 36px 10px 0}' +
        '.zhg-nl-bar .zhg-nl-form input[type=email]{padding:10px 12px;flex-basis:150px}' +
        '.zhg-nl-bar .zhg-nl-form button{padding:10px 16px}' +
        '.zhg-nl-bar .zhg-nl-msg:empty{display:none}' +
        '.zhg-nl-bar .zhg-nl-thanks-body{color:#c0c0c0;font-size:.85rem;line-height:1.45;margin:0 36px 0 0}' +
        // footer box
        '.zhg-nl-footer{width:100%;max-width:520px;text-align:center;padding-bottom:2rem;border-bottom:1px solid #161616}' +
        '.zhg-nl-footer h3{font-size:1.25rem;line-height:1.25;margin:0 0 8px;font-weight:800;color:#fff}' +
        '.zhg-nl-footer .zhg-nl-blurb{color:var(--text-muted,#c0c0c0);font-size:.9rem;line-height:1.5;margin:0 0 14px}' +
        '.zhg-nl-footer .zhg-nl-form{text-align:left}' +
        '.zhg-nl-footer .zhg-nl-thanks-body{color:var(--text-muted,#c0c0c0);font-size:.9rem;line-height:1.5;margin:0}';
    document.head.appendChild(css);

    function formHtml() {
        return '<form class="zhg-nl-form" novalidate>' +
                '<label class="zhg-nl-hp" aria-hidden="true">Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label>' +
                '<input type="email" name="email" placeholder="you@example.com" autocomplete="email" required aria-label="Email address">' +
                '<button type="submit">Subscribe</button>' +
            '</form>' +
            '<p class="zhg-nl-msg" role="status" aria-live="polite"></p>';
    }

    // Wires a .zhg-nl-form; onSuccess() swaps in that spot's thank-you content.
    function wire(root, source, onSuccess) {
        var form = root.querySelector('.zhg-nl-form');
        var input = form.querySelector('input[type=email]');
        var btn = form.querySelector('button');
        var msg = root.querySelector('.zhg-nl-msg');
        function say(text, err) {
            msg.textContent = text;
            msg.classList.toggle('is-err', !!err);
        }
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var email = input.value.trim();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { say('Enter a valid email address.', true); input.focus(); return; }
            btn.disabled = true;
            say('Sending...');
            fetch(API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, website: form.website.value })
            }).then(function (r) {
                return r.json().catch(function () { return {}; }).then(function (d) {
                    return { ok: r.ok && d.ok, status: r.status, error: d.error };
                });
            }).then(function (res) {
                if (res.ok) {
                    snooze(365);
                    track('newsletter_signup_' + source);
                    onSuccess();
                } else {
                    btn.disabled = false;
                    say(res.status === 429 ? 'Too many tries. Give it a minute and try again.'
                        : res.error === 'invalid_email' ? 'Enter a valid email address.'
                        : 'Something went wrong. Please try again.', true);
                }
            }).catch(function () {
                btn.disabled = false;
                say('Network error. Please try again.', true);
            });
        });
        return input;
    }

    // ---- 1. Footer box ----------------------------------------------------------------------
    var footer = document.querySelector('.hp-footer .footer-inner');
    if (footer) {
        var box = document.createElement('div');
        box.className = 'zhg-nl-footer';
        box.innerHTML =
            '<p class="zhg-nl-kicker">Free newsletter</p>' +
            '<h3>' + TITLE + '</h3>' +
            '<p class="zhg-nl-blurb">' + BLURB + '</p>' +
            formHtml();
        footer.insertBefore(box, footer.firstChild);
        wire(box, 'footer', function () {
            box.innerHTML =
                '<div role="status"><p class="zhg-nl-kicker">You&#39;re subscribed</p>' +
                '<h3>' + THANKS_TITLE + '</h3>' +
                '<p class="zhg-nl-thanks-body">' + THANKS_BODY + '</p></div>';
        });
    }

    // ---- 2/3. Popup (desktop) or bottom bar (phones) ----------------------------------------
    if (/[?&]nl=0\b/.test(location.search)) return;
    var force = /[?&]nl=1\b/.test(location.search);
    if (!force && snoozed()) return;

    var shown = false;
    function show() {
        if (shown) return;
        shown = true;
        window.removeEventListener('scroll', onScroll);
        if (!force && snoozed()) return; // e.g. they just subscribed in the footer
        snooze(30); // count a view as a dismissal even if they just navigate away
        if (window.matchMedia('(max-width: 640px)').matches) showBar(); else showModal();
        track('newsletter_popup_view');
    }

    function onKeyFor(close) {
        return function (e) { if (e.key === 'Escape') close(); };
    }

    function showModal() {
        var wrap = document.createElement('div');
        wrap.className = 'zhg-nl';
        wrap.setAttribute('role', 'dialog');
        wrap.setAttribute('aria-modal', 'true');
        wrap.setAttribute('aria-labelledby', 'zhg-nl-title');
        wrap.innerHTML =
            '<div class="zhg-nl-card">' +
                '<button type="button" class="zhg-nl-x" aria-label="Close">&times;</button>' +
                '<p class="zhg-nl-kicker">Free newsletter</p>' +
                '<h2 id="zhg-nl-title">' + TITLE + '</h2>' +
                '<p class="zhg-nl-blurb">' + BLURB + '</p>' +
                formHtml() +
                '<div class="zhg-nl-foot">' +
                    '<button type="button" class="zhg-nl-later">No thanks</button>' +
                    '<a href="/privacy.html">Privacy</a>' +
                '</div>' +
            '</div>';
        document.body.appendChild(wrap);
        var lastFocus = document.activeElement;
        var onKey = onKeyFor(close);
        function close() {
            wrap.classList.remove('is-open');
            document.removeEventListener('keydown', onKey);
            setTimeout(function () { wrap.remove(); }, 250);
            if (lastFocus && lastFocus.focus) lastFocus.focus();
            track('newsletter_popup_close');
        }
        var card = wrap.querySelector('.zhg-nl-card');
        var input = wire(card, 'popup', function () {
            card.innerHTML = '<button type="button" class="zhg-nl-x" aria-label="Close">&times;</button>' +
                '<div role="status">' +
                    '<p class="zhg-nl-kicker">You&#39;re subscribed</p>' +
                    '<h2>' + THANKS_TITLE + '</h2>' +
                    '<p class="zhg-nl-blurb">' + THANKS_BODY + '</p>' +
                '</div>';
            card.querySelector('.zhg-nl-x').addEventListener('click', close);
            card.querySelector('.zhg-nl-x').focus();
        });
        wrap.querySelector('.zhg-nl-x').addEventListener('click', close);
        wrap.querySelector('.zhg-nl-later').addEventListener('click', close);
        wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
        document.addEventListener('keydown', onKey);
        requestAnimationFrame(function () { wrap.classList.add('is-open'); });
        input.focus();
    }

    function showBar() {
        var bar = document.createElement('div');
        bar.className = 'zhg-nl-bar';
        bar.setAttribute('role', 'dialog');
        bar.setAttribute('aria-label', 'Newsletter signup');
        bar.innerHTML =
            '<button type="button" class="zhg-nl-x" aria-label="Close">&times;</button>' +
            '<p class="zhg-nl-bar-title">' + TITLE + '</p>' +
            formHtml();
        document.body.appendChild(bar);
        var onKey = onKeyFor(close);
        function close() {
            bar.classList.remove('is-open');
            document.removeEventListener('keydown', onKey);
            setTimeout(function () { bar.remove(); }, 300);
            track('newsletter_popup_close');
        }
        // No autofocus here: on a phone that would pop the keyboard over the page uninvited.
        wire(bar, 'bar', function () {
            bar.innerHTML = '<button type="button" class="zhg-nl-x" aria-label="Close">&times;</button>' +
                '<div role="status"><p class="zhg-nl-bar-title">' + THANKS_TITLE + '</p>' +
                '<p class="zhg-nl-thanks-body">' + THANKS_BODY + '</p></div>';
            bar.querySelector('.zhg-nl-x').addEventListener('click', close);
        });
        bar.querySelector('.zhg-nl-x').addEventListener('click', close);
        document.addEventListener('keydown', onKey);
        requestAnimationFrame(function () { bar.classList.add('is-open'); });
    }

    function onScroll() {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        if (h > 0 && window.scrollY / h > 0.4) show();
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    setTimeout(show, force ? 500 : 15000);
})();
