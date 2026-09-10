import settingsPage from "components/settingsPage";
import appSettings from "lib/settings";
import helpers from "utils/helpers";

export default function filesSettings() {
	const title = strings.settings;
	const values = appSettings.value.fileBrowser;

	const items = [
		{
			key: "sortBy",
			text: strings["sort by"],
			value: helpers.resolveSortBy(values),
			valueText: getSortByText,
			select: [
				["name", strings["sort by name"]],
				["modified", strings["last modified"]],
				["size", strings.size],
				["none", strings.none],
			],
		},
		{
			key: "showHiddenFiles",
			text: strings["show hidden files"],
			checkbox: values.showHiddenFiles,
			info: strings["info-showHiddenFiles"],
		},
		{
			key: "listFiles",
			text: strings["title-listfiles"],
			checkbox: values.listFiles !== false,
			info:
				strings["info-listFiles"] ||
				"List all files in opened folders for quick search",
		},
	];

	return settingsPage(title, items, callback, undefined, {
		preserveOrder: true,
		pageClassName: "detail-settings-page",
		listClassName: "detail-settings-list",
		groupByDefault: true,
	});

	function callback(key, value) {
		appSettings.value.fileBrowser[key] = value;
		appSettings.update();
	}
}

/**
 * Shows the sort mode of the file browser in a readable form
 * @param {'name'|'modified'|'size'|'none'} value
 * @returns {string}
 */
function getSortByText(value) {
	switch (helpers.resolveSortBy({ sortBy: value })) {
		case "modified":
			return strings["last modified"];
		case "size":
			return strings.size;
		case "none":
			return strings.none;
		default:
			return strings["sort by name"];
	}
}
