// ==UserScript==
// @name         Odoo Universal Search
// @namespace    tyler.odoo
// @version      2.0
// @description  A permanent search bar pinned to the top of every Odoo page. Searches multiple models at once through Odoo's own JSON-RPC endpoint using your existing session.
// @match        https://the-sign-brothers.odoo.com/*
// @updateURL    https://github.com/JPSignBros/OdooScripts-Install/raw/refs/heads/main/OdooUniversalSearch.user.js
// @downloadURL  https://github.com/JPSignBros/OdooScripts-Install/raw/refs/heads/main/OdooUniversalSearch.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict";

    /* ----------------------------------------------------------------
     * CONFIGURATION
     * ---------------------------------------------------------------- */

    /*
     * Height of the bar. The page is pushed down by exactly this much so
     * nothing in Odoo ends up hidden underneath it.
     */
    const BAR_HEIGHT = 44;

    /*
     * Jumps your cursor into the search box from anywhere.
     * Ctrl+Shift+F is unused by Chrome & by Odoo.
     */
    const HOTKEY = {
        key: "f",
        ctrl: true,
        shift: true,
        alt: false
    };

    /*
     * Models searched, in the order results are displayed.
     * Anything not installed, or that you lack access to, is detected on
     * the first search & skipped from then on. Add or remove freely.
     */
    const SEARCH_MODELS = [
        { model: "project.task", label: "Tasks" },
        { model: "project.project", label: "Projects" },
        { model: "res.partner", label: "Contacts" },
        { model: "crm.lead", label: "Opportunities" },
        { model: "sale.order", label: "Sales Orders" },
        { model: "account.move", label: "Invoices & Bills" },
        { model: "purchase.order", label: "Purchase Orders" },
        { model: "product.template", label: "Products" },
        { model: "helpdesk.ticket", label: "Tickets" }
    ];

    const RESULTS_PER_MODEL = 6;
    const MINIMUM_QUERY_LENGTH = 2;
    const DEBOUNCE_MILLISECONDS = 250;

    /*
     * How a record URL is built.
     *
     *   "modern" -> /odoo/m-project.task/42     (Odoo 17.4+ router)
     *   "legacy" -> /web#id=42&model=project.task&view_type=form
     *
     * If clicking a result lands you on a blank or wrong page, switch
     * this to "legacy".
     */
    const RECORD_URL_STYLE = "modern";

    const BAR_ID = "tyler-odoo-search-bar";
    const STYLE_ID = "tyler-odoo-search-style";
    const BODY_CLASS = "tyler-odoo-search-active";

    /* ----------------------------------------------------------------
     * STATE
     * ---------------------------------------------------------------- */

    let barElement = null;
    let inputElement = null;
    let dropdownElement = null;
    let statusElement = null;
    let clearButton = null;

    let debounceTimer = null;
    let requestToken = 0;

    let flatResults = [];
    let activeIndex = 0;

    // Models that returned an error once are not queried again.
    const disabledModels = new Set();

    /* ----------------------------------------------------------------
     * ODOO JSON-RPC
     * ---------------------------------------------------------------- */

    /*
     * Odoo's web client uses this endpoint for every model call. It
     * authenticates with the session cookie already in the browser, so
     * nothing extra is needed here. Routes of type "json" are exempt
     * from CSRF tokens, which is why no token is sent.
     */
    async function callKw(model, method, args, kwargs) {
        const response = await fetch("/web/dataset/call_kw", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "call",
                params: {
                    model: model,
                    method: method,
                    args: args,
                    kwargs: kwargs
                }
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();

        if (payload.error) {
            const message =
                payload.error.data?.message ||
                payload.error.message ||
                "Unknown Odoo error";

            throw new Error(message);
        }

        return payload.result;
    }

    /*
     * name_search exists on essentially every model & searches whatever
     * that model considers its display name: task title, invoice number,
     * order reference, partner name, & so on.
     */
    async function searchModel(entry, query) {
        const rows = await callKw(
            entry.model,
            "name_search",
            [],
            {
                name: query,
                limit: RESULTS_PER_MODEL,
                context: {}
            }
        );

        return (rows || []).map((row) => ({
            id: row[0],
            name: row[1],
            model: entry.model,
            label: entry.label
        }));
    }

    function buildRecordUrl(model, id) {
        if (RECORD_URL_STYLE === "legacy") {
            return `/web#id=${id}&model=${model}&view_type=form`;
        }

        return `/odoo/m-${model}/${id}`;
    }

    /* ----------------------------------------------------------------
     * STYLES
     * ---------------------------------------------------------------- */

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        const style = document.createElement("style");
        style.id = STYLE_ID;

        style.textContent = `
            /*
             * Push the whole Odoo client down by the height of the bar
             * instead of letting the bar float over the navbar.
             */
            body.${BODY_CLASS} {
                box-sizing: border-box !important;
                padding-top: ${BAR_HEIGHT}px !important;
            }

            body.${BODY_CLASS} .o_web_client,
            body.${BODY_CLASS} .o_action_manager {
                max-height: calc(100vh - ${BAR_HEIGHT}px) !important;
            }

            #${BAR_ID} {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: ${BAR_HEIGHT}px;
                z-index: 2000000;
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 0 14px;
                box-sizing: border-box;
                background: #1f2430;
                border-bottom: 1px solid #424958;
                font-family: Arial, sans-serif;
                color: #ffffff;
            }

            #${BAR_ID} .tyler-search-brand {
                flex: 0 0 auto;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.7px;
                text-transform: uppercase;
                color: #8d95a5;
            }

            #${BAR_ID} .tyler-search-field {
                position: relative;
                flex: 1 1 auto;
                max-width: 760px;
                display: flex;
                align-items: center;
            }

            #${BAR_ID} .tyler-search-input {
                width: 100%;
                box-sizing: border-box;
                height: 30px;
                border: 1px solid #4b5364;
                border-radius: 5px;
                background: #2b3140;
                color: #ffffff;
                font-size: 13px;
                padding: 0 30px 0 11px;
                outline: none;
            }

            #${BAR_ID} .tyler-search-input:focus {
                border-color: #7c88a0;
                background: #323949;
            }

            #${BAR_ID} .tyler-search-input::placeholder {
                color: #8d95a5;
            }

            #${BAR_ID} .tyler-search-clear {
                position: absolute;
                right: 6px;
                border: 0;
                background: transparent;
                color: #8d95a5;
                cursor: pointer;
                font-size: 15px;
                line-height: 1;
                padding: 2px 4px;
                display: none;
            }

            #${BAR_ID} .tyler-search-clear:hover {
                color: #ffffff;
            }

            #${BAR_ID} .tyler-search-hint {
                flex: 0 0 auto;
                font-size: 11px;
                color: #6f7789;
            }

            #${BAR_ID} .tyler-search-dropdown {
                position: absolute;
                top: calc(100% + 6px);
                left: 0;
                right: 0;
                max-height: calc(100vh - ${BAR_HEIGHT}px - 40px);
                overflow-y: auto;
                display: none;
                border: 1px solid #596273;
                border-radius: 7px;
                background: #252a36;
                box-shadow: 0 16px 48px rgba(0, 0, 0, 0.55);
                padding-bottom: 6px;
            }

            #${BAR_ID} .tyler-search-dropdown.tyler-open {
                display: block;
            }

            #${BAR_ID} .tyler-search-status {
                padding: 9px 14px;
                font-size: 11px;
                color: #9aa3b3;
            }

            #${BAR_ID} .tyler-result-group {
                padding: 7px 14px 3px;
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 0.6px;
                text-transform: uppercase;
                color: #8d95a5;
            }

            #${BAR_ID} .tyler-result {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 14px;
                padding: 8px 14px;
                cursor: pointer;
                font-size: 13px;
            }

            #${BAR_ID} .tyler-result-name {
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
            }

            #${BAR_ID} .tyler-result-meta {
                flex: 0 0 auto;
                font-size: 10px;
                color: #8d95a5;
            }

            #${BAR_ID} .tyler-result:hover,
            #${BAR_ID} .tyler-result.tyler-active {
                background: #394152;
            }
        `;

        document.head.appendChild(style);
    }

    /* ----------------------------------------------------------------
     * THE BAR
     * ---------------------------------------------------------------- */

    function buildBar() {
        injectStyles();

        barElement = document.createElement("div");
        barElement.id = BAR_ID;

        const brand = document.createElement("div");
        brand.className = "tyler-search-brand";
        brand.textContent = "Search";

        const field = document.createElement("div");
        field.className = "tyler-search-field";

        inputElement = document.createElement("input");
        inputElement.type = "text";
        inputElement.className = "tyler-search-input";
        inputElement.placeholder =
            "Search tasks, invoices, contacts, orders...";
        inputElement.autocomplete = "off";
        inputElement.spellcheck = false;

        clearButton = document.createElement("button");
        clearButton.type = "button";
        clearButton.className = "tyler-search-clear";
        clearButton.textContent = "×";
        clearButton.title = "Clear";

        dropdownElement = document.createElement("div");
        dropdownElement.className = "tyler-search-dropdown";

        statusElement = document.createElement("div");
        statusElement.className = "tyler-search-status";
        dropdownElement.appendChild(statusElement);

        const resultsHolder = document.createElement("div");
        resultsHolder.className = "tyler-search-results";
        dropdownElement.appendChild(resultsHolder);

        field.appendChild(inputElement);
        field.appendChild(clearButton);
        field.appendChild(dropdownElement);

        const hint = document.createElement("div");
        hint.className = "tyler-search-hint";
        hint.textContent = "Ctrl+Shift+F";

        barElement.appendChild(brand);
        barElement.appendChild(field);
        barElement.appendChild(hint);

        document.body.appendChild(barElement);
        document.body.classList.add(BODY_CLASS);

        inputElement.addEventListener("input", () => {
            clearButton.style.display = inputElement.value ? "block" : "none";

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(runSearch, DEBOUNCE_MILLISECONDS);
        });

        inputElement.addEventListener("focus", () => {
            if (flatResults.length || inputElement.value.trim()) {
                openDropdown();
            }
        });

        inputElement.addEventListener("keydown", handleInputKeydown);

        clearButton.addEventListener("click", resetSearch);
    }

    function ensureBar() {
        if (barElement && document.body.contains(barElement)) {
            return;
        }

        barElement = null;
        buildBar();
    }

    function getResultsHolder() {
        return dropdownElement.querySelector(".tyler-search-results");
    }

    function openDropdown() {
        dropdownElement.classList.add("tyler-open");
    }

    function closeDropdown() {
        dropdownElement.classList.remove("tyler-open");
    }

    function resetSearch() {
        inputElement.value = "";
        clearButton.style.display = "none";

        flatResults = [];
        activeIndex = 0;

        getResultsHolder().replaceChildren();
        closeDropdown();

        requestToken += 1;
        inputElement.focus();
    }

    /* ----------------------------------------------------------------
     * SEARCH
     * ---------------------------------------------------------------- */

    async function runSearch() {
        const query = inputElement.value.trim();

        requestToken += 1;
        const currentToken = requestToken;

        if (query.length < MINIMUM_QUERY_LENGTH) {
            flatResults = [];
            getResultsHolder().replaceChildren();
            statusElement.textContent =
                `Type at least ${MINIMUM_QUERY_LENGTH} characters.`;
            openDropdown();
            return;
        }

        statusElement.textContent = "Searching...";
        openDropdown();

        const activeModels = SEARCH_MODELS.filter(
            (entry) => !disabledModels.has(entry.model)
        );

        const settled = await Promise.all(
            activeModels.map(async (entry) => {
                try {
                    return await searchModel(entry, query);
                } catch (error) {
                    /*
                     * Model missing, uninstalled, or no access. Stop
                     * querying it rather than failing the whole search.
                     */
                    disabledModels.add(entry.model);
                    console.warn(
                        `[Odoo Universal Search] skipping ${entry.model}:`,
                        error.message
                    );
                    return [];
                }
            })
        );

        // A newer keystroke already fired; discard this response.
        if (currentToken !== requestToken) {
            return;
        }

        renderResults(settled.filter((group) => group.length > 0));
    }

    function renderResults(groups) {
        const holder = getResultsHolder();

        holder.replaceChildren();

        flatResults = [];
        activeIndex = 0;

        if (!groups.length) {
            statusElement.textContent = "No matches.";
            openDropdown();
            return;
        }

        const total = groups.reduce((sum, group) => sum + group.length, 0);

        statusElement.textContent =
            `${total} result${total === 1 ? "" : "s"}`;

        groups.forEach((group) => {
            const heading = document.createElement("div");
            heading.className = "tyler-result-group";
            heading.textContent = group[0].label;
            holder.appendChild(heading);

            group.forEach((record) => {
                const index = flatResults.length;
                flatResults.push(record);

                const row = document.createElement("div");
                row.className = "tyler-result";
                row.dataset.index = String(index);

                const name = document.createElement("div");
                name.className = "tyler-result-name";
                name.textContent = record.name;

                const meta = document.createElement("div");
                meta.className = "tyler-result-meta";
                meta.textContent = `#${record.id}`;

                row.appendChild(name);
                row.appendChild(meta);

                row.addEventListener("mousedown", (event) => {
                    event.preventDefault();
                    openRecord(record, event.ctrlKey || event.metaKey);
                });

                holder.appendChild(row);
            });
        });

        highlightActive();
        openDropdown();
    }

    function highlightActive() {
        const rows = Array.from(
            dropdownElement.querySelectorAll(".tyler-result")
        );

        rows.forEach((row) => {
            const isActive = Number(row.dataset.index) === activeIndex;

            row.classList.toggle("tyler-active", isActive);

            if (isActive) {
                row.scrollIntoView({ block: "nearest" });
            }
        });
    }

    function openRecord(record, inNewTab) {
        const url = buildRecordUrl(record.model, record.id);

        if (inNewTab) {
            window.open(url, "_blank");
            return;
        }

        closeDropdown();
        window.location.assign(url);
    }

    function handleInputKeydown(event) {
        if (event.key === "Escape") {
            event.preventDefault();

            if (dropdownElement.classList.contains("tyler-open")) {
                closeDropdown();
            } else {
                resetSearch();
                inputElement.blur();
            }

            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();

            if (flatResults.length) {
                activeIndex = (activeIndex + 1) % flatResults.length;
                highlightActive();
                openDropdown();
            }

            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();

            if (flatResults.length) {
                activeIndex =
                    (activeIndex - 1 + flatResults.length) %
                    flatResults.length;
                highlightActive();
            }

            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();

            const record = flatResults[activeIndex];

            if (record) {
                openRecord(record, event.ctrlKey || event.metaKey);
            }
        }
    }

    /* ----------------------------------------------------------------
     * GLOBAL LISTENERS
     * ---------------------------------------------------------------- */

    function matchesHotkey(event) {
        return (
            event.key.toLowerCase() === HOTKEY.key &&
            event.ctrlKey === HOTKEY.ctrl &&
            event.shiftKey === HOTKEY.shift &&
            event.altKey === HOTKEY.alt
        );
    }

    document.addEventListener(
        "keydown",
        (event) => {
            if (!matchesHotkey(event)) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            ensureBar();
            inputElement.focus();
            inputElement.select();
        },
        true
    );

    // Clicking anywhere outside the bar dismisses the results list.
    document.addEventListener("mousedown", (event) => {
        if (!barElement || barElement.contains(event.target)) {
            return;
        }

        closeDropdown();
    });

    /*
     * Odoo is a single page application & occasionally rebuilds large
     * parts of the DOM. This keeps the bar present & the page offset
     * applied no matter what the client does.
     */
    window.setInterval(() => {
        ensureBar();

        if (!document.body.classList.contains(BODY_CLASS)) {
            document.body.classList.add(BODY_CLASS);
        }
    }, 1500);

    ensureBar();
})();
