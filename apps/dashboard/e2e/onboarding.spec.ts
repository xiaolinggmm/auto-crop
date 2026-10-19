import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1440, height: 1100 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  for (const language of ["en", "zh"] as const) {
    test(`story and form ${viewport.width}px ${language}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      const mutations: string[] = [];
      await page.route("**/api/**", (route) => {
        const request = route.request();
        if (request.method() !== "GET") mutations.push(request.url());
        return route.fulfill({ json: { companies: [] } });
      });
      await page.clock.install();
      await page.goto(`/?lang=${language}`);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const chapters = dialog.getByRole("navigation").getByRole("button");
      for (let scene = 0; scene < 4; scene++) {
        await chapters.nth(scene).click();
        await dialog.evaluate((element) => {
          element.scrollTop = 0;
        });
        await page.screenshot({
          path: testInfo.outputPath(`scene-${scene + 1}-start.png`),
        });
        await page.clock.runFor(12000);
        await expect(
          dialog.getByRole("button", {
            name: language === "zh" ? "暂停" : "Pause",
            exact: true,
          }),
        ).toHaveCount(0);
        expect(
          await page
            .locator(".story-stage")
            .evaluate((el) => el.scrollHeight <= el.clientHeight),
        ).toBe(true);
        expect(
          await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
        await dialog.evaluate((element) => {
          element.scrollTop = 0;
        });
        await page.screenshot({
          path: testInfo.outputPath(`scene-${scene + 1}-end.png`),
        });
      }
      await dialog
        .getByRole("button", {
          name: language === "zh" ? "创建我的公司" : "Create my company",
          exact: true,
        })
        .click();
      const name = dialog.getByLabel(
        language === "zh" ? "公司名称" : "Company name",
        { exact: true },
      );
      const vision = dialog.getByLabel(
        language === "zh" ? "公司愿景" : "Founder vision",
        { exact: true },
      );
      await expect(name).toHaveValue("");
      await expect(vision).toHaveValue("");
      await name.fill("Independent studio");
      await vision.fill(
        "Find a useful problem and validate it before building. ".repeat(8),
      );
      await dialog
        .getByRole("button", {
          name: language === "zh" ? "回看演示" : "Watch the demo",
        })
        .click();
      await dialog
        .getByRole("button", {
          name: language === "zh" ? "直接创建" : "Create directly",
        })
        .click();
      await expect(name).toHaveValue("Independent studio");
      await page.reload();
      await expect(name).toHaveValue("Independent studio");
      await expect(vision).toHaveValue(/Find a useful problem/);
      await expect(
        dialog.getByRole("button", {
          name: language === "zh" ? "生成团队与计划" : "Generate team and plan",
        }),
      ).toBeDisabled();
      await page.keyboard.press("ControlOrMeta+Enter");
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press("Tab");
        expect(
          await dialog.evaluate((el) => el.contains(document.activeElement)),
        ).toBe(true);
      }
      await dialog.evaluate((el) => {
        el.scrollTop = 0;
      });
      await page.screenshot({ path: testInfo.outputPath("form.png") });
      expect(mutations).toEqual([]);
    });
  }
}

test("reduced motion keeps the complete story readable without playing", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", (route) =>
    route.fulfill({ json: { companies: [] } }),
  );
  await page.goto("/");
  await expect(page.getByText("14 tasks planned by CEO", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "3 · Progress" }).click();
  await expect(page.getByRole("region", { name: "CEO inbox" })).toBeVisible();
});
