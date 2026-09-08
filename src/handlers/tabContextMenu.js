import Contextmenu from "components/contextmenu";

const EDGE_MARGIN = 8;
const MENU_WIDTH_ESTIMATE = 240;
const MENU_ITEM_HEIGHT = 50;
const MENU_ITEM_COUNT = 4;
const MENU_HEIGHT_ESTIMATE = MENU_ITEM_COUNT * MENU_ITEM_HEIGHT;
const GAP = 4;
const SYNTHETIC_CLICK_WINDOW = 700;

/**
 * Open the context menu for a file tab.
 *
 * Actions are executed through `acode.exec`, so they use the same commands
 * and prompts as the rest of the app:
 *  - close-tab           close the pressed tab
 *  - close-tabs-in-group close all tabs in the same tab group/pane
 *  - close-tabs-to-left  close tabs left of the pressed tab
 *  - close-tabs-to-right close tabs right of the pressed tab
 *
 * @param {object} file The `EditorFile` whose tab was long pressed / right clicked
 * @returns {HTMLElement|undefined} The context menu element, if it was shown.
 */
export default function openTabContextMenu(file) {
	if (!file || !file.tab || !file.tab.isConnected) return;

	const menu = Contextmenu({
		...positionMenu(file.tab),
		innerHTML: getMenuItemsHtml,
	});

	const guardUntil = Date.now() + SYNTHETIC_CLICK_WINDOW;

	/**
	 * Touch gestures that open a context menu can be followed by a synthetic
	 * click (detail === 0). Ignore those so releasing the finger does not
	 * accidentally activate a menu item underneath it.
	 * @param {MouseEvent} event
	 */
	const suppressSyntheticClick = (event) => {
		if (Date.now() > guardUntil) return;
		if (event.detail !== 0) return;
		if (!menu.contains(event.target)) return;
		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation?.();
	};

	const removeSuppressor = () => {
		document.removeEventListener("click", suppressSyntheticClick, true);
	};

	document.addEventListener("click", suppressSyntheticClick, true);
	menu.onhide = removeSuppressor;

	menu.addEventListener("click", (event) => {
		if (event.detail === 0) return; // synthetic click, ignore
		const $target = event.target;
		const action = $target?.getAttribute?.("action");
		if (!action) return;
		menu.hide();
		removeSuppressor();
		acode.exec(action, file.id);
	});

	menu.show();
	return menu;
}

/**
 * Show the tab context menu after the ongoing long press / right click ends.
 *
 * Used in layouts where a long press does not start a tab drag (sidebar open
 * file list). Opening while the finger is still down would let the release
 * hit the menu, so the menu is opened when the pointer is lifted instead.
 *
 * @param {object} file The `EditorFile` whose tab was long pressed / right clicked
 * @param {MouseEvent} event The contextmenu event
 */
export function openTabContextMenuOnRelease(file, event) {
	if (!file || !file.tab || !file.tab.isConnected) return;
	event.preventDefault?.();
	event.stopPropagation?.();

	let opened = false;
	let cancelled = false;

	const open = () => {
		if (opened || cancelled) return;
		opened = true;
		cleanup();
		openTabContextMenu(file);
	};

	const onPointerMove = () => {
		// Moving after the long press means the user intends to scroll or drag,
		// not to open a menu.
		cancelled = true;
		cleanup();
	};

	const onCancel = () => {
		cancelled = true;
		cleanup();
	};

	function cleanup() {
		document.removeEventListener("touchmove", onPointerMove, true);
		document.removeEventListener("touchend", open, true);
		document.removeEventListener("touchcancel", onCancel, true);
		document.removeEventListener("mouseup", open, true);
		document.removeEventListener("mouseleave", onCancel, true);
	}

	document.addEventListener("touchmove", onPointerMove, true);
	document.addEventListener("touchend", open, true);
	document.addEventListener("touchcancel", onCancel, true);
	document.addEventListener("mouseup", open, true);
	document.addEventListener("mouseleave", onCancel, true);
}

function getMenuItemsHtml() {
	const closeText = strings["close file"] || "Close file";
	const closeAllText = strings["close all"] || "Close all";
	const closeLeftText = strings["close tabs to left"] || "Close Left";
	const closeRightText = strings["close tabs to right"] || "Close Right";
	return `
		<li action="close-tab">${closeText}</li>
		<li action="close-tabs-in-group">${closeAllText}</li>
		<li action="close-tabs-to-left">${closeLeftText}</li>
		<li action="close-tabs-to-right">${closeRightText}</li>
	`;
}

/**
 * Position the menu next to the tab, flipping when there is not enough room.
 * @param {HTMLElement} $tab
 * @returns {object}
 */
function positionMenu($tab) {
	const rect = $tab.getBoundingClientRect();
	const style = {};

	if (rect.left + MENU_WIDTH_ESTIMATE <= innerWidth - EDGE_MARGIN) {
		style.left = `${Math.max(EDGE_MARGIN, rect.left)}px`;
	} else {
		style.right = `${Math.max(EDGE_MARGIN, innerWidth - rect.right)}px`;
	}

	if (rect.bottom + MENU_HEIGHT_ESTIMATE <= innerHeight - EDGE_MARGIN) {
		style.top = `${rect.bottom + GAP}px`;
		style.transformOrigin = "top center";
	} else {
		style.bottom = `${Math.max(EDGE_MARGIN, innerHeight - rect.top + GAP)}px`;
		style.transformOrigin = "bottom center";
	}

	return style;
}
