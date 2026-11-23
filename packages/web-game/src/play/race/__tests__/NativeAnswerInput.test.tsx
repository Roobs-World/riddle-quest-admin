import {renderToString} from "react-dom/server";
import {NativeAnswerInput, nativeAnswerGraphemes} from "../components/NativeAnswerInput";

describe("NativeAnswerInput", () => {
  it("normalizes committed IME text into NFC grapheme clusters", () => {
    expect(nativeAnswerGraphemes("にほん")).toEqual(["に", "ほ", "ん"]);
    expect(nativeAnswerGraphemes("👩🏽‍🚀")).toEqual(["👩🏽‍🚀"]);
    expect(nativeAnswerGraphemes("نَ")).toEqual(["نَ"]);
    expect(nativeAnswerGraphemes("e\u0301")).toEqual(["é"]);
  });

  it("renders device-keyboard, IME, accessibility, and RTL metadata", () => {
    /** Provides html behavior. */
    const html = renderToString(
      <NativeAnswerInput
        disabled={false}
        locale="ar"
        onText={() => undefined}
        onBackspace={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(html).toContain('inputMode="text"');
    expect(html).toContain('enterKeyHint="done"');
    expect(html).toContain('lang="ar"');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('aria-label="Virtual keyboard"');
  });
});
