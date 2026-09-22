// ==UserScript==
// @name         Odoo Custom Shortcut Dashboard
// @namespace    tyler.odoo.shortcuts
// @version      1.0
// @description  Create persistent shortcuts to saved views on Odoo dashboard
// @match        https://the-sign-brothers.odoo.com/odoo*
// @updateURL    https://github.com/JPSignBros/OdooScripts-Install/raw/refs/heads/main/ShortCutBar%20script.user.js
// @downloadURL  https://github.com/JPSignBros/OdooScripts-Install/raw/refs/heads/main/ShortCutBar%20script.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict";

    const SHORTCUTS_STORAGE_KEY = "tyler-odoo-shortcuts";
    const CONTAINER_ID = "tyler-shortcuts-container";
    const MODAL_ID = "tyler-shortcuts-modal";
    const OVERLAY_ID = "tyler-shortcuts-overlay";
    const FLOATING_BTN_ID = "tyler-floating-create-shortcut";
    const INSPECTOR_BTN_ID = "tyler-view-inspector";
    const INSPECTOR_PANEL_ID = "tyler-inspector-panel";

    // Default shortcuts for new installations
    const DEFAULT_SHORTCUTS = [
        { id: 1, name: "Home", url: "https://the-sign-brothers.odoo.com/odoo", viewName: "", model: "", color: "#0066CC", icon: "🎯" }
    ];

    function injectStyles() {
        const style = document.createElement("style");
        style.textContent = `
            #${CONTAINER_ID} {
                background: #ffffff;
                border-bottom: 2px solid #f0f0f0;
                padding: 12px 20px;
                display: flex;
                gap: 10px;
                align-items: center;
                flex-wrap: wrap;
                font-family: Arial, sans-serif;
            }

            @media (prefers-color-scheme: dark) {
                #${CONTAINER_ID} {
                    background: #252a36;
                    border-bottom: 2px solid #3a3f4e;
                }
            }

            #${CONTAINER_ID}.hidden {
                display: none;
            }

            .tyler-shortcut {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                border-radius: 5px;
                cursor: pointer;
                text-decoration: none;
                color: #ffffff;
                font-size: 13px;
                font-weight: 600;
                transition: all 0.2s;
                user-select: none;
                border: none;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }

            .tyler-shortcut:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            }

            .tyler-shortcut-icon {
                font-size: 16px;
            }

            .tyler-shortcut-settings {
                margin-left: auto;
                padding: 6px 10px;
                background: #e0e0e0;
                color: #111111;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                transition: background 0.2s;
            }

            .tyler-shortcut-settings:hover {
                background: #d0d0d0;
            }

            @media (prefers-color-scheme: dark) {
                .tyler-shortcut-settings {
                    background: #3a3f4e;
                    color: #ffffff;
                }

                .tyler-shortcut-settings:hover {
                    background: #4a5060;
                }
            }

            #${OVERLAY_ID} {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 9998;
                display: none;
            }

            #${MODAL_ID} {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 90%;
                max-width: 700px;
                max-height: 85vh;
                background: #ffffff;
                border-radius: 8px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                z-index: 9999;
                display: none;
                overflow-y: auto;
                font-family: Arial, sans-serif;
            }

            #${MODAL_ID} .tyler-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 18px;
                border-bottom: 1px solid #e0e0e0;
                background: #f8f9fa;
            }

            #${MODAL_ID} .tyler-modal-title {
                font-size: 18px;
                font-weight: bold;
                color: #111111;
            }

            #${MODAL_ID} .tyler-modal-close {
                background: transparent;
                border: none;
                font-size: 28px;
                cursor: pointer;
                color: #666666;
                padding: 0;
            }

            #${MODAL_ID} .tyler-modal-close:hover {
                color: #111111;
            }

            #${MODAL_ID} .tyler-modal-body {
                padding: 18px;
            }

            #${MODAL_ID} .tyler-shortcuts-list {
                margin-bottom: 20px;
            }

            #${MODAL_ID} .tyler-shortcut-item {
                display: flex;
                gap: 12px;
                align-items: center;
                padding: 12px;
                border: 1px solid #e0e0e0;
                border-radius: 5px;
                margin-bottom: 10px;
                background: #f9f9f9;
                transition: all 0.2s;
            }

            #${MODAL_ID} .tyler-shortcut-item:hover {
                background: #f0f0f0;
                border-color: #0066cc;
            }

            #${MODAL_ID} .tyler-shortcut-preview {
                width: 40px;
                height: 40px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                flex-shrink: 0;
            }

            #${MODAL_ID} .tyler-shortcut-details {
                flex: 1;
            }

            #${MODAL_ID} .tyler-shortcut-name {
                font-weight: 600;
                color: #111111;
                font-size: 13px;
            }

            #${MODAL_ID} .tyler-shortcut-url {
                font-size: 11px;
                color: #666666;
                word-break: break-all;
                margin-top: 3px;
            }

            #${MODAL_ID} .tyler-shortcut-actions {
                display: flex;
                gap: 6px;
            }

            #${MODAL_ID} .tyler-btn-small {
                padding: 5px 10px;
                border: 1px solid #d0d0d0;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
                font-weight: 600;
                background: #ffffff;
                color: #111111;
                transition: all 0.2s;
            }

            #${MODAL_ID} .tyler-btn-small:hover:not(:disabled) {
                background: #f0f0f0;
            }

            #${MODAL_ID} .tyler-btn-small:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }

            #${MODAL_ID} .tyler-btn-arrow {
                padding: 5px 8px;
                border: 1px solid #0066cc;
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                background: #e7f3ff;
                color: #0066cc;
                transition: all 0.2s;
            }

            #${MODAL_ID} .tyler-btn-arrow:hover:not(:disabled) {
                background: #0066cc;
                color: #ffffff;
            }

            #${MODAL_ID} .tyler-btn-arrow:disabled {
                opacity: 0.3;
                cursor: not-allowed;
                border-color: #d0d0d0;
                background: #f0f0f0;
                color: #999999;
            }

            #${MODAL_ID} .tyler-btn-delete {
                background: #ff6b6b;
                color: white;
                border: none;
            }

            #${MODAL_ID} .tyler-btn-delete:hover {
                background: #cc5555;
            }

            #${MODAL_ID} .tyler-btn-edit {
                background: #17a2b8;
                color: white;
                border: none;
            }

            #${MODAL_ID} .tyler-btn-edit:hover {
                background: #138496;
            }

            #${MODAL_ID} .tyler-add-shortcut-form {
                border: 2px dashed #0066cc;
                border-radius: 5px;
                padding: 16px;
                background: #f0f7ff;
                margin-bottom: 20px;
            }

            #${MODAL_ID} .tyler-form-row {
                display: flex;
                gap: 12px;
                margin-bottom: 12px;
                flex-wrap: wrap;
            }

            #${MODAL_ID} .tyler-form-group {
                flex: 1;
                min-width: 150px;
            }

            #${MODAL_ID} label {
                display: block;
                font-weight: 600;
                margin-bottom: 5px;
                color: #111111;
                font-size: 12px;
            }

            #${MODAL_ID} input,
            #${MODAL_ID} select {
                width: 100%;
                padding: 8px 10px;
                border: 1px solid #d0d0d0;
                border-radius: 4px;
                font-family: Arial, sans-serif;
                box-sizing: border-box;
                font-size: 12px;
            }

            #${MODAL_ID} input:focus,
            #${MODAL_ID} select:focus {
                outline: none;
                border-color: #0066cc;
                box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
            }

            #${MODAL_ID} .tyler-modal-footer {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
                padding: 16px 18px;
                border-top: 1px solid #e0e0e0;
                background: #f8f9fa;
            }

            #${MODAL_ID} .tyler-btn-primary {
                background: #007bff;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 600;
                transition: background 0.2s;
            }

            #${MODAL_ID} .tyler-btn-primary:hover {
                background: #0056b3;
            }

            #${MODAL_ID} .tyler-btn-secondary {
                background: #ffffff;
                color: #111111;
                border: 1px solid #d0d0d0;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 600;
                transition: background 0.2s;
            }

            #${MODAL_ID} .tyler-btn-secondary:hover {
                background: #f0f0f0;
            }

            .tyler-icon-picker-group {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .tyler-icon-option {
                width: 35px;
                height: 35px;
                border-radius: 4px;
                border: 2px solid #d0d0d0;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                transition: all 0.2s;
                background: #ffffff;
            }

            .tyler-icon-option:hover {
                border-color: #0066cc;
                background: #f0f7ff;
            }

            .tyler-icon-option.selected {
                border-color: #0066cc;
                background: #0066cc;
            }

            #${FLOATING_BTN_ID} {
                position: fixed;
                bottom: 30px;
                right: 30px;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: #007bff;
                color: white;
                border: none;
                cursor: pointer;
                font-size: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 12px rgba(0, 123, 255, 0.4);
                transition: all 0.3s;
                z-index: 1000;
                font-weight: bold;
            }

            #${FLOATING_BTN_ID}:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 16px rgba(0, 123, 255, 0.6);
            }

            #${FLOATING_BTN_ID}:active {
                transform: scale(0.95);
            }

        `;

        document.head.appendChild(style);
    }

    function loadShortcuts() {
        try {
            const stored = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
            return stored ? JSON.parse(stored) : DEFAULT_SHORTCUTS;
        } catch {
            return DEFAULT_SHORTCUTS;
        }
    }

    function saveShortcuts(shortcuts) {
        localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts));
    }

    function createShortcutsContainer() {
        const container = document.createElement("div");
        container.id = CONTAINER_ID;

        const shortcuts = loadShortcuts();
        shortcuts.forEach((shortcut, index) => {
            const link = document.createElement("button");
            link.type = "button";
            link.className = "tyler-shortcut";
            link.style.backgroundColor = shortcut.color;
            link.dataset.id = shortcut.id;
            link.innerHTML = `<span class="tyler-shortcut-icon">${shortcut.icon}</span><span>${shortcut.name}</span>`;

            link.addEventListener("click", (e) => {
                e.preventDefault();
                navigateToShortcut(shortcut);
            });

            container.appendChild(link);
        });

        const settingsBtn = document.createElement("button");
        settingsBtn.className = "tyler-shortcut-settings";
        settingsBtn.textContent = "⚙️ Manage Shortcuts";
        settingsBtn.addEventListener("click", openShortcutsModal);

        container.appendChild(settingsBtn);

        return container;
    }

    function navigateToShortcut(shortcut) {
        // Store the saved view info for loading after navigation
        if (shortcut.viewName) {
            const viewInfo = {
                viewName: shortcut.viewName,
                model: shortcut.model || "sale.order" // Default to sale.order
            };
            window.localStorage.setItem("tyler-auto-select-view", JSON.stringify(viewInfo));
        }

        // Navigate to the URL
        window.location.href = shortcut.url;
    }

    function detectCurrentViewName() {
        // Try to find the currently selected saved view from the Favorites menu
        // Look for menu items that have aria-checked="true"

        const menuItems = document.querySelectorAll("[role='menuitemcheckbox']");

        for (const item of menuItems) {
            // Check if this item is marked as checked/selected
            if (item.getAttribute("aria-checked") === "true") {
                const textSpan = item.querySelector(".text-truncate.flex-grow-1");
                if (textSpan) {
                    const text = textSpan.textContent.trim();
                    // Skip filter/group items, only return actual saved view names
                    // (usually saved views have multiple words or specific patterns)
                    if (text && text.length > 0) {
                        return text;
                    }
                }
            }
        }

        return "";
    }

    function detectCurrentModel() {
        // Try to detect the model from the current URL
        const url = window.location.pathname.toLowerCase();

        // CRM - check this FIRST because it's shorter and could match other modules
        if (url.includes("/crm") || url.includes("crm.lead") || url.includes("/lead")) {
            return "crm.lead";
        }
        // Projects
        else if (url.includes("/project") || url.includes("project.task")) {
            return "project.task";
        }
        // Sales
        else if (url.includes("/sales") || url.includes("sale.order") || url.includes("/quotation")) {
            return "sale.order";
        }
        // Purchase
        else if (url.includes("/purchase") || url.includes("purchase.order")) {
            return "purchase.order";
        }
        // Inventory/Stock
        else if (url.includes("/stock") || url.includes("stock.picking")) {
            return "stock.picking";
        }
        // Contacts/Partners
        else if (url.includes("/contacts") || url.includes("/partner") || url.includes("res.partner")) {
            return "res.partner";
        }
        // Accounting/Invoices
        else if (url.includes("/account") || url.includes("account.move")) {
            return "account.move";
        }
        // HR/Employees
        else if (url.includes("/hr") || url.includes("hr.employee")) {
            return "hr.employee";
        }
        // Manufacturing
        else if (url.includes("/mrp") || url.includes("mrp.production")) {
            return "mrp.production";
        }

        return "sale.order"; // default fallback
    }


    function renderShortcutsContainer() {
        const existing = document.getElementById(CONTAINER_ID);
        if (existing) existing.remove();

        const container = createShortcutsContainer();
        const navbar = document.querySelector(".o_navbar");

        if (navbar) {
            navbar.insertAdjacentElement("afterend", container);
        } else {
            document.body.insertAdjacentElement("afterbegin", container);
        }
    }

    function openShortcutsModal() {
        const overlay = document.getElementById(OVERLAY_ID) || createModalOverlay();
        const modal = document.getElementById(MODAL_ID) || createShortcutsModal();

        // Force clear and reset all form fields to clean state
        const nameInput = modal.querySelector("#tyler-shortcut-name");
        const urlInput = modal.querySelector("#tyler-shortcut-url");
        const viewNameInput = modal.querySelector("#tyler-shortcut-view-name");
        const modelInput = modal.querySelector("#tyler-shortcut-model");

        if (nameInput) nameInput.value = "";
        if (urlInput) urlInput.value = "";
        if (viewNameInput) viewNameInput.value = "";

        // Auto-detect and set model from current URL
        if (modelInput) {
            const detectedModel = detectCurrentModel();
            modelInput.value = detectedModel;
            console.log("CRM Modal opened - Detected model:", detectedModel, "URL:", window.location.pathname);
        }

        overlay.style.display = "block";
        modal.style.display = "block";

        renderShortcutsList();
    }

    function closeShortcutsModal() {
        const overlay = document.getElementById(OVERLAY_ID);
        const modal = document.getElementById(MODAL_ID);

        if (overlay) overlay.style.display = "none";
        if (modal) modal.style.display = "none";
    }

    function createModalOverlay() {
        const overlay = document.createElement("div");
        overlay.id = OVERLAY_ID;

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeShortcutsModal();
        });

        document.body.appendChild(overlay);
        return overlay;
    }

    function createShortcutsModal() {
        const modal = document.createElement("div");
        modal.id = MODAL_ID;

        const header = document.createElement("div");
        header.className = "tyler-modal-header";

        const title = document.createElement("div");
        title.className = "tyler-modal-title";
        title.textContent = "Manage Shortcuts";

        const closeBtn = document.createElement("button");
        closeBtn.className = "tyler-modal-close";
        closeBtn.type = "button";
        closeBtn.textContent = "×";
        closeBtn.addEventListener("click", closeShortcutsModal);

        header.appendChild(title);
        header.appendChild(closeBtn);

        const body = document.createElement("div");
        body.className = "tyler-modal-body";

        // Add shortcut form
        const addForm = document.createElement("div");
        addForm.className = "tyler-add-shortcut-form";
        addForm.innerHTML = `
            <h3 style="margin-top: 0; color: #111111; font-size: 14px;">Add New Shortcut</h3>
            <div class="tyler-form-row">
                <div class="tyler-form-group">
                    <label>Name</label>
                    <input type="text" id="tyler-shortcut-name" placeholder="e.g., My Sales">
                </div>
                <div class="tyler-form-group">
                    <label>URL</label>
                    <input type="text" id="tyler-shortcut-url" placeholder="e.g., /odoo/sales/order">
                </div>
                <div class="tyler-form-group" style="flex: 0 1 auto; min-width: auto; display: flex; flex-direction: column; justify-content: flex-end;">
                    <button type="button" id="tyler-use-current-url-btn" class="tyler-btn-primary" style="white-space: nowrap;">Use Current Page</button>
                </div>
            </div>
            <div class="tyler-form-row">
                <div class="tyler-form-group">
                    <label>Saved View Name (Optional)</label>
                    <input type="text" id="tyler-shortcut-view-name" placeholder="e.g., 2026 Sales - TS">
                </div>
                <div class="tyler-form-group" style="display: none;">
                    <label>Model (for saved views)</label>
                    <input type="text" id="tyler-shortcut-model" placeholder="e.g., sale.order">
                </div>
            </div>
            <div class="tyler-form-row">
                <div class="tyler-form-group" style="flex: 0.5;">
                    <label>Color</label>
                    <input type="color" id="tyler-color-picker" value="#FFD766" style="width: 100%; height: 40px; border: 1px solid #d0d0d0; border-radius: 4px; cursor: pointer;">
                </div>
                <div class="tyler-form-group" style="flex: 0.5;">
                    <label>HEX</label>
                    <input type="text" id="tyler-hex-input" placeholder="#FFD766" maxlength="7" style="font-family: monospace;">
                </div>
                <div class="tyler-form-group" style="flex: 1;">
                    <label>RGB</label>
                    <input type="text" id="tyler-rgb-input" placeholder="255, 215, 102" style="font-family: monospace;">
                </div>
            </div>
            <div class="tyler-form-row">
                <div class="tyler-form-group">
                    <label>Icon</label>
                    <div class="tyler-icon-picker-group" id="tyler-icon-picker">
                        <div class="tyler-icon-option selected" data-icon="📋">📋</div>
                        <div class="tyler-icon-option" data-icon="📊">📊</div>
                        <div class="tyler-icon-option" data-icon="📈">📈</div>
                        <div class="tyler-icon-option" data-icon="👥">👥</div>
                        <div class="tyler-icon-option" data-icon="💼">💼</div>
                        <div class="tyler-icon-option" data-icon="📝">📝</div>
                        <div class="tyler-icon-option" data-icon="🎯">🎯</div>
                        <div class="tyler-icon-option" data-icon="⭐">⭐</div>
                        <div class="tyler-icon-option" data-icon="🚀">🚀</div>
                        <div class="tyler-icon-option" data-icon="📦">📦</div>
                    </div>
                </div>
            </div>
            <button class="tyler-btn-primary" id="tyler-add-shortcut-btn">Add Shortcut</button>
        `;

        body.appendChild(addForm);

        // Shortcuts list
        const listContainer = document.createElement("div");
        listContainer.className = "tyler-shortcuts-list";
        body.appendChild(listContainer);

        const footer = document.createElement("div");
        footer.className = "tyler-modal-footer";

        const closeFooterBtn = document.createElement("button");
        closeFooterBtn.className = "tyler-btn-secondary";
        closeFooterBtn.type = "button";
        closeFooterBtn.textContent = "Close";
        closeFooterBtn.addEventListener("click", closeShortcutsModal);

        footer.appendChild(closeFooterBtn);

        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);

        document.body.appendChild(modal);

        // Setup color picker
        setupColorPicker();

        // Setup icon picker
        setupIconPicker();

        // Setup add button
        document.getElementById("tyler-add-shortcut-btn").addEventListener("click", addNewShortcut);

        // Setup use current URL button
        document.getElementById("tyler-use-current-url-btn").addEventListener("click", useCurrentPageUrl);

        return modal;
    }

    function setupColorPicker() {
        const colorInput = document.getElementById("tyler-color-picker");
        const hexInput = document.getElementById("tyler-hex-input");
        const rgbInput = document.getElementById("tyler-rgb-input");

        // Initialize
        window.tylerSelectedColor = "#FFD766";
        hexInput.value = "#FFD766";
        rgbInput.value = "255, 215, 102";

        // Color input change
        colorInput.addEventListener("change", (e) => {
            const hex = e.target.value;
            window.tylerSelectedColor = hex;
            hexInput.value = hex;
            rgbInput.value = hexToRgb(hex);
        });

        // HEX input change
        hexInput.addEventListener("input", (e) => {
            let hex = e.target.value;
            if (!hex.startsWith("#")) hex = "#" + hex;
            if (/^#[0-9A-F]{6}$/i.test(hex)) {
                colorInput.value = hex;
                window.tylerSelectedColor = hex;
                rgbInput.value = hexToRgb(hex);
            }
        });

        // RGB input change
        rgbInput.addEventListener("input", (e) => {
            const rgb = e.target.value;
            const hex = rgbToHex(rgb);
            if (hex) {
                colorInput.value = hex;
                hexInput.value = hex;
                window.tylerSelectedColor = hex;
            }
        });
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return parseInt(result[1], 16) + ", " + parseInt(result[2], 16) + ", " + parseInt(result[3], 16);
        }
        return "";
    }

    function rgbToHex(rgb) {
        const parts = rgb.replace(/\s/g, "").split(",");
        if (parts.length !== 3) return null;
        const r = parseInt(parts[0]);
        const g = parseInt(parts[1]);
        const b = parseInt(parts[2]);
        if (isNaN(r) || isNaN(g) || isNaN(b) || r > 255 || g > 255 || b > 255) return null;
        return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase();
    }

    function setupIconPicker() {
        let selectedIcon = "📋";

        document.querySelectorAll(".tyler-icon-option").forEach(option => {
            option.addEventListener("click", () => {
                document.querySelectorAll(".tyler-icon-option").forEach(o => o.classList.remove("selected"));
                option.classList.add("selected");
                selectedIcon = option.dataset.icon;
                window.tylerSelectedIcon = selectedIcon;
            });
        });

        window.tylerSelectedIcon = selectedIcon;
    }

    function addNewShortcut() {
        const nameInput = document.getElementById("tyler-shortcut-name");
        const urlInput = document.getElementById("tyler-shortcut-url");
        const viewNameInput = document.getElementById("tyler-shortcut-view-name");
        const modelInput = document.getElementById("tyler-shortcut-model");
        const addBtn = document.getElementById("tyler-add-shortcut-btn");

        const name = nameInput.value.trim();
        const url = urlInput.value.trim();
        const viewName = viewNameInput.value.trim();
        const model = modelInput.value.trim() || "sale.order";
        const color = window.tylerSelectedColor || "#FFD766";
        const icon = window.tylerSelectedIcon || "📋";

        if (!name || !url) {
            alert("Please fill in name and URL");
            return;
        }

        // Check if editing existing shortcut
        if (addBtn.dataset.editing === "true") {
            const editingId = parseInt(addBtn.dataset.editingId);
            const shortcuts = loadShortcuts();
            const index = shortcuts.findIndex(s => s.id === editingId);

            if (index !== -1) {
                shortcuts[index] = {
                    id: editingId,
                    name: name,
                    url: url,
                    viewName: viewName,
                    model: model,
                    color: color,
                    icon: icon
                };
                saveShortcuts(shortcuts);
            }

            // Reset form
            resetShortcutForm();
        } else {
            // Adding new shortcut
            const shortcuts = loadShortcuts();
            const newId = Math.max(...shortcuts.map(s => s.id), 0) + 1;

            shortcuts.push({
                id: newId,
                name: name,
                url: url,
                viewName: viewName,
                model: model,
                color: color,
                icon: icon
            });

            saveShortcuts(shortcuts);
            resetShortcutForm();
        }

        renderShortcutsList();
        renderShortcutsContainer();
    }

    function openEditShortcutForm(shortcut) {
        const nameInput = document.getElementById("tyler-shortcut-name");
        const urlInput = document.getElementById("tyler-shortcut-url");
        const viewNameInput = document.getElementById("tyler-shortcut-view-name");
        const modelInput = document.getElementById("tyler-shortcut-model");
        const addBtn = document.getElementById("tyler-add-shortcut-btn");

        // Fill form with shortcut data
        nameInput.value = shortcut.name;
        urlInput.value = shortcut.url;
        viewNameInput.value = shortcut.viewName || "";
        modelInput.value = shortcut.model || "sale.order";

        // Set color and icon
        window.tylerSelectedColor = shortcut.color;
        window.tylerSelectedIcon = shortcut.icon;

        // Update color selection
        document.querySelectorAll(".tyler-color-option").forEach(option => {
            option.classList.remove("selected");
            if (option.dataset.color === shortcut.color) {
                option.classList.add("selected");
            }
        });

        // Update icon selection
        document.querySelectorAll(".tyler-icon-option").forEach(option => {
            option.classList.remove("selected");
            if (option.dataset.icon === shortcut.icon) {
                option.classList.add("selected");
            }
        });

        // Change button to "Save Changes"
        addBtn.textContent = "Save Changes";
        addBtn.dataset.editing = "true";
        addBtn.dataset.editingId = shortcut.id;

        // Scroll to form
        const addForm = document.querySelector(".tyler-add-shortcut-form");
        if (addForm) {
            addForm.scrollIntoView({ behavior: "smooth" });
        }
    }

    function resetShortcutForm() {
        const nameInput = document.getElementById("tyler-shortcut-name");
        const urlInput = document.getElementById("tyler-shortcut-url");
        const viewNameInput = document.getElementById("tyler-shortcut-view-name");
        const modelInput = document.getElementById("tyler-shortcut-model");
        const addBtn = document.getElementById("tyler-add-shortcut-btn");

        nameInput.value = "";
        urlInput.value = "";
        viewNameInput.value = "";
        modelInput.value = detectCurrentModel(); // Auto-detect instead of hardcoding
        addBtn.textContent = "Add Shortcut";
        addBtn.removeAttribute("data-editing");
        addBtn.removeAttribute("data-editingId");
    }

    function deleteShortcut(id) {
        if (!confirm("Delete this shortcut?")) return;

        let shortcuts = loadShortcuts();
        shortcuts = shortcuts.filter(s => s.id !== id);

        saveShortcuts(shortcuts);

        renderShortcutsList();
        renderShortcutsContainer();
    }

    function renderShortcutsList() {
        const listContainer = document.querySelector(".tyler-shortcuts-list");
        if (!listContainer) return;

        listContainer.innerHTML = "";

        const shortcuts = loadShortcuts();

        if (shortcuts.length === 0) {
            listContainer.innerHTML = '<p style="color: #666666; text-align: center; padding: 20px;">No shortcuts yet. Add one above!</p>';
            return;
        }

        shortcuts.forEach((shortcut, index) => {
            const item = document.createElement("div");
            item.className = "tyler-shortcut-item";
            item.dataset.id = shortcut.id;
            item.dataset.index = index;

            item.innerHTML = `
                <div class="tyler-shortcut-preview" style="background-color: ${shortcut.color};">${shortcut.icon}</div>
                <div class="tyler-shortcut-details">
                    <div class="tyler-shortcut-name">${shortcut.name}</div>
                    <div class="tyler-shortcut-url">${shortcut.url}</div>
                </div>
                <div class="tyler-shortcut-actions">
                    <button class="tyler-btn-small tyler-btn-arrow" data-id="${shortcut.id}" data-action="up" ${index === 0 ? "disabled" : ""}>↑ Up</button>
                    <button class="tyler-btn-small tyler-btn-arrow" data-id="${shortcut.id}" data-action="down" ${index === shortcuts.length - 1 ? "disabled" : ""}>Down ↓</button>
                    <button class="tyler-btn-small tyler-btn-edit" data-id="${shortcut.id}">Edit</button>
                    <button class="tyler-btn-small tyler-btn-delete" data-id="${shortcut.id}">Delete</button>
                </div>
            `;

            const upBtn = item.querySelector('[data-action="up"]');
            const downBtn = item.querySelector('[data-action="down"]');
            const editBtn = item.querySelector(".tyler-btn-edit");
            const deleteBtn = item.querySelector(".tyler-btn-delete");

            upBtn.addEventListener("click", () => moveShortcutUp(shortcut.id));
            downBtn.addEventListener("click", () => moveShortcutDown(shortcut.id));
            editBtn.addEventListener("click", () => openEditShortcutForm(shortcut));
            deleteBtn.addEventListener("click", () => deleteShortcut(shortcut.id));

            listContainer.appendChild(item);
        });
    }

    function moveShortcutUp(id) {
        const shortcuts = loadShortcuts();
        const index = shortcuts.findIndex(s => s.id === id);

        if (index > 0) {
            [shortcuts[index], shortcuts[index - 1]] = [shortcuts[index - 1], shortcuts[index]];
            saveShortcuts(shortcuts);
            renderShortcutsList();
            renderShortcutsContainer();
        }
    }

    function moveShortcutDown(id) {
        const shortcuts = loadShortcuts();
        const index = shortcuts.findIndex(s => s.id === id);

        if (index < shortcuts.length - 1) {
            [shortcuts[index], shortcuts[index + 1]] = [shortcuts[index + 1], shortcuts[index]];
            saveShortcuts(shortcuts);
            renderShortcutsList();
            renderShortcutsContainer();
        }
    }

    function useCurrentPageUrl() {
        const currentPath = window.location.pathname;
        const currentSearch = window.location.search;
        const fullPath = currentPath + currentSearch;

        const urlInput = document.getElementById("tyler-shortcut-url");
        if (urlInput) {
            urlInput.value = fullPath;
            urlInput.focus();

            // Visual feedback
            urlInput.style.backgroundColor = "#e7f3ff";
            setTimeout(() => {
                urlInput.style.backgroundColor = "";
            }, 1000);
        }
    }

    function createFloatingButton() {
        // Don't show on main dashboard
        const isMainPage = window.location.pathname === "/odoo" ||
                          window.location.pathname === "/odoo/";
        if (isMainPage) return;

        // Check if button already exists
        if (document.getElementById(FLOATING_BTN_ID)) {
            return;
        }

        const btn = document.createElement("button");
        btn.id = FLOATING_BTN_ID;
        btn.type = "button";
        btn.title = "Create Shortcut for This View";
        btn.innerHTML = "⭐";

        btn.addEventListener("click", (e) => {
            console.log("⭐ button clicked");
            e.stopPropagation();
            openShortcutsModalWithCurrentUrl();
        });

        document.body.appendChild(btn);
    }

    function openShortcutsModalWithCurrentUrl() {
        const overlay = document.getElementById(OVERLAY_ID) || createModalOverlay();
        const modal = document.getElementById(MODAL_ID) || createShortcutsModal();

        // Set modal title
        const title = modal.querySelector(".tyler-modal-title");
        if (title) {
            title.textContent = "Create Shortcut";
        }

        // Auto-fill URL with current page (without query params)
        const urlInput = modal.querySelector("#tyler-shortcut-url");
        const nameInput = modal.querySelector("#tyler-shortcut-name");
        const viewNameInput = modal.querySelector("#tyler-shortcut-view-name");
        const modelInput = modal.querySelector("#tyler-shortcut-model");

        if (urlInput) {
            const currentPath = window.location.pathname;
            urlInput.value = currentPath;
        }

        // Auto-detect and fill the model
        if (modelInput) {
            const detectedModel = detectCurrentModel();
            console.log("Detected model:", detectedModel);
            modelInput.value = detectedModel;
        } else {
            console.log("Model input not found");
        }

        // Auto-detect and fill the saved view name
        if (viewNameInput) {
            const detectedViewName = detectCurrentViewName();
            console.log("Detected view name:", detectedViewName);
            if (detectedViewName) {
                viewNameInput.value = detectedViewName;
            }
        } else {
            console.log("View name input not found");
        }

        // Auto-fill shortcut name from saved view name or page title
        if (nameInput && !nameInput.value) {
            const detectedViewName = detectCurrentViewName();
            let suggestedName = detectedViewName || document.title.split(" ")[0] || "View";
            console.log("Suggested name:", suggestedName);
            nameInput.value = suggestedName;
            nameInput.select();
        }

        overlay.style.display = "block";
        modal.style.display = "block";

        renderShortcutsList();
    }

    function autoSelectSavedView() {
        const viewInfoStr = window.localStorage.getItem("tyler-auto-select-view");
        if (!viewInfoStr) return;

        // Clear the stored value
        window.localStorage.removeItem("tyler-auto-select-view");

        let viewInfo;
        try {
            viewInfo = JSON.parse(viewInfoStr);
        } catch {
            return;
        }

        // Wait for page to load, then query for the filter and apply it
        setTimeout(() => {
            loadSavedViewViaAPI(viewInfo.viewName, viewInfo.model);
        }, 1000);
    }

    function loadSavedViewViaAPI(viewName, modelName) {
        // Query Odoo's API to find the filter by name
        const filterQuery = {
            jsonrpc: '2.0',
            method: 'call',
            id: Math.random(),
            params: {
                model: 'ir.filters',
                method: 'search_read',
                args: [],
                kwargs: {
                    domain: [
                        ['name', '=', viewName],
                        ['model_id', '=', modelName]
                    ],
                    fields: ['id', 'name', 'domain', 'context']
                }
            }
        };

        fetch('/web/dataset/call_kw/ir.filters/search_read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filterQuery)
        })
        .then(r => r.json())
        .then(data => {
            if (data.result && data.result.length > 0) {
                const filter = data.result[0];
                console.log(`Found filter ID ${filter.id} for "${viewName}", clicking it`);

                // Now click the saved view in the menu
                setTimeout(() => {
                    clickSavedViewInMenu(viewName);
                }, 300);
            } else {
                console.log(`Filter "${viewName}" not found in database`);
            }
        })
        .catch(err => {
            console.error("Error querying filter:", err);
        });
    }

    function clickSavedViewInMenu(viewName) {
        // Click the search input to open the menu first
        const searchInput = document.querySelector(".o_searchview_input, input[placeholder*='Search'], .o_search_bar input");

        if (searchInput) {
            searchInput.focus();
            searchInput.click();

            // Wait for menu to appear, then click the favorite
            setTimeout(() => {
                const menuItems = document.querySelectorAll("[role='menuitemcheckbox']");
                let found = false;

                for (const item of menuItems) {
                    const itemText = item.textContent.trim();

                    if (itemText === viewName) {
                        console.log(`Found menu item "${viewName}", clicking it`);
                        item.click();
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    console.log(`Menu item "${viewName}" not found`);
                }
            }, 500);
        }
    }

    function initialize() {
        injectStyles();
        renderShortcutsContainer();
        autoSelectSavedView();

        // Check if we're on the main Odoo dashboard
        const isMainPage = window.location.pathname === "/odoo" ||
                          window.location.pathname === "/odoo/";

        if (!isMainPage) {
            // Add floating button on non-dashboard pages
            createFloatingButton();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize);
    } else {
        initialize();
    }
})();
