// ==UserScript==
// @name         Odoo Right-Click Cell Edit
// @namespace    tyler.odoo.rightclick
// @version      1.0
// @description  Right-click to edit list view cells without opening the record
// @match        https://the-sign-brothers.odoo.com/odoo/*
// @updateURL    https://github.com/JPSignBros/OdooScripts-Install/raw/refs/heads/main/RightClicktoEdit%20script.user.js
// @downloadURL  https://github.com/JPSignBros/OdooScripts-Install/raw/refs/heads/main/RightClicktoEdit%20script.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict";

    const READONLY_COLUMNS = ["Customer", "Project", "Time Spent", "Time Remaining"];
    let activeEditor = null;
    let activeRow = null;

    function getColumnName(cell) {
        const table = cell.closest("table");
        if (!table) return "";

        const cellIndex = cell.cellIndex;
        const headerRow = table.querySelector("thead tr");
        if (!headerRow) return "";

        const headerCell = headerRow.cells[cellIndex];
        return headerCell ? headerCell.textContent.trim() : "";
    }

    function isReadOnlyColumn(cell) {
        const columnName = getColumnName(cell);
        return READONLY_COLUMNS.some(col => columnName.includes(col));
    }

    function uncheckRow(row) {
        if (!row) return;
        console.log("Unchecking row");
        const checkbox = row.querySelector("input[type='checkbox']");
        if (checkbox && checkbox.checked) {
            // Set checked to false directly - don't click it
            checkbox.checked = false;

            // Trigger change event on checkbox to notify Odoo
            const changeEvent = new Event("change", { bubbles: true });
            checkbox.dispatchEvent(changeEvent);
        }
        activeEditor = null;
        activeRow = null;
    }

    function setupEditorWatcher(cell, row) {
        // Store active editor/row so we can track it
        activeRow = row;

        // Try multiple times to find the editor as it may take time to appear
        let attempts = 0;
        const findEditor = setInterval(() => {
            attempts++;
            console.log("Attempt " + attempts + " to find editor...");

            // Look for editor in the cell or document
            let editor = cell.querySelector("input, select, textarea");
            if (!editor) {
                editor = document.querySelector(".o_field_widget input, .o_field_widget select, .o_field_widget textarea");
            }

            if (editor) {
                console.log("Found editor!");
                clearInterval(findEditor);

                activeEditor = editor;
                console.log("Found editor, setting up listeners");

                let hasChanged = false;

                // Listen for value change
                const handleChange = () => {
                    console.log("Change event fired on editor");
                    hasChanged = true;
                };

                editor.addEventListener("change", handleChange);
                console.log("Change listener attached to editor");

                // Watch for when the editor disappears (after user confirms edit)
                const watchEditorDisappear = setInterval(() => {
                    const editorStillExists = cell.querySelector("input, select, textarea");

                    if (!editorStillExists && hasChanged) {
                        console.log("Editor disappeared and value changed, unchecking row");
                        clearInterval(watchEditorDisappear);
                        uncheckRow(row);
                    }
                }, 100);
            }

            if (attempts > 20) {
                clearInterval(findEditor);
                console.log("Could not find editor after 20 attempts");
            }
        }, 50);
    }

    function handleDocumentClick(e) {
        // If user clicks outside the editor, uncheck the row
        if (activeEditor && activeRow) {
            const cell = activeEditor.closest("td");
            if (cell && !cell.contains(e.target)) {
                console.log("Clicked outside editor, unchecking row");
                uncheckRow(activeRow);
            }
        }
    }

    function handleRightClick(e) {
        const cell = e.target.closest("td");

        if (!cell) {
            return;
        }

        // Skip if clicking on selector, input, or button
        if (
            e.target.tagName === "INPUT" ||
            e.target.tagName === "BUTTON" ||
            e.target.closest(".o_list_record_selector")
        ) {
            return;
        }

        // Check if this column is read-only
        if (isReadOnlyColumn(cell)) {
            return;
        }

        console.log("Right-click on editable cell, triggering edit...");

        // Prevent the context menu
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Get the row
        const row = cell.closest("tr");
        if (!row) return;

        // Set up watcher to uncheck when value changes
        setupEditorWatcher(cell, row);

        // Find and click the checkbox to select the row
        const checkbox = row.querySelector("input[type='checkbox']");
        if (checkbox && !checkbox.checked) {
            console.log("Selecting row via checkbox");
            checkbox.click();
        }

        // Now click the cell to enter edit mode
        setTimeout(() => {
            console.log("Clicking cell to enter edit mode");
            const clickEvent = new MouseEvent("click", {
                bubbles: true,
                cancelable: true,
                view: window
            });
            cell.dispatchEvent(clickEvent);

            // Focus any editor that appears
            setTimeout(() => {
                const editor = cell.querySelector("input, select, textarea");
                if (editor) {
                    console.log("Found editor, focusing");
                    editor.focus();
                    if (editor.select) editor.select();
                }
            }, 50);
        }, 100);
    }

    function initialize() {
        const table = document.querySelector("table.o_list_table");
        console.log("Right-click cell edit: Table found:", !!table);

        if (!table) {
            setTimeout(initialize, 500);
            return;
        }

        // Attach right-click listener to document
        document.addEventListener("contextmenu", handleRightClick, true);

        // Attach click listener to detect clicks outside editor
        document.addEventListener("click", handleDocumentClick, false);

        console.log("✓ Right-click cell edit enabled");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize);
    } else {
        initialize();
    }
})();
