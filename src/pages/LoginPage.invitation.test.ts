import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";

function renderLogin(path: string) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(LoginPage, { onLoginSuccess: vi.fn() })
    )
  );
}

describe("LoginPage faculty invitation mode", () => {
  it("renders the normal login experience when no invite token exists", () => {
    const html = renderLogin("/login");
    expect(html).toContain("Welcome back");
    expect(html).not.toContain("Validating your secure setup link");
  });

  it("renders invitation verification immediately without flashing normal login", () => {
    const html = renderLogin("/login?invite=valid-token&email=tampered%40example.com");
    expect(html).toContain("Validating your secure setup link");
    expect(html).not.toContain("Welcome back");
    expect(html).not.toContain("tampered@example.com");
  });

  it("keeps normal login when email exists without an invite token", () => {
    const html = renderLogin("/login?email=faculty%40example.com");
    expect(html).toContain("Welcome back");
    expect(html).not.toContain("Validating your secure setup link");
  });
});
