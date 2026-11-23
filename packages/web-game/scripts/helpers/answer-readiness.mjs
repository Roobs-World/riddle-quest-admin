/** Waits for journal-backed answer admission before seeding positive keyboard fixtures. */
export async function waitForAnswerInputReady(page) {
  await page.waitForFunction(() => {
    const key = [...document.querySelectorAll(".keyboard .key")].find(button => button.textContent === "P");
    return key instanceof HTMLButtonElement && !key.disabled && !key.closest("[inert]");
  });
}
