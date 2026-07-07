import { expect, test } from "@playwright/test";

const BASE_URL =
	process.env.E2E_BASE_URL || process.env.BASE_URL || "http://localhost:8080";

test.describe("WebUI - Analytics Chart Themes", () => {
	test("analytics chart canvas is visible in default (dark) theme", async ({
		page,
	}) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("load");

		await page.click('#sidebar nav a[data-page="analytics"]');
		await page.waitForTimeout(1000);

		const canvas = page.locator("#token-chart");
		await expect(canvas).toBeVisible();

		const dims = await page.evaluate(() => {
			const c = document.getElementById("token-chart") as HTMLCanvasElement;
			if (!c) return { w: 0, h: 0 };
			return { w: c.width, h: c.height };
		});
		expect(dims.w).toBeGreaterThan(0);
		expect(dims.h).toBeGreaterThan(0);
	});

	test("analytics chart canvas is visible in light theme", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("load");

		await page.evaluate(() => {
			localStorage.setItem("theme", "Light");
		});
		await page.reload();
		await page.waitForLoadState("load");

		await page.click('#sidebar nav a[data-page="analytics"]');
		await page.waitForTimeout(1000);

		const canvas = page.locator("#token-chart");
		await expect(canvas).toBeVisible();

		const dims = await page.evaluate(() => {
			const c = document.getElementById("token-chart") as HTMLCanvasElement;
			if (!c) return { w: 0, h: 0 };
			return { w: c.width, h: c.height };
		});
		expect(dims.w).toBeGreaterThan(0);
		expect(dims.h).toBeGreaterThan(0);
	});

	test("chart legend shows theme-aware colors via inline styles", async ({
		page,
	}) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("load");

		await page.evaluate(() => {
			localStorage.setItem("theme", "Light");
		});
		await page.reload();
		await page.waitForLoadState("load");

		await page.click('#sidebar nav a[data-page="analytics"]');
		await page.waitForTimeout(1000);

		const legendColors = await page.evaluate(() => {
			const legend = document.getElementById("chart-legend");
			if (!legend) return null;
			const spans = legend.querySelectorAll("span");
			const colors: string[] = [];
			spans.forEach((s) => {
				const inner = s.querySelector("span");
				if (inner) {
					const bg = inner.style.background;
					if (bg) colors.push(bg);
				}
			});
			return colors;
		});

		expect(legendColors).not.toBeNull();
		expect(legendColors!.length).toBeGreaterThanOrEqual(2);
		// Colors can be hex (#0969da) or rgba() — just verify they're valid
		for (const color of legendColors!) {
			const isValid =
				/^#[\da-fA-F]{3,8}$/.test(color) || /^rgba?\(/.test(color);
			expect(isValid).toBeTruthy();
		}
	});

	test("chart renders without JS errors in both themes", async ({ page }) => {
		const errors: string[] = [];
		page.on("pageerror", (error) => errors.push(error.message));

		await page.goto(BASE_URL);
		await page.waitForLoadState("load");

		await page.evaluate(() => {
			localStorage.setItem("theme", "Dark (GitHub)");
		});
		await page.reload();
		await page.waitForLoadState("load");
		await page.click('#sidebar nav a[data-page="analytics"]');
		await page.waitForTimeout(1000);

		await page.evaluate(() => {
			localStorage.setItem("theme", "Light");
		});
		await page.reload();
		await page.waitForLoadState("load");
		await page.click('#sidebar nav a[data-page="analytics"]');
		await page.waitForTimeout(1000);

		const critical = errors.filter(
			(e) =>
				!e.includes("ResizeObserver") &&
				!e.includes("TrustedHTML") &&
				!e.includes("deprecated"),
		);
		expect(critical).toEqual([]);
	});

	test("switching between themes preserves chart rendering", async ({
		page,
	}) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("load");

		await page.evaluate(() => {
			localStorage.setItem("theme", "Dark (GitHub)");
		});
		await page.reload();
		await page.waitForLoadState("load");

		await page.click('#sidebar nav a[data-page="analytics"]');
		await page.waitForTimeout(500);
		await expect(page.locator("#token-chart")).toBeVisible();

		await page.click('#sidebar nav a[data-page="config"]');
		await page.waitForTimeout(500);
		await page.locator('.config-tab[data-config-tab="themes"]').click();
		await page.waitForTimeout(300);
		await page.locator('.theme-btn[data-theme="Light"]').click();
		await page.waitForTimeout(500);

		await page.click('#sidebar nav a[data-page="analytics"]');
		await page.waitForTimeout(1000);
		await expect(page.locator("#token-chart")).toBeVisible();
	});
});
