function setupHeadingLetterHover() {
  function createLetter(character) {
    const letter = document.createElement('span');
    letter.className = 'heading-letter';
    letter.setAttribute('aria-hidden', 'true');

    const displayCharacter = character === ' ' ? '\u00A0' : character;
    const base = document.createElement('span');
    base.className = 'heading-letter-base';
    base.textContent = displayCharacter;

    const hover = document.createElement('span');
    hover.className = 'heading-letter-hover';
    hover.textContent = displayCharacter;

    letter.addEventListener('mouseenter', () => {
      letter.classList.add('is-changed');
    });

    letter.append(base, hover);
    return letter;
  }

  function buildHeadingContent(sourceNode, targetNode) {
    sourceNode.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        Array.from(node.textContent || '').forEach(character => {
          targetNode.appendChild(createLetter(character));
        });
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      if (node.nodeName === 'BR') {
        targetNode.appendChild(document.createElement('br'));
        return;
      }

      const clone = node.cloneNode(false);
      buildHeadingContent(node, clone);
      targetNode.appendChild(clone);
    });
  }

  document.querySelectorAll('h1, h2').forEach(heading => {
    if (heading.dataset.lettersReady === 'true') return;

    const headingText = heading.textContent.replace(/\s+/g, ' ').trim();
    if (!headingText) return;

    heading.dataset.lettersReady = 'true';
    heading.setAttribute('aria-label', headingText);

    const source = heading.cloneNode(true);
    const fragment = document.createDocumentFragment();
    buildHeadingContent(source, fragment);

    heading.textContent = '';
    heading.appendChild(fragment);
  });
}

setupHeadingLetterHover();

function setupSectionZeroLetterLoop() {
  const sectionZero = document.getElementById('section0');
  if (!sectionZero) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const letters = [...sectionZero.querySelectorAll('.heading-letter')].filter(letter => {
    const value = (letter.textContent || '').replace(/\u00A0/g, '').trim();
    return value.length > 0;
  });

  if (letters.length === 0) return;

  let loopTimer = null;
  let isRunning = false;
  let previousIndex = -1;

  function setSectionZeroActive(isActive) {
    document.body.classList.toggle('section-zero-active', isActive);
  }

  function step() {
    if (!isRunning) return;

    let nextIndex = Math.floor(Math.random() * letters.length);

    if (letters.length > 1) {
      while (nextIndex === previousIndex) {
        nextIndex = Math.floor(Math.random() * letters.length);
      }
    }

    previousIndex = nextIndex;

    const letter = letters[nextIndex];
    letter.classList.toggle('is-changed');

    loopTimer = window.setTimeout(step, 420 + Math.random() * 260);
  }

  function startLoop() {
    if (prefersReducedMotion) return;
    if (isRunning) return;

    isRunning = true;
    loopTimer = window.setTimeout(step, 520);
  }

  function stopLoop() {
    isRunning = false;

    if (loopTimer !== null) {
      window.clearTimeout(loopTimer);
      loopTimer = null;
    }
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const isSectionZeroActive = entry.isIntersecting && entry.intersectionRatio >= 0.55;
      setSectionZeroActive(isSectionZeroActive);

      if (isSectionZeroActive) {
        startLoop();
      } else {
        stopLoop();
      }
    });
  }, { threshold: [0, 0.55] });

  observer.observe(sectionZero);
}

setupSectionZeroLetterLoop();

// sync active state between side-nav and nb-nav
const nbNavLinks = document.querySelectorAll('nav.nb-nav a');
const menuLinks = document.querySelectorAll('nav.side-nav a');
const figureRefs = [...document.querySelectorAll('.figure-ref[href^="#fig"]')];
let figureSyncFrame = null;
const currentSectionThresholdRatio = 0.5;
const figureActivationThresholdRatio = 0.5;

function smoothScrollToHref(href) {
  const target = document.querySelector(href);
  if (!target) return;

  window.scrollTo({
    top: target.getBoundingClientRect().top + window.scrollY,
    behavior: 'smooth',
  });
}

function setActiveByHref(href) {
  nbNavLinks.forEach(l => l.classList.remove('active'));
  menuLinks.forEach(l => l.classList.remove('active'));
  document.querySelectorAll(`nav.nb-nav a[href="${href}"], nav.side-nav a[href="${href}"]`).forEach(match => {
    match.classList.add('active');
  });
}

function getOpenFigureSectionId() {
  const openFigure = document.querySelector('.image-right.is-open');
  return openFigure?.closest('section')?.id ?? null;
}

function getOpenFootnoteSectionId() {
  const activeFootnoteRef = document.querySelector('.footnote-ref.is-active');
  return activeFootnoteRef?.closest('section')?.id ?? null;
}

function getCurrentSection() {
  const threshold = window.innerHeight * currentSectionThresholdRatio;
  let currentSection = null;

  sections.forEach(section => {
    if (section.getBoundingClientRect().top <= threshold) {
      currentSection = section;
    }
  });

  return currentSection;
}

function openFigureFromLink(link, { includeFootnotes = true } = {}) {
  const href = link.getAttribute('href');
  if (!href || !href.startsWith('#fig')) return false;

  const figure = document.querySelector(href);
  if (!figure) return false;

  const caption = figure.nextElementSibling;
  const figureAlreadyOpen = figure.classList.contains('is-open');
  const captionAlreadyOpen = !caption || caption.classList.contains('is-open');

  if (figureAlreadyOpen && captionAlreadyOpen) {
    return true;
  }

  closeOpenFigures({ includeFootnotes });
  figure.classList.add('is-open');

  if (caption && caption.classList.contains('figure-caption')) {
    caption.classList.add('is-open');
  }

  return true;
}

function syncFiguresToScroll() {
  const activeFootnoteRef = document.querySelector('.footnote-ref.is-active');
  if (activeFootnoteRef) {
    return;
  }

  const currentSection = getCurrentSection();
  if (!currentSection) {
    return;
  }

  const sectionFigureRefs = figureRefs.filter(link => link.closest('section') === currentSection);
  if (sectionFigureRefs.length === 0) {
    return;
  }

  const threshold = window.innerHeight * figureActivationThresholdRatio;
  let activeFigureRef = null;

  sectionFigureRefs.forEach(link => {
    if (link.getBoundingClientRect().top <= threshold) {
      activeFigureRef = link;
    }
  });

  if (!activeFigureRef) {
    return;
  }

  openFigureFromLink(activeFigureRef, { includeFootnotes: false });
}

function requestFigureSync() {
  if (figureSyncFrame !== null) return;

  figureSyncFrame = window.requestAnimationFrame(() => {
    figureSyncFrame = null;
    syncFiguresToScroll();
  });
}

function closeOpenItemsIfSectionChanges(sectionId) {
  const openFigureSectionId = getOpenFigureSectionId();
  const openFootnoteSectionId = getOpenFootnoteSectionId();
  const shouldCloseFigures = openFigureSectionId && openFigureSectionId !== sectionId;
  const shouldCloseFootnotes = openFootnoteSectionId && openFootnoteSectionId !== sectionId;

  if (shouldCloseFootnotes) {
    closeOpenFigures();
    return;
  }

  if (shouldCloseFigures) {
    closeOpenFigures({ includeFootnotes: false });
  }
}

function handleNavClick(e) {
  const href = e.currentTarget.getAttribute('href');
  if (!href || !href.startsWith('#')) return;

  const target = document.querySelector(href);
  if (!target) return;

  e.preventDefault();
  closeOpenItemsIfSectionChanges(target.id);
  setActiveByHref(href);
  smoothScrollToHref(href);
}

nbNavLinks.forEach(link => {
  link.addEventListener('click', handleNavClick);
});

menuLinks.forEach(link => {
  link.addEventListener('click', handleNavClick);

  link.addEventListener('mouseenter', () => {
    const href = link.getAttribute('href');
    nbNavLinks.forEach(l => l.classList.remove('nb-hover'));
    const match = document.querySelector(`nav.nb-nav a[href="${href}"]`);
    if (match) match.classList.add('nb-hover');
  });

  link.addEventListener('mouseleave', () => {
    nbNavLinks.forEach(l => l.classList.remove('nb-hover'));
  });
});

// scroll-based activation for nb-nav
const sectionIds = [...nbNavLinks].map(l => l.getAttribute('href').replace('#', ''));
const sections = sectionIds.map(id => document.getElementById(id)).filter(Boolean);

if (sections.length > 0) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        closeOpenItemsIfSectionChanges(entry.target.id);
        setActiveByHref('#' + entry.target.id);
        requestFigureSync();
      }
    });
  }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });

  sections.forEach(section => observer.observe(section));
}

// Nav toggle button
const clipBtn = document.getElementById('clipBtn');
if (clipBtn) {
  clipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = document.body.classList.toggle('nav-open');
    clipBtn.classList.toggle('active', isOpen);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('nav.side-nav') && !e.target.closest('.clip')) {
      document.body.classList.remove('nav-open');
      clipBtn.classList.remove('active');
    }
  });
}

function closeOpenFigures({ includeFootnotes = true } = {}) {
  document.querySelectorAll('.image-right.is-open').forEach(figure => {
    figure.classList.remove('is-open');
  });

  document.querySelectorAll('.figure-caption.is-open').forEach(caption => {
    caption.classList.remove('is-open');
  });

  if (includeFootnotes) {
    document.querySelectorAll('.footnote-popup.is-open').forEach(note => {
      note.classList.remove('is-open');
    });

    document.querySelectorAll('.footnote-ref.is-active').forEach(ref => {
      ref.classList.remove('is-active');
    });
  }

  if (window.location.hash.startsWith('#fig')) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

document.querySelectorAll('.figure-ref').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const href = link.getAttribute('href');
    if (!href || !href.startsWith('#fig')) return;

    const figure = document.querySelector(href);
    if (!figure) return;

    const isOpen = figure.classList.contains('is-open');

    closeOpenFigures();
    if (isOpen) return;

    openFigureFromLink(link);
  });
});

document.querySelectorAll('.footnote-ref').forEach(button => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const noteId = button.dataset.footnote;
    if (!noteId) return;

    const note = document.getElementById(`note-${noteId}`);
    if (!note) return;

    const isOpen = note.classList.contains('is-open');

    closeOpenFigures();
    if (isOpen) return;

    note.classList.add('is-open');
    button.classList.add('is-active');
  });
});

document.addEventListener('click', (e) => {
  if (e.target.closest('.figure-ref') || e.target.closest('.footnote-ref')) return;
  closeOpenFigures();
}, true);

window.addEventListener('scroll', requestFigureSync, { passive: true });
window.addEventListener('resize', requestFigureSync);
requestFigureSync();