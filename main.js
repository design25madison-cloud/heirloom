    // ── Scroll reveal ─────────────────────────────────────
    const revealEls    = document.querySelectorAll('.reveal');
    const staggerEls   = document.querySelectorAll('.stagger');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealEls.forEach(el  => observer.observe(el));
    staggerEls.forEach(el => observer.observe(el));

    // ── "See what fits you" tabs ──────────────────────────
    // A tab only activates once its panel exists (aria-controls → element).
    const fitTabList   = document.querySelector('.fit__tabs');
    const fitIndicator = document.querySelector('.fit__tabs-indicator');
    const fitTabs      = [...document.querySelectorAll('.fit__tab')];
    const fitPanelOf   = (tab) => document.getElementById(tab.getAttribute('aria-controls'));
    const fitPanels    = fitTabs.map(fitPanelOf).filter(Boolean);
    const fitReduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const fitEase = 'cubic-bezier(0.16, 1, 0.3, 1)';
    let fitCurrent = fitTabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
    let fitSwapId = 0;

    const moveFitIndicator = () => {
      const tab = fitTabs[fitCurrent];
      fitIndicator.style.width = tab.offsetWidth + 'px';
      fitIndicator.style.height = tab.offsetHeight + 'px';
      fitIndicator.style.transform = `translate(${tab.offsetLeft}px, ${tab.offsetTop}px)`;
    };

    const selectFitTab = (tab) => {
      const i = fitTabs.indexOf(tab);
      const panel = fitPanelOf(tab);
      if (!panel || i === fitCurrent) return;

      const dir = i > fitCurrent ? 1 : -1;   // slide toward the direction of travel
      const outgoing = fitPanelOf(fitTabs[fitCurrent]);
      const swapId = ++fitSwapId;
      fitCurrent = i;

      fitTabs.forEach(t => {
        const on = t === tab;
        t.setAttribute('aria-selected', on);
        t.tabIndex = on ? 0 : -1;
      });
      moveFitIndicator();

      const showIncoming = () => {
        if (swapId !== fitSwapId) return;    // a newer click took over
        fitPanels.forEach(p => {
          p.getAnimations().forEach(a => a.cancel());
          p.hidden = p !== panel;
        });
        if (fitReduceMotion.matches) return;
        panel.animate(
          [{ opacity: 0, transform: `translateX(${dir * 48}px)` }, { opacity: 1, transform: 'none' }],
          { duration: 450, easing: fitEase }
        );
      };

      if (fitReduceMotion.matches || outgoing.hidden) return showIncoming();
      outgoing.getAnimations().forEach(a => a.cancel());
      outgoing.animate(
        [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-dir * 48}px)` }],
        { duration: 180, easing: 'ease-in', fill: 'forwards' }
      ).onfinish = showIncoming;
    };

    fitTabList.classList.add('has-indicator');
    moveFitIndicator();
    requestAnimationFrame(() => fitTabList.classList.add('is-ready'));
    document.fonts.ready.then(moveFitIndicator);
    window.addEventListener('resize', moveFitIndicator, { passive: true });

    fitTabs.forEach((tab, i) => {
      tab.addEventListener('click', () => selectFitTab(tab));
      tab.addEventListener('keydown', (e) => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (!step) return;
        const next = fitTabs[(i + step + fitTabs.length) % fitTabs.length];
        next.focus();
        selectFitTab(next);
      });
    });

    // ── Waitlist form ─────────────────────────────────────
    const waitlist        = document.querySelector('.waitlist__card');
    const waitlistAlt     = document.querySelector('.waitlist__alt');
    const waitlistCta     = waitlist.querySelector('[data-role-cta]');
    const waitlistSuccess = waitlist.querySelector('.waitlist__success');
    const waitlistError   = waitlist.querySelector('.waitlist__error');
    const WAITLIST_CTA = {
      family:    'Join the family waitlist',
      nurse:     'Apply to join the waitlist',
      caregiver: 'Join the caregiver waitlist',
    };

    const applyWaitlistRole = () => {
      const role = waitlist.elements.role.value;
      waitlistCta.textContent = WAITLIST_CTA[role];
      // Show only this audience's fields; disabling the rest keeps their
      // `required` from blocking submit and leaves them out of the payload.
      waitlist.querySelectorAll('[data-roles]').forEach(field => {
        const on = field.dataset.roles.split(' ').includes(role);
        field.hidden = !on;
        field.querySelectorAll('input, select, textarea').forEach(el => { el.disabled = !on; });
      });
      if (waitlistAlt) waitlistAlt.hidden = role === 'nurse';
    };
    waitlist.addEventListener('change', (e) => {
      if (e.target.name === 'role') applyWaitlistRole();
    });
    // Footer links with data-fit-tab scroll to the fit section and activate the right tab
    document.querySelectorAll('[data-fit-tab]').forEach(link => {
      link.addEventListener('click', () => {
        const tab = document.getElementById(`fit-tab-${link.dataset.fitTab}`);
        if (tab) tab.click();
      });
    });

    // Any link with data-pick-role (panel CTAs, "Are you a nurse?") jumps to the form with that role chosen
    document.querySelectorAll('[data-pick-role]').forEach(link => {
      link.addEventListener('click', () => {
        waitlist.querySelector(`input[value="${link.dataset.pickRole}"]`).checked = true;
        applyWaitlistRole();
      });
    });
    applyWaitlistRole();

    const WAITLIST_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwHY3bHcAmgee2vbWPCwCEm9xpfaQ627PSbOvs86Axy_X_WeeJ2m40Hf1riB3osLc1o/exec';

    waitlist.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!waitlist.reportValidity()) return;
      const submitBtn = waitlist.querySelector('[type="submit"]');
      submitBtn.disabled = true;
      waitlistError.hidden = true;
      try {
        const response = await fetch(WAITLIST_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(Object.fromEntries(new FormData(waitlist))),
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error('save failed');
      } catch (err) {
        submitBtn.disabled = false;
        waitlistError.hidden = false;
        return;
      }
      waitlist.classList.add('is-sent');
      waitlistSuccess.hidden = false;
      if (waitlistAlt) waitlistAlt.hidden = true;
    });

    // ── Mobile nav overlay ────────────────────────────────
    const burger = document.querySelector('.nav__burger');
    const overlay = document.querySelector('.nav-overlay');
    burger.addEventListener('click', () => {
      const isOpen = overlay.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });
    overlay.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        overlay.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
    document.querySelector('.nav-overlay__close').addEventListener('click', () => {
      overlay.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });

    // ── Testimonials carousel ─────────────────────────────
    const testimonialsTrack = document.querySelector('.testimonials__track');
    const testimonialsDots  = document.querySelectorAll('.testimonials__dot');
    const testimonialsPrev  = document.querySelector('.testimonials__prev');
    const testimonialsNext  = document.querySelector('.testimonials__next');
    if (testimonialsTrack && testimonialsDots.length) {
      const SLIDE_COUNT   = testimonialsDots.length;
      const AUTO_INTERVAL = 7000;
      const SLIDE_GAP     = 32;
      let currentSlide = 0;
      let autoTimer;

      function goToSlide(index) {
        currentSlide = index;
        const slideWidth = testimonialsTrack.parentElement.offsetWidth;
        testimonialsTrack.style.transform = `translateX(-${index * (slideWidth + SLIDE_GAP)}px)`;
        testimonialsDots.forEach((d, i) =>
          d.classList.toggle('testimonials__dot--active', i === index)
        );
      }

      function nextSlide() {
        goToSlide((currentSlide + 1) % SLIDE_COUNT);
      }

      function startAuto() {
        autoTimer = setInterval(nextSlide, AUTO_INTERVAL);
      }

      function resetAuto() {
        clearInterval(autoTimer);
        startAuto();
      }

      testimonialsDots.forEach((dot, i) => {
        dot.addEventListener('click', () => { goToSlide(i); resetAuto(); });
      });

      if (testimonialsPrev) {
        testimonialsPrev.addEventListener('click', () => {
          goToSlide((currentSlide - 1 + SLIDE_COUNT) % SLIDE_COUNT);
          resetAuto();
        });
      }
      if (testimonialsNext) {
        testimonialsNext.addEventListener('click', () => {
          goToSlide((currentSlide + 1) % SLIDE_COUNT);
          resetAuto();
        });
      }

      window.addEventListener('resize', () => goToSlide(currentSlide), { passive: true });

      startAuto();
    }

    // ── Nav scroll state ──────────────────────────────────
    const nav = document.querySelector('nav');
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });
