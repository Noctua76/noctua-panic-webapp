(function initAegisDemoGuidance(global) {
  "use strict";

  const demoLimitations = {
    en: {
      title: "Demo mode",
      body: "You are viewing this page with read-only Preview Access. Actions that create, edit, delete, approve, configure or otherwise modify operational data are disabled. The production platform provides these capabilities according to the user's assigned role and permissions.",
    },
    gr: {
      title: "Λειτουργία επίδειξης",
      body: "Βλέπετε αυτή τη σελίδα μέσω Preview Access μόνο για ανάγνωση. Ενέργειες που δημιουργούν, τροποποιούν, διαγράφουν, εγκρίνουν, παραμετροποιούν ή μεταβάλλουν επιχειρησιακά δεδομένα είναι απενεργοποιημένες. Στο κανονικό περιβάλλον οι δυνατότητες αυτές παρέχονται σύμφωνα με τον ρόλο και τα δικαιώματα του χρήστη.",
    },
  };

  const guides = {
    guardHome: {
      id: "guardHome",
      title: { en: "Guard Home", gr: "Αρχική Φύλακα" },
      intro: {
        en: "The current operational picture for the authenticated guard and active shift.",
        gr: "Η τρέχουσα επιχειρησιακή εικόνα για τον πιστοποιημένο φύλακα και την ενεργή βάρδια.",
      },
      seeing: {
        en: ["Guard, site, shift presence and available GPS status", "Incident/Panic escalation and links to patrols and Shift Reports"],
        gr: ["Φύλακα, εγκατάσταση, παρουσία βάρδιας και διαθέσιμη κατάσταση GPS", "Κλιμάκωση συμβάντος/Panic και πρόσβαση σε περιπολίες και αναφορές βάρδιας"],
      },
      howItWorks: {
        en: ["Heartbeat and permitted device-location signals provide operational awareness while the app is active.", "Incident/Panic is used when operational escalation is required; configured contacts and delivery services remain protected.", "The screen links the guard to the work permitted for the current shift."],
        gr: ["Το heartbeat και τα επιτρεπόμενα σήματα τοποθεσίας της συσκευής παρέχουν επιχειρησιακή εικόνα όσο η εφαρμογή λειτουργεί.", "Το Incident/Panic χρησιμοποιείται όταν απαιτείται επιχειρησιακή κλιμάκωση· οι ρυθμισμένες επαφές και οι υπηρεσίες αποστολής παραμένουν προστατευμένες.", "Η οθόνη συνδέει τον φύλακα με τις εργασίες που επιτρέπονται στην τρέχουσα βάρδια."],
      },
      value: {
        en: ["Keeps shift context, escalation and field activity in one mobile view."],
        gr: ["Συγκεντρώνει το πλαίσιο βάρδιας, την κλιμάκωση και τη δραστηριότητα πεδίου σε μία mobile εικόνα."],
      },
      demoLimitations,
    },
    patrolBoard: {
      id: "patrolBoard",
      title: { en: "Patrol Board & QR Scan", gr: "Πίνακας Περιπολιών & QR Scan" },
      intro: {
        en: "The shift-scoped patrol board shows only the patrol activity the guard is operationally allowed to know.",
        gr: "Ο πίνακας περιπολιών της βάρδιας εμφανίζει μόνο τη δραστηριότητα που επιτρέπεται επιχειρησιακά να γνωρίζει ο φύλακας.",
      },
      seeing: {
        en: ["Active Now and Upcoming patrols", "Completed, Late Completed and Missed history for the shift", "The QR scan area for an eligible patrol"],
        gr: ["Περιπολίες Active Now και Upcoming", "Ιστορικό Completed, Late Completed και Missed της βάρδιας", "Περιοχή QR scan για επιλέξιμη περιπολία"],
      },
      howItWorks: {
        en: ["Random patrols may remain hidden until shortly before execution; reminders normally appear about 15 minutes before.", "Scan access normally opens about 5 minutes before the scheduled time.", "A patrol may be Completed normally, Late Completed up to +2 hours, or Missed afterward.", "QR scan confirms physical presence at the patrol point without exposing credential or validation internals."],
        gr: ["Οι Random περιπολίες μπορεί να παραμένουν κρυφές μέχρι λίγο πριν από την εκτέλεση· οι υπενθυμίσεις εμφανίζονται συνήθως περίπου 15 λεπτά πριν.", "Η δυνατότητα scan ανοίγει συνήθως περίπου 5 λεπτά πριν από την προγραμματισμένη ώρα.", "Μια περιπολία μπορεί να γίνει Completed κανονικά, Late Completed έως +2 ώρες ή Missed στη συνέχεια.", "Το QR scan επιβεβαιώνει τη φυσική παρουσία στο σημείο περιπολίας χωρίς να αποκαλύπτει στοιχεία του credential ή του μηχανισμού επικύρωσης."],
      },
      value: {
        en: ["Provides clear timing, verifiable field presence and a consistent shift record."],
        gr: ["Παρέχει σαφή χρονικά όρια, επαληθεύσιμη παρουσία πεδίου και συνεπή καταγραφή βάρδιας."],
      },
      demoLimitations,
    },
    shiftReport: {
      id: "shiftReport",
      title: { en: "Shift Report", gr: "Αναφορά Βάρδιας" },
      intro: {
        en: "A structured operational report connected to the current guard, site and shift.",
        gr: "Δομημένη επιχειρησιακή αναφορά που συνδέεται με τον τρέχοντα φύλακα, την εγκατάσταση και τη βάρδια.",
      },
      seeing: {
        en: ["Report category, priority and operational note", "Optional photographs and the reports already submitted during the shift"],
        gr: ["Κατηγορία αναφοράς, προτεραιότητα και επιχειρησιακή σημείωση", "Προαιρετικές φωτογραφίες και αναφορές που έχουν ήδη υποβληθεί στη βάρδια"],
      },
      howItWorks: {
        en: ["The guard records a clear observation or handover note and may attach permitted photographs.", "After submission, the report becomes an immutable operational record available to authorized Dashboard users."],
        gr: ["Ο φύλακας καταγράφει σαφή παρατήρηση ή σημείωση παράδοσης και μπορεί να επισυνάψει επιτρεπόμενες φωτογραφίες.", "Μετά την υποβολή, η αναφορά γίνεται αμετάβλητη επιχειρησιακή καταγραφή διαθέσιμη στους εξουσιοδοτημένους χρήστες του Dashboard."],
      },
      value: {
        en: ["Creates dependable shift handover, evidence and audit history."],
        gr: ["Δημιουργεί αξιόπιστη παράδοση βάρδιας, τεκμηρίωση και ιστορικό ελέγχου."],
      },
      demoLimitations,
    },
  };

  const ui = {
    en: { badge: "DEMO · READ ONLY", help: "How this page works", close: "Close", seeing: "What you're seeing", works: "How it works", value: "Operational value", welcomeTitle: "Welcome to Aegis Link", welcomeBody: "You are viewing the Aegis Link demonstration environment in read-only mode.", welcomeHint: "Explore the platform freely. Look for the ⓘ icon on each page to understand how each operational module works.", welcomeLimit: "Actions that modify operational data are disabled in this environment.", explore: "Explore Aegis Link" },
    gr: { badge: "DEMO · ΜΟΝΟ ΑΝΑΓΝΩΣΗ", help: "Πώς λειτουργεί αυτή η σελίδα", close: "Κλείσιμο", seeing: "Τι βλέπετε", works: "Πώς λειτουργεί", value: "Επιχειρησιακή αξία", welcomeTitle: "Καλώς ήρθατε στο Aegis Link", welcomeBody: "Βρίσκεστε στο περιβάλλον επίδειξης του Aegis Link με πρόσβαση μόνο για ανάγνωση.", welcomeHint: "Μπορείτε να περιηγηθείτε ελεύθερα στην πλατφόρμα. Αναζητήστε το εικονίδιο ⓘ σε κάθε σελίδα για να δείτε πώς λειτουργεί κάθε επιχειρησιακή ενότητα.", welcomeLimit: "Οι ενέργειες που μεταβάλλουν επιχειρησιακά δεδομένα είναι απενεργοποιημένες στο περιβάλλον επίδειξης.", explore: "Περιήγηση στο Aegis Link" },
  };

  const resolveLanguage = (value) => String(value || "").toLowerCase().startsWith("el") ? "gr" : "en";
  const isPreviewSession = (session) => session?.guard?.access_mode === "read_only";
  let mounted = null;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function focusables(dialog) {
    return Array.from(dialog.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
  }

  function createDialog({ className, titleId, returnFocus, close }) {
    const backdrop = element("div", "demo-guidance-backdrop");
    const dialog = element("section", `demo-guidance-dialog ${className}`);
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", titleId);
    backdrop.append(dialog);
    backdrop.addEventListener("mousedown", (event) => { if (event.target === backdrop) close(); });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keydown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab") return;
      const items = focusables(dialog);
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener("keydown", keydown);
    document.body.append(backdrop);
    requestAnimationFrame(() => focusables(dialog)[0]?.focus());
    return {
      dialog,
      destroy() {
        document.removeEventListener("keydown", keydown);
        document.body.style.overflow = previousOverflow;
        backdrop.remove();
        requestAnimationFrame(() => returnFocus?.focus());
      },
    };
  }

  function languageSwitch(language, setLanguage) {
    const group = element("div", "demo-guidance-language");
    group.setAttribute("aria-label", "Guide language");
    [["en", "EN"], ["gr", "ΕΛ"]].forEach(([value, label]) => {
      const button = element("button", value === language ? "active" : "", label);
      button.type = "button";
      button.setAttribute("aria-pressed", String(value === language));
      button.addEventListener("click", () => setLanguage(value));
      group.append(button);
    });
    return group;
  }

  function appendList(container, title, items) {
    const section = element("section");
    section.append(element("h3", "", title));
    const list = element("ul");
    items.forEach((item) => list.append(element("li", "", item)));
    section.append(list);
    container.append(section);
  }

  function mount(options) {
    const mountKey = options?.preview
      ? `${options.guideId}:${options.surface || "guard"}:${options.sessionIdentity || "active"}`
      : "inactive";
    if (mounted?.key === mountKey) return;
    mounted?.destroy();
    mounted = null;
    if (!options?.preview || !guides[options.guideId]) return;

    let language = resolveLanguage(options.language || document.documentElement.lang || navigator.language);
    const guide = guides[options.guideId];
    const root = options.root || document.querySelector("#mainApp .app-main, main.app, .app");
    if (!root) return;

    const toolbar = element("div", "demo-guidance-toolbar");
    toolbar.setAttribute("role", "status");
    const badge = element("span", "demo-mode-badge", ui[language].badge);
    const help = element("button", "demo-guide-button");
    help.type = "button";
    help.setAttribute("aria-label", ui[language].help);
    help.append(element("span", "", "ⓘ"), element("span", "demo-guide-button-label", ui[language].help));
    toolbar.append(badge, help);

    const updateToolbarLanguage = () => {
      badge.textContent = ui[language].badge;
      help.setAttribute("aria-label", ui[language].help);
      const label = help.querySelector(".demo-guide-button-label");
      if (label) label.textContent = ui[language].help;
    };

    const firstCard = root.matches(".app") ? root.firstElementChild : null;
    if (firstCard) firstCard.after(toolbar); else root.prepend(toolbar);

    let activeDialog = null;
    const renderGuide = () => {
      activeDialog?.destroy();
      const close = () => { activeDialog?.destroy(); activeDialog = null; };
      activeDialog = createDialog({ className: "demo-guidance-drawer", titleId: "guard-demo-guide-title", returnFocus: help, close });
      const dialog = activeDialog.dialog;
      const header = element("header");
      const rerender = (next) => { language = next; updateToolbarLanguage(); close(); renderGuide(); };
      header.append(languageSwitch(language, rerender));
      const closeButton = element("button", "demo-guidance-close", `× ${ui[language].close}`);
      closeButton.type = "button";
      closeButton.setAttribute("aria-label", ui[language].close);
      closeButton.addEventListener("click", close);
      header.append(closeButton);
      dialog.append(header);
      const scroll = element("div", "demo-guidance-scroll");
      scroll.append(element("p", "demo-guidance-eyebrow", "AEGIS LINK · DEMO GUIDE"));
      const title = element("h2", "", guide.title[language]); title.id = "guard-demo-guide-title"; scroll.append(title);
      scroll.append(element("p", "demo-guidance-intro", guide.intro[language]));
      appendList(scroll, ui[language].seeing, guide.seeing[language]);
      appendList(scroll, ui[language].works, guide.howItWorks[language]);
      appendList(scroll, ui[language].value, guide.value[language]);
      const limitations = element("section", "demo-guidance-limitations");
      limitations.append(element("h3", "", guide.demoLimitations[language].title), element("p", "", guide.demoLimitations[language].body));
      scroll.append(limitations);
      dialog.append(scroll);
    };
    help.addEventListener("click", renderGuide);

    const welcomeKey = `aegis-demo-welcome:${options.surface || "guard"}:${options.sessionIdentity || "active"}`;
    const showWelcome = () => {
      if (sessionStorage.getItem(welcomeKey) === "dismissed") return;
      const close = () => { sessionStorage.setItem(welcomeKey, "dismissed"); activeDialog?.destroy(); activeDialog = null; };
      activeDialog = createDialog({ className: "demo-guidance-welcome", titleId: "guard-demo-welcome-title", returnFocus: help, close });
      const dialog = activeDialog.dialog;
      const rerender = (next) => { language = next; updateToolbarLanguage(); activeDialog?.destroy(); activeDialog = null; showWelcome(); };
      const header = element("header"); header.append(languageSwitch(language, rerender)); dialog.append(header);
      dialog.append(element("div", "demo-guidance-welcome-mark", "ⓘ"));
      const title = element("h2", "", ui[language].welcomeTitle); title.id = "guard-demo-welcome-title"; dialog.append(title);
      dialog.append(element("p", "", ui[language].welcomeBody), element("p", "", ui[language].welcomeHint), element("p", "demo-guidance-welcome-limit", ui[language].welcomeLimit));
      const explore = element("button", "demo-guidance-primary", ui[language].explore); explore.type = "button"; explore.addEventListener("click", close); dialog.append(explore);
    };
    showWelcome();

    mounted = {
      key: mountKey,
      destroy() { activeDialog?.destroy(); toolbar.remove(); },
    };
  }

  const api = { guides, isPreviewSession, mount, resolveLanguage };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.AegisDemoGuidance = api;
})(typeof window !== "undefined" ? window : globalThis);
