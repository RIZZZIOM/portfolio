(function () {
  "use strict";

  // history.scrollRestoration is disabled as early as possible via an inline
  // script in <head> (this runs too late in the page load to reliably win
  // that race). This is just a safety-net in case anything else scrolled
  // before this script ran.
  window.scrollTo(0, 0);

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var pointerFine = window.matchMedia("(pointer: fine)").matches;

  /* ---------- Mobile nav toggle ---------- */

  var navToggle = document.getElementById("navToggle");
  var navLinks = document.getElementById("navLinks");

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      var isOpen = navLinks.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Brand logo: always return to the true top ----------
     Hero is GSAP-pinned (scrub) for a short scroll distance. Letting the
     browser's native "#hero" hash-jump smooth-scroll through that pinned,
     scrub-linked range fights with ScrollTrigger recalculating the pin on
     every scroll tick, so it settles somewhere past the top instead of at
     it. Scrolling to an absolute pixel offset avoids that fight entirely. */
  var heroLink = document.querySelector('a[href="#hero"]');
  if (heroLink) {
    heroLink.addEventListener("click", function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
      if (history.pushState) history.pushState(null, "", "#hero");
    });
  }

  /* ---------- Scroll-spy active section highlighting ---------- */

  var sections = document.querySelectorAll("main section[id], footer[id]");
  var navItems = document.querySelectorAll("[data-nav]");

  if (sections.length && navItems.length && "IntersectionObserver" in window) {
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var id = entry.target.getAttribute("id");
            navItems.forEach(function (link) {
              link.classList.toggle("active", link.getAttribute("href") === "#" + id);
            });
          }
        });
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );

    sections.forEach(function (section) {
      spy.observe(section);
    });
  }

  /* ---------- Horizontal carousel (certifications) ----------
     Native drag/swipe/trackpad scrolling always works via overflow-x.
     This adds plain mouse-wheel support: hovering the carousel and using
     the wheel moves it horizontally, but only while there's more to see —
     at either edge, control is handed back to normal page scrolling so
     the carousel never traps the user. Never auto-scrolls on its own. */
  function enableWheelScroll(el) {
    if (!el) return;
    el.addEventListener("wheel", function (e) {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

      var atLeftEdge = el.scrollLeft <= 0;
      var atRightEdge = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      var scrollingForward = e.deltaY > 0;

      if ((scrollingForward && atRightEdge) || (!scrollingForward && atLeftEdge)) {
        return;
      }

      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }, { passive: false });
  }

  var projectCarousel = document.getElementById("projectCarousel");

  enableWheelScroll(projectCarousel);

  /* ---------- Dot pagination ----------
     Generates one dot per direct child, clicking scrolls that item to
     center, and the dot matching whichever item is closest to center
     stays highlighted while the user drags/scrolls/wheels through. */
  function setupDots(carousel, dotsWrap) {
    if (!carousel || !dotsWrap) return;
    var items = Array.prototype.slice.call(carousel.children);
    if (!items.length) return;

    items.forEach(function (item, i) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", "Go to item " + (i + 1));
      if (i === 0) dot.classList.add("active");
      dot.addEventListener("click", function () {
        var target = item.offsetLeft - (carousel.clientWidth - item.clientWidth) / 2;
        carousel.scrollTo({ left: target, behavior: "smooth" });
      });
      dotsWrap.appendChild(dot);
    });

    var dots = Array.prototype.slice.call(dotsWrap.children);

    function updateActive() {
      var center = carousel.scrollLeft + carousel.clientWidth / 2;
      var closest = 0;
      var minDist = Infinity;
      items.forEach(function (item, i) {
        var itemCenter = item.offsetLeft + item.clientWidth / 2;
        var dist = Math.abs(itemCenter - center);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      });
      dots.forEach(function (dot, i) {
        dot.classList.toggle("active", i === closest);
      });
    }

    var ticking = false;
    carousel.addEventListener("scroll", function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(function () {
          updateActive();
          ticking = false;
        });
      }
    });

    window.addEventListener("resize", updateActive);
  }

  setupDots(projectCarousel, document.getElementById("projectDots"));

  /* ---------- Tunnel carousel effect (projects) ----------
     Directly measures each card's on-screen distance from the carousel's
     center on every scroll frame and maps that to scale/opacity/blur/tilt.
     Driving this from real geometry (rather than a scroll-trigger position
     guess) guarantees the centered card is always fully in focus, and only
     the neighbors it's passing recede into the "tunnel". */
  function setupTunnelCarousel(carousel) {
    if (!carousel || prefersReducedMotion) return;
    var cards = Array.prototype.slice.call(carousel.querySelectorAll(".cert-card"));
    if (!cards.length) return;

    function update() {
      var containerRect = carousel.getBoundingClientRect();
      var centerX = containerRect.left + containerRect.width / 2;

      cards.forEach(function (card) {
        var rect = card.getBoundingClientRect();
        var cardCenter = rect.left + rect.width / 2;
        var dist = Math.abs(cardCenter - centerX);
        var maxDist = containerRect.width / 2 + rect.width / 2;
        var t = Math.min(dist / maxDist, 1);

        var scale = 1 - t * 0.45;
        var opacity = 1 - t * 0.85;
        var blur = t * 8;
        var lift = -t * 40;
        var rotateY = (cardCenter < centerX ? -1 : 1) * t * 24;

        card.style.transform = "translateY(" + lift + "px) scale(" + scale + ") rotateY(" + rotateY + "deg)";
        card.style.opacity = String(opacity);
        card.style.filter = "blur(" + blur + "px)";
      });
    }

    var ticking = false;
    function requestUpdate() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(function () {
          update();
          ticking = false;
        });
      }
    }

    carousel.addEventListener("scroll", requestUpdate);
    window.addEventListener("resize", requestUpdate);
    update();
  }

  setupTunnelCarousel(projectCarousel);

  /* ---------- Boot sequence ---------- */

  // A "||" marker in a line's text means: type everything before it, hold
  // for a beat (as if the "user" is entering something), then type the
  // rest — used for the password prompt so the mask doesn't just appear
  // glued to the prompt text.
  var PAUSE_MARKER = "||";
  var MID_LINE_PAUSE = 550;

  function typeSegment(el, prefix, text, speed, done) {
    var i = 0;
    (function step() {
      el.textContent = prefix + text.slice(0, i);
      i++;
      if (i <= text.length) {
        setTimeout(step, speed);
      } else if (done) {
        done();
      }
    })();
  }

  function typeLine(el, text, speed, done) {
    var markerIndex = text.indexOf(PAUSE_MARKER);

    if (markerIndex === -1) {
      typeSegment(el, "", text, speed, done);
      return;
    }

    var before = text.slice(0, markerIndex);
    var after = text.slice(markerIndex + PAUSE_MARKER.length);

    typeSegment(el, "", before, speed, function () {
      setTimeout(function () {
        typeSegment(el, before, after, speed, done);
      }, MID_LINE_PAUSE);
    });
  }

  function runBoot(onComplete) {
    var boot = document.getElementById("boot");
    if (!boot) {
      onComplete();
      return;
    }

    if (prefersReducedMotion) {
      boot.remove();
      onComplete();
      return;
    }

    var lines = boot.querySelectorAll(".boot-line");
    var speed = 26;
    var pause = 260;
    var i = 0;

    function next() {
      if (i >= lines.length) {
        setTimeout(function () {
          boot.classList.add("boot-hide");
          setTimeout(function () {
            boot.remove();
            onComplete();
          }, 650);
        }, pause);
        return;
      }
      var line = lines[i];
      var text = line.getAttribute("data-text") || "";
      i++;
      typeLine(line, text, speed, function () {
        setTimeout(next, pause);
      });
    }

    next();

    // Hard failsafe: never let the boot screen block the site.
    setTimeout(function () {
      if (document.body.contains(boot)) {
        boot.remove();
        onComplete();
      }
    }, 6000);
  }

  var bootDone = false;
  function completeBootOnce() {
    if (bootDone) return;
    bootDone = true;
    initCinematics();
  }

  runBoot(completeBootOnce);

  /* ---------- Cursor-reactive glow (hero + contact) ---------- */

  function setupCursorGlow(sectionEl, glowEl) {
    if (!glowEl) return;
    if (!sectionEl || !pointerFine || prefersReducedMotion) {
      glowEl.style.display = "none";
      return;
    }
    sectionEl.addEventListener("mousemove", function (e) {
      var rect = sectionEl.getBoundingClientRect();
      var x = ((e.clientX - rect.left) / rect.width) * 100;
      var y = ((e.clientY - rect.top) / rect.height) * 100;
      glowEl.style.setProperty("--mx", x + "%");
      glowEl.style.setProperty("--my", y + "%");
    });
  }

  setupCursorGlow(document.getElementById("hero"), document.getElementById("heroGlow"));
  setupCursorGlow(document.getElementById("connect"), document.getElementById("footerGlow"));

  /* ---------- Experience duration (computed live, never goes stale) ----------
     Diffs data-start against the visitor's current date on every page load,
     so this stays accurate indefinitely without ever needing a redeploy. */

  document.querySelectorAll(".exp-dates[data-start]").forEach(function (el) {
    var start = new Date(el.getAttribute("data-start") + "T00:00:00");
    var now = new Date();

    var months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    if (now.getDate() < start.getDate()) months--;
    months = Math.max(months, 0);

    var years = Math.floor(months / 12);
    var remMonths = months % 12;
    var duration = years > 0 ? years + " yr " + remMonths + " mo" : remMonths + " mo";

    var tag = document.createElement("span");
    tag.className = "exp-duration";
    tag.textContent = " · " + duration;
    el.appendChild(tag);
  });

  /* ---------- Footer year ---------- */

  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  /* ---------- GSAP-driven cinematics ---------- */

  function initCinematics() {
    var hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";

    if (!hasGsap || prefersReducedMotion) {
      // Still run the hero typewriter without GSAP.
      runTypewriter();
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    runTypewriter();

    /* Hero: pin briefly, scale + fade content out, parallax the grid */
    gsap.timeline({
      scrollTrigger: {
        trigger: "#hero",
        start: "top top",
        end: "+=90%",
        scrub: 0.6,
        pin: true,
        pinSpacing: true
      }
    })
      .to(".hero-inner", { scale: 0.85, opacity: 0, y: -50, ease: "none" }, 0)
      .to(".hero-bg", { yPercent: 12, ease: "none" }, 0);

    /* Reveal helpers — toggleActions replays the animation every time the
       element scrolls back into view, in either direction. */
    function revealEach(selector, vars) {
      gsap.utils.toArray(selector).forEach(function (el) {
        gsap.from(el, Object.assign({
          opacity: 0,
          y: 30,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play reverse play reverse" }
        }, vars || {}));
      });
    }

    function revealGroup(selector, vars) {
      var els = gsap.utils.toArray(selector);
      if (!els.length) return;
      gsap.from(els, Object.assign({
        opacity: 0,
        y: 36,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: { trigger: els[0], start: "top 85%", toggleActions: "play reverse play reverse" }
      }, vars || {}));
    }

    function revealGroupWithin(root, selector, vars) {
      var els = gsap.utils.toArray(root.querySelectorAll(selector));
      if (!els.length) return;
      gsap.from(els, Object.assign({
        opacity: 0,
        y: 24,
        duration: 0.6,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: { trigger: els[0], start: "top 90%", toggleActions: "play reverse play reverse" }
      }, vars || {}));
    }

    revealEach(".section-title");
    revealEach(".section-body");
    revealEach(".exp-card");
    revealEach(".cert-stage");
    revealGroup(".cert-card-static", { scale: 0.92, y: 20, stagger: 0.1 });
    revealGroup(".contact-btn", { y: 20 });
    revealEach(".footer-lead");

    document.querySelectorAll(".stat-row").forEach(function (row) {
      revealGroupWithin(row, ".stat");
    });

    /* Experience: bullets slide in from the left, rail draws down the side */
    revealGroup(".exp-list li", { x: -24, y: 0, stagger: 0.1 });

    gsap.utils.toArray(".exp-rail").forEach(function (rail) {
      gsap.to(rail, {
        scaleY: 1,
        ease: "none",
        scrollTrigger: {
          trigger: rail.closest(".exp-card"),
          start: "top 80%",
          end: "bottom 65%",
          scrub: 0.5
        }
      });
    });

    /* Research timeline: rail draws continuously, dots pop per item, and a
       background clock's hands sweep with scroll direction */
    revealGroup(".timeline-item", { y: 24, stagger: 0.08 });

    var dots = gsap.utils.toArray(".timeline-dot");
    if (dots.length) {
      gsap.from(dots, {
        scale: 0.3,
        opacity: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: "back.out(2)",
        scrollTrigger: { trigger: dots[0], start: "top 85%", toggleActions: "play reverse play reverse" }
      });
    }

    var timelineFill = document.getElementById("timelineFill");
    if (timelineFill) {
      gsap.to(timelineFill, {
        scaleY: 1,
        ease: "none",
        scrollTrigger: {
          trigger: ".timeline-wrap",
          start: "top 75%",
          end: "bottom 75%",
          scrub: 0.5
        }
      });
    }

    // Newest entries are at the top now, so scrolling down moves backward
    // through time — the background clock's hands sweep backward to match.
    var clockScrollConfig = {
      trigger: ".timeline-wrap",
      start: "top 75%",
      end: "bottom 75%",
      scrub: 0.5
    };
    if (document.getElementById("clockMinuteBg")) {
      gsap.to("#clockMinuteBg", { rotation: -360, ease: "none", scrollTrigger: clockScrollConfig });
    }
    if (document.getElementById("clockHourBg")) {
      gsap.to("#clockHourBg", { rotation: -90, ease: "none", scrollTrigger: clockScrollConfig });
    }

    /* Skills: list rows slide in, orbit graphic pops in as one piece */
    revealGroup(".skills-list li", { x: -20, y: 0, stagger: 0.06 });
    revealEach(".skills-orbit", { scale: 0.85, y: 0 });
  }

  function runTypewriter() {
    var typewriterEl = document.getElementById("typewriter");
    var phrase = "red and purple teamer // vulnerability researcher";
    if (!typewriterEl || typewriterEl.dataset.typed) return;
    typewriterEl.dataset.typed = "true";

    if (prefersReducedMotion) {
      typewriterEl.textContent = phrase;
      return;
    }

    var cursor = document.createElement("span");
    cursor.className = "cursor";
    cursor.textContent = " ";

    var i = 0;
    (function step() {
      if (i <= phrase.length) {
        typewriterEl.textContent = phrase.slice(0, i);
        typewriterEl.appendChild(cursor);
        i++;
        setTimeout(step, 28);
      }
    })();
  }

})();
