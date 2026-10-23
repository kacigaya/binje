import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AudioLanguageIcon from "@/components/AudioLanguageIcon";

function render(language?: string) {
  return renderToStaticMarkup(createElement(AudioLanguageIcon, { language }));
}

describe("audio language icons", () => {
  test.each(["en", "fr", "ja", "ko"])("renders the %s flag as a decorative SVG", (language) => {
    const markup = render(language);
    expect(markup).toContain(`data-audio-flag="${language}"`);
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain("lucide-globe");
  });

  test("normalizes language code case and surrounding spaces", () => {
    expect(render(" JA ")).toContain('data-audio-flag="ja"');
  });

  test.each([undefined, "", "xx", "es", "zh"])("uses a globe for an unsupported language (%s)", (language) => {
    const markup = render(language);
    expect(markup).toContain('data-audio-flag="unknown"');
    expect(markup).toContain("lucide-globe");
    expect(markup).toContain('aria-hidden="true"');
  });
});
