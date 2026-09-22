// ==UserScript==
// @name         Odoo Persistent List Column Widths
// @namespace    local.odoo.column-widths
// @version      1.0.0
// @description  Saves and restores manually resized column widths in Odoo list views.
// @match        https://the-sign-brothers.odoo.com/*
// @updateURL    https://github.com/JPSignBros/OdooScripts-Install/raw/refs/heads/main/OdooColumnWidth.user.js
// @downloadURL  https://github.com/JPSignBros/OdooScripts-Install/raw/refs/heads/main/OdooColumnWidth.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
    "use strict";

    const STORAGE_PREFIX = "odoo-persistent-column-widths:v1:";
    const SAVE_DELAY_MS = 150;
    const APPLY_DELAY_MS = 100;

    let saveTimer = null;
    let applyTimer = null;
    let lastPointerDownHeader = null;

    /*
     * Odoo list tables commonly use .o_list_table.
     * Additional selectors are included for compatibility across versions.
     */
    const TABLE_SELECTOR = [
        ".o_list_view table.o_list_table",
        ".o_list_renderer table.o_list_table",
        "table.o_list_table"
    ].join(", ");

    const HEADER_SELECTOR = "thead th";

    function getDatabaseName() {
        try {
            const session = window.odoo?.session_info;

            return (
                session?.db ||
                session?.db_name ||
                new URLSearchParams(location.search).get("db") ||
                location.hostname
            );
        } catch {
            return location.hostname;
        }
    }

    function getHashParameters() {
        const hash = location.hash.replace(/^#/, "");
        return new URLSearchParams(hash);
    }

    function getViewIdentity(table) {
        const hash = getHashParameters();

        const action =
            hash.get("action") ||
            document.querySelector(".o_action_manager")?.getAttribute("data-action-id") ||
            "unknown-action";

        const model =
            hash.get("model") ||
            table.closest("[data-res-model]")?.getAttribute("data-res-model") ||
            document.querySelector("[data-res-model]")?.getAttribute("data-res-model") ||
            "unknown-model";

        const view =
            hash.get("view_id") ||
            hash.get("view_type") ||
            "list";

        return [
            getDatabaseName(),
            location.pathname,
            action,
            model,
            view
        ].join("|");
    }

    function getStorageKey(table) {
        return STORAGE_PREFIX + getViewIdentity(table);
    }

    function isUsableHeader(header) {
        if (!(header instanceof HTMLElement)) {
            return false;
        }

        if (header.hidden || header.offsetParent === null) {
            return false;
        }

        return true;
    }

    function normalizeText(value) {
        return String(value || "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    }

    function getColumnIdentifier(header, index) {
        /*
         * Prefer Odoo field metadata. Fall back to the visible label and index.
         * The index prevents two identically named columns from colliding.
         */
        const fieldName =
            header.dataset.name ||
            header.getAttribute("data-name") ||
            header.getAttribute("name") ||
            header.querySelector("[data-name]")?.getAttribute("data-name");

        const classes = [...header.classList]
            .filter((className) => className.startsWith("o_"))
            .sort()
            .join(".");

        const label =
            header.getAttribute("title") ||
            header.getAttribute("aria-label") ||
            header.innerText ||
            header.textContent ||
            "";

        return [
            fieldName || "no-field",
            normalizeText(label) || "no-label",
            classes || "no-class",
            index
        ].join("|");
    }

    function readSavedWidths(table) {
        try {
            const raw = localStorage.getItem(getStorageKey(table));

            if (!raw) {
                return null;
            }

            const parsed = JSON.parse(raw);

            if (!parsed || typeof parsed !== "object") {
                return null;
            }

            return parsed;
        } catch (error) {
            console.warn("[Odoo column widths] Could not read saved widths.", error);
            return null;
        }
    }

    function writeSavedWidths(table, widths) {
        try {
            localStorage.setItem(
                getStorageKey(table),
                JSON.stringify(widths)
            );
        } catch (error) {
            console.warn("[Odoo column widths] Could not save widths.", error);
        }
    }

    function measureAndSaveTable(table) {
        if (!(table instanceof HTMLTableElement)) {
            return;
        }

        const headers = [...table.querySelectorAll(HEADER_SELECTOR)]
            .filter(isUsableHeader);

        if (!headers.length) {
            return;
        }

        const saved = readSavedWidths(table) || {};

        headers.forEach((header, index) => {
            const width = Math.round(header.getBoundingClientRect().width);

            /*
             * Ignore unrealistically small measurements caused by an element
             * temporarily being hidden while Odoo is rendering.
             */
            if (width < 20) {
                return;
            }

            const columnId = getColumnIdentifier(header, index);

            saved[columnId] = width;
        });

        writeSavedWidths(table, saved);
    }

    function setColumnWidth(table, header, index, width) {
        if (!Number.isFinite(width) || width < 20) {
            return;
        }

        const pixelWidth = `${Math.round(width)}px`;

        header.style.setProperty("width", pixelWidth, "important");
        header.style.setProperty("min-width", pixelWidth, "important");
        header.style.setProperty("max-width", pixelWidth, "important");

        /*
         * Set the corresponding body cells as well. Some Odoo versions place
         * width only on the header, while others recalculate body cells.
         */
        const rows = table.querySelectorAll("tbody tr");

        rows.forEach((row) => {
            const cell = row.children[index];

            if (!(cell instanceof HTMLElement)) {
                return;
            }

            cell.style.setProperty("width", pixelWidth, "important");
            cell.style.setProperty("min-width", pixelWidth, "important");
            cell.style.setProperty("max-width", pixelWidth, "important");
        });
    }

    function applySavedWidthsToTable(table) {
        if (!(table instanceof HTMLTableElement)) {
            return;
        }

        const saved = readSavedWidths(table);

        if (!saved) {
            return;
        }

        const headers = [...table.querySelectorAll(HEADER_SELECTOR)]
            .filter(isUsableHeader);

        headers.forEach((header, index) => {
            const columnId = getColumnIdentifier(header, index);
            const width = Number(saved[columnId]);

            if (Number.isFinite(width)) {
                setColumnWidth(table, header, index, width);
            }
        });
    }

    function getVisibleTables() {
        return [...document.querySelectorAll(TABLE_SELECTOR)]
            .filter((table) => {
                return (
                    table instanceof HTMLTableElement &&
                    table.offsetParent !== null
                );
            });
    }

    function applyAllSavedWidths() {
        getVisibleTables().forEach(applySavedWidthsToTable);
    }

    function scheduleApply() {
        clearTimeout(applyTimer);

        applyTimer = setTimeout(() => {
            applyAllSavedWidths();
        }, APPLY_DELAY_MS);
    }

    function scheduleSave(table) {
        clearTimeout(saveTimer);

        saveTimer = setTimeout(() => {
            measureAndSaveTable(table);
            applySavedWidthsToTable(table);
        }, SAVE_DELAY_MS);
    }

    function findOwningTable(element) {
        const table = element?.closest?.(TABLE_SELECTOR);
        return table instanceof HTMLTableElement ? table : null;
    }

    /*
     * Remember whether the pointer interaction began in a list header.
     * Odoo's resize handle may be inside the <th> or layered over its edge.
     */
    document.addEventListener(
        "pointerdown",
        (event) => {
            const target = event.target;

            if (!(target instanceof Element)) {
                lastPointerDownHeader = null;
                return;
            }

            const header = target.closest("thead th");
            const table = findOwningTable(target);

            lastPointerDownHeader =
                header instanceof HTMLElement && table
                    ? { header, table }
                    : null;
        },
        true
    );

    /*
     * Save after the user releases the pointer following a header resize.
     */
    document.addEventListener(
        "pointerup",
        () => {
            if (!lastPointerDownHeader) {
                return;
            }

            const { table } = lastPointerDownHeader;
            lastPointerDownHeader = null;

            scheduleSave(table);
        },
        true
    );

    /*
     * Keyboard and some Odoo implementations can produce a mouseup without
     * the Pointer Events path above.
     */
    document.addEventListener(
        "mouseup",
        (event) => {
            const target = event.target;

            if (!(target instanceof Element)) {
                return;
            }

            const table =
                findOwningTable(target) ||
                lastPointerDownHeader?.table;

            if (table) {
                scheduleSave(table);
            }
        },
        true
    );

    /*
     * Odoo replaces list components while navigating, filtering, grouping,
     * paging, opening modules, or changing views.
     */
    const observer = new MutationObserver(() => {
        scheduleApply();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    /*
     * Odoo navigation frequently changes only the URL hash.
     */
    window.addEventListener("hashchange", scheduleApply);
    window.addEventListener("popstate", scheduleApply);

    /*
     * Reapply after the browser changes available space.
     */
    window.addEventListener("resize", scheduleApply);

    scheduleApply();

    /*
     * Optional console utilities:
     *
     * odooColumnWidths.clearCurrent()
     * odooColumnWidths.clearAll()
     * odooColumnWidths.saveCurrent()
     */
    window.odooColumnWidths = {
        saveCurrent() {
            getVisibleTables().forEach(measureAndSaveTable);
            applyAllSavedWidths();
        },

        clearCurrent() {
            getVisibleTables().forEach((table) => {
                localStorage.removeItem(getStorageKey(table));
            });

            location.reload();
        },

        clearAll() {
            Object.keys(localStorage)
                .filter((key) => key.startsWith(STORAGE_PREFIX))
                .forEach((key) => localStorage.removeItem(key));

            location.reload();
        }
    };

    console.info(
        "[Odoo column widths] Persistent column widths are active."
    );
})();
