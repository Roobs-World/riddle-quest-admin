/**
 * Hosted play client shared by the Firebase-backed web targets and the Android app.
 *
 * @remarks
 * Everything here is provider-neutral and DOM-free: the typed callable surface
 * of the game backend and the response contracts it returns. Hosts own Firebase
 * initialization, auth persistence, App Check, and emulator wiring.
 *
 * @packageDocumentation
 */
export * from "./gameFunctions";
