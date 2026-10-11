import {contentProtectionRequest, protectContent, readProtectedContent} from "../contentProtection";

describe("protected gameplay content", () => {
  it("round-trips nested multilingual content with fresh nonces", async () => {
    /** Unicode content must survive UTF-8 serialization exactly. */
    const content = {questions: [{answer: "café", riddle: "谜语", hint: "مرحبا"}], index: 2};
    /** Provides first behavior. */
    const first = await protectContent(content);
    /** Provides second behavior. */
    const second = await protectContent(content);
    expect(first.iv).toHaveLength(24);
    expect(first.iv).not.toBe(second.iv);
    expect(first.data).not.toBe(second.data);
    await expect(readProtectedContent(first)).resolves.toEqual(content);
    await expect(readProtectedContent(second)).resolves.toEqual(content);
  });

  it.each([undefined, null, false, 4, "legacy", {questions: []}])("accepts legacy plaintext %p unchanged", async value => {
    await expect(readProtectedContent(value)).resolves.toBe(value);
    expect(contentProtectionRequest(value)).toEqual({data: value, protected: false});
  });

  it("strips supported negotiation metadata without changing the domain request", () => {
    /** Provides request behavior. */
    const request = {contentProtection: 1, classicIndex: 7, locale: "fr"};
    expect(contentProtectionRequest(request)).toEqual({data: {classicIndex: 7, locale: "fr"}, protected: true});
    expect(request).toHaveProperty("contentProtection", 1);
    expect(() => contentProtectionRequest({...request, contentProtection: 2})).toThrow("content-protection-version-unsupported");
  });

  it("rejects malformed protocol metadata, nonce bytes, and ciphertext before decoding", async () => {
    /** Provides valid behavior. */
    const valid = await protectContent({answer: "ok"});
    /** Provides invalid behavior. */
    const invalid = [
      {...valid, contentProtection: 2}, {...valid, extra: true},
      {...valid, iv: 12}, {...valid, iv: "xx"}, {...valid, iv: "00"},
      {...valid, data: undefined}, {...valid, data: "0"}, {...valid, data: "00"},
    ];
    for (const envelope of invalid) await expect(readProtectedContent(envelope)).rejects.toThrow("content-protection-invalid");
  });

  it("rejects tampered authenticated content instead of accepting a modified answer", async () => {
    /** Provides valid behavior. */
    const valid = await protectContent({answer: "ok"});
    /** Changing one ciphertext byte must invalidate its authentication tag. */
    const altered = {...valid, data: (valid.data.startsWith("00") ? "01" : "00") + valid.data.slice(2)};
    await expect(readProtectedContent(altered)).rejects.toThrow();
  });
});

it("round-trips a larger multilingual pack without changing ciphertext or decoded content", async () => {
  /** Multiple encoded byte values and UTF-8 widths exercise direct hexadecimal conversion. */
  const pack = Array.from({length: 400}, (_, index) => ({index,
    clue: `谜语 مرحبا café हिन्दी ${index}`, answer: `İZMİR-${index}`,
    values: Array.from({length: 256}, (_value, byte) => byte),
  }));
  /** Existing protected bytes remain immutable across repeated reads. */
  const envelope = await protectContent(pack);
  /** A read must not rewrite the transport bytes supplied by its caller. */
  const original = {...envelope};
  expect(envelope.data.length).toBeGreaterThan(100_000);
  await expect(readProtectedContent(envelope)).resolves.toEqual(pack);
  await expect(readProtectedContent(envelope)).resolves.toEqual(pack);
  expect(envelope).toEqual(original);
});

it.each(["AA", "a", "ag", "00\n", " 00", "00 ", "００"])("rejects noncanonical hexadecimal input %p", async data => {
  /** Authentication must never receive malformed hexadecimal envelopes. */
  const valid = await protectContent({answer: "ok"});
  await expect(readProtectedContent({...valid, data})).rejects.toThrow("content-protection-invalid");
});
