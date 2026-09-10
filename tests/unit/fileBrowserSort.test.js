import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
	stat: vi.fn(),
}));

vi.mock("fileSystem", () => ({
	default: vi.fn(() => ({
		stat: runtime.stat,
	})),
}));
vi.mock("cm/modelist", () => ({ getModeForPath: vi.fn(() => null) }));
vi.mock("dialogs/alert", () => ({ default: vi.fn() }));
vi.mock("lib/adRewards", () => ({ default: {} }));
vi.mock("lib/config", () => ({ default: {} }));
vi.mock("lib/startAd", () => ({
	interstitialAd: vi.fn(),
	requestBannerForPage: vi.fn(),
}));
vi.mock("utils/binaryExtensions", () => ({ isBinaryFile: vi.fn(() => false) }));
vi.mock("utils/installSource", () => ({ isPlayStoreInstall: vi.fn(() => false) }));

import helpers from "utils/helpers";

/**
 * @param {string} name
 * @param {object} [extra]
 */
function entry(name, extra = {}) {
	const isDirectory = Boolean(extra.isDirectory);
	return {
		name,
		url: `file:///dir/${name}`,
		isDirectory,
		isFile: !isDirectory,
		...extra,
	};
}

const names = (list) => list.map((item) => item.name);

describe("helpers.resolveSortBy", () => {
	it("defaults to name", () => {
		expect(helpers.resolveSortBy({})).toBe("name");
		expect(helpers.resolveSortBy()).toBe("name");
	});

	it("accepts the supported sort modes", () => {
		for (const mode of ["name", "modified", "size", "none"]) {
			expect(helpers.resolveSortBy({ sortBy: mode })).toBe(mode);
		}
	});

	it("falls back to the legacy sortByName flag", () => {
		expect(helpers.resolveSortBy({ sortByName: false })).toBe("none");
		expect(helpers.resolveSortBy({ sortByName: true })).toBe("name");
	});

	it("ignores unknown sort modes", () => {
		expect(helpers.resolveSortBy({ sortBy: "something" })).toBe("name");
		expect(helpers.resolveSortBy({ sortBy: "modified", sortByName: false })).toBe(
			"modified",
		);
	});
});

describe("helpers.sortDir", () => {
	it("always lists directories first and sorts them by name", () => {
		const list = [
			entry("b.txt"),
			entry("zFolder", { isDirectory: true }),
			entry("A.txt"),
			entry("aFolder", { isDirectory: true }),
		];

		const result = helpers.sortDir(list, { sortBy: "name" });

		expect(names(result)).toEqual(["aFolder", "zFolder", "A.txt", "b.txt"]);
	});

	it("keeps entries unsorted when sort mode is none", () => {
		const list = [
			entry("c.txt"),
			entry("a.txt"),
			entry("b.txt"),
			entry("dir", { isDirectory: true }),
		];

		const result = helpers.sortDir(list, { sortByName: false });

		expect(names(result)).toEqual(["dir", "c.txt", "a.txt", "b.txt"]);
	});

	it("sorts by newest first using modified date", () => {
		const list = [
			entry("old.txt", { modifiedDate: 100 }),
			entry("new.txt", { modifiedDate: 300 }),
			entry("mid.txt", { modifiedDate: 200 }),
		];

		const result = helpers.sortDir(list, { sortBy: "modified" });

		expect(names(result)).toEqual(["new.txt", "mid.txt", "old.txt"]);
	});

	it("sorts by size, largest first, and keeps entries without size last", () => {
		const list = [
			entry("small.txt", { size: 10 }),
			entry("big.txt", { size: 5000 }),
			entry("unknown.txt"),
			entry("medium.txt", { size: 200 }),
		];

		const result = helpers.sortDir(list, { sortBy: "size" });

		expect(names(result)).toEqual([
			"big.txt",
			"medium.txt",
			"small.txt",
			"unknown.txt",
		]);
	});

	it("breaks ties by name and honors the size alias length", () => {
		const list = [
			entry("b.txt", { length: 100 }),
			entry("a.txt", { length: 100 }),
			entry("c.txt", { length: 300 }),
		];

		const result = helpers.sortDir(list, { sortBy: "size" });

		expect(names(result)).toEqual(["c.txt", "a.txt", "b.txt"]);
	});

	it("still filters hidden entries", () => {
		const list = [
			entry(".hidden.txt"),
			entry("visible.txt"),
			entry(".hiddenDir", { isDirectory: true }),
		];

		expect(names(helpers.sortDir(list, { sortBy: "name" }))).toEqual([
			"visible.txt",
		]);
		expect(
			names(helpers.sortDir(list, { sortBy: "name", showHiddenFiles: true })),
		).toEqual([".hiddenDir", ".hidden.txt", "visible.txt"]);
	});
});

describe("helpers.loadSortMetadata", () => {
	beforeEach(() => {
		runtime.stat.mockReset();
	});

	it("does not stat entries for name based sorting", async () => {
		const list = [entry("a.txt")];

		await helpers.loadSortMetadata(list, { sortBy: "name" });

		expect(runtime.stat).not.toHaveBeenCalled();
	});

	it("loads size and modified date for entries that miss them", async () => {
		runtime.stat.mockResolvedValue({ size: 42, modifiedDate: 1700000000000 });
		const list = [entry("a.txt")];

		await helpers.loadSortMetadata(list, { sortBy: "size" });

		expect(runtime.stat).toHaveBeenCalledWith();
		expect(list[0].size).toBe(42);
		expect(helpers.getStatMtime(list[0])).toBe(1700000000000);
	});

	it("skips entries that already carry the metadata", async () => {
		const list = [entry("a.txt", { size: 7 })];

		await helpers.loadSortMetadata(list, { sortBy: "size" });

		expect(runtime.stat).not.toHaveBeenCalled();
	});

	it("keeps entries usable when stat fails", async () => {
		runtime.stat.mockRejectedValue(new Error("permission denied"));
		const list = [entry("a.txt"), entry("b.txt", { size: 5 })];

		await expect(
			helpers.loadSortMetadata(list, { sortBy: "size" }),
		).resolves.toBe(list);

		expect(names(helpers.sortDir(list, { sortBy: "size" }))).toEqual([
			"b.txt",
			"a.txt",
		]);
	});
});
