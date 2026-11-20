import {beforeEach, describe, expect, it} from "@jest/globals";
import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {NativeModules} from "react-native";
import {pickAvatar} from "../avatar/pickAvatar";
import {deviceAvatarUrl} from "../avatar/avatarUrl";
import {AvatarEditor} from "../components/AvatarEditor";
import {avatarText} from "../i18n/avatarCopy";
import {createFakeHostServices} from "../test/fakeHostServices";

/** Prepared native bytes have already passed image decoding and bounded WebP encoding. */
const image = "data:image/webp;base64,AQID";

describe("native avatar profile editing", () => {
  beforeEach(() => {delete NativeModules.RiddleQuestAvatarPicker;});

  it("adapts only local emulator Storage URLs at the device boundary", () => {
    expect(deviceAvatarUrl("http://127.0.0.1:9199/v0/b/bucket/o/avatar", "10.0.2.2")).toBe("http://10.0.2.2:9199/v0/b/bucket/o/avatar");
    expect(deviceAvatarUrl("https://example.com/photo.webp", "10.0.2.2")).toBe("https://example.com/photo.webp");
    expect(deviceAvatarUrl("http://127.0.0.1:9199/v0/b/bucket/o/avatar")).toBe("http://127.0.0.1:9199/v0/b/bucket/o/avatar");
    expect(deviceAvatarUrl("invalid-url", "10.0.2.2")).toBe("invalid-url");
  });

  it("validates the native module, cancellation and its returned data URL", async () => {
    await expect(pickAvatar()).rejects.toThrow("avatar-picker-unavailable");
    NativeModules.RiddleQuestAvatarPicker = {pickAvatar: async () => null};
    await expect(pickAvatar()).resolves.toBeNull();
    NativeModules.RiddleQuestAvatarPicker = {pickAvatar: async () => "file:///private/photo.jpg"};
    await expect(pickAvatar()).rejects.toThrow();
    NativeModules.RiddleQuestAvatarPicker = {pickAvatar: async () => image};
    await expect(pickAvatar()).resolves.toBe(image);
  });

  it("uploads the selected image through hosted services and renders translated confirmation", async () => {
    /** Native file access is the only unavailable device seam in this rendering test. */
    NativeModules.RiddleQuestAvatarPicker = {pickAvatar: async () => image};
    /** Account mutation requests remain observable. */
    const uploaded: string[] = [];
    /** Existing hosted service contract owns the server confirmation. */
    const services = {...createFakeHostServices(), updateAvatar: async (value: string) => {uploaded.push(value); return null;}};
    await render(<AvatarEditor locale="es" accountUid="device-owner" services={services} avatarUrl="https://example.com/avatar.webp" />);
    expect(screen.getByTestId("profile-avatar")).toHaveProp("source", {uri: "https://example.com/avatar.webp"});
    await fireEvent.press(screen.getByTestId("profile-avatar-select"));
    await waitFor(() => expect(screen.getByTestId("profile-avatar-notice")).toHaveTextContent(avatarText("es", "ALERT_AVATAR_UPDATE_SUCCESS")));
    expect(uploaded).toEqual([image]);
  });

  it("keeps cancellation quiet and reports a failed upload with retry available", async () => {
    /** First selection is cancelled; the second reaches an unavailable backend. */
    let selections = 0;
    NativeModules.RiddleQuestAvatarPicker = {pickAvatar: async () => ++selections === 1 ? null : image};
    /** The server error cannot replace the confirmed profile image. */
    const services = {...createFakeHostServices(), updateAvatar: async () => {throw Error("offline");}};
    await render(<AvatarEditor locale="en" accountUid="device-owner" services={services} />);
    await fireEvent.press(screen.getByTestId("profile-avatar-select"));
    await waitFor(() => expect(screen.getByTestId("profile-avatar-select")).toHaveTextContent(avatarText("en", "UPLOAD_FROM_LIBRARY_BUTTON")));
    expect(screen.queryByTestId("profile-avatar-notice")).toBeNull();
    await fireEvent.press(screen.getByTestId("profile-avatar-select"));
    await waitFor(() => expect(screen.getByTestId("profile-avatar-notice")).toHaveTextContent(avatarText("en", "ALERT_AVATAR_UPDATE_ERROR")));
    expect(screen.getByTestId("profile-avatar-select")).not.toBeDisabled();
  });
});
