import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppShell, BottomNav, SideNav } from "@/components/nav/Nav";

function currentButton(markup: string): string {
  return markup.match(/<button\b[^>]*aria-current="page"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
}

describe("responsive navigation", () => {
  it("keeps the bottom bar on phones and hides it at the tablet breakpoint", () => {
    const markup = renderToStaticMarkup(<BottomNav active="home" />);

    expect(markup).toContain("md:hidden");
    expect(markup).toContain("aria-label=\"Main navigation\"");
    expect(markup).toContain("safe-b");
    expect(currentButton(markup)).toContain("Home");
    for (const label of ["Home", "Activity", "Budgets", "Goals", "Insights"]) {
      expect(markup).toContain(label);
    }
  });

  it("shows the sidebar at the same breakpoint with touch-friendly destinations", () => {
    const markup = renderToStaticMarkup(<SideNav active="activity" />);

    expect(markup).toContain("hidden w-52");
    expect(markup).toContain("md:flex");
    expect(markup).toContain("lg:w-[228px]");
    expect(markup).toContain("min-h-11");
    expect(markup).toContain("Accounts");
    expect(markup).toContain("Settings");
    expect(currentButton(markup)).toContain("Activity");
  });

  it("highlights the parent section on goal and account detail pages", () => {
    expect(currentButton(renderToStaticMarkup(<SideNav active="goal" />))).toContain("Goals");
    expect(currentButton(renderToStaticMarkup(<BottomNav active="goal" />))).toContain("Goals");
    expect(currentButton(renderToStaticMarkup(<SideNav active="account" />))).toContain("Accounts");
  });

  it("offsets content to match the sidebar at tablet and desktop widths", () => {
    const markup = renderToStaticMarkup(
      <AppShell active="home" title="Overview">
        <p>Page content</p>
      </AppShell>,
    );

    expect(markup).toContain("md:pl-52");
    expect(markup).toContain("lg:pl-[228px]");
    expect(markup).toContain("md:px-6");
    expect(markup).toContain("<main");
    expect(markup).toContain("Page content");
  });
});
