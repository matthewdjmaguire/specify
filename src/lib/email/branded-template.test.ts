import { describe, expect, it } from "vitest";
import { brandedEmailHtml } from "./branded-template";

describe("brandedEmailHtml", () => {
  it("includes the Specify wordmark, the 600px card width, and the heading", () => {
    const html = brandedEmailHtml({ heading: "You're invited", bodyHtml: "<p>Body text.</p>" });
    expect(html).toContain("Specify");
    expect(html).toContain('width="600"');
    expect(html).toContain("You're invited");
    expect(html).toContain("<p>Body text.</p>");
  });

  it("includes the logo image next to the wordmark, pointing at the real public icon URL", () => {
    const html = brandedEmailHtml({ heading: "X", bodyHtml: "Y" });
    expect(html).toContain('<img src="https://specify-seven.vercel.app/icon-192.png"');
  });

  it("defaults the hidden preheader to the heading when no previewText is given", () => {
    const html = brandedEmailHtml({ heading: "Your invite is ready", bodyHtml: "Y" });
    expect(html).toMatch(/display:none[^>]*>\s*Your invite is ready/);
  });

  it("uses a custom, escaped previewText for the hidden preheader when given", () => {
    const html = brandedEmailHtml({ heading: "X", bodyHtml: "Y", previewText: "Tom & Jerry replied" });
    expect(html).toContain("Tom &amp; Jerry replied");
  });

  it("escapes the heading but passes bodyHtml through untouched (trusted, caller-composed)", () => {
    const html = brandedEmailHtml({ heading: "<script>alert(1)</script>", bodyHtml: "<p>ok</p>" });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<p>ok</p>");
  });

  it("falls back to a default footer note when none is given", () => {
    const html = brandedEmailHtml({ heading: "X", bodyHtml: "Y" });
    expect(html).toContain("learn your plants");
  });

  it("uses a custom footer note when given, escaped", () => {
    const html = brandedEmailHtml({ heading: "X", bodyHtml: "Y", footerNote: "Reply & we'll help" });
    expect(html).toContain("Reply &amp; we'll help");
  });
});
