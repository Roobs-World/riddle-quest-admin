import * as Font from "expo-font";
import { loadFonts } from "../fontLoader";

// Mock expo-font
jest.mock("expo-font", () => ({
  loadAsync: jest.fn(),
}));

// Mock console.log
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});

describe("loadFonts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (console.log as jest.Mock).mockClear();
  });

  describe("Successful Font Loading", () => {
    it("should load fonts successfully", async () => {
      const mockLoadAsync = Font.loadAsync as jest.Mock;
      mockLoadAsync.mockResolvedValueOnce(true);

      await loadFonts();

      expect(mockLoadAsync).toHaveBeenCalledTimes(1);
      expect(mockLoadAsync).toHaveBeenCalledWith({
        PoetsenOne: expect.anything(),
        Poppins: expect.anything(),
        PoppinsBold: expect.anything(),
        PoppinsSemiBold: expect.anything(),
        PoppinsLight: expect.anything(),
      });
    });

    it("should call Font.loadAsync with correct font paths", async () => {
      const mockLoadAsync = Font.loadAsync as jest.Mock;
      mockLoadAsync.mockResolvedValueOnce(true);

      await loadFonts();

      const fontConfig = mockLoadAsync.mock.calls[0][0];
      expect(Object.keys(fontConfig)).toEqual([
        "PoetsenOne",
        "Poppins",
        "PoppinsBold",
        "PoppinsSemiBold",
        "PoppinsLight",
      ]);
    });

    it("should log messages during font loading", async () => {
      const mockLoadAsync = Font.loadAsync as jest.Mock;
      mockLoadAsync.mockResolvedValueOnce(true);

      await loadFonts();

      expect(console.log).toHaveBeenCalledWith("Attempting to load fonts...");
      expect(console.log).toHaveBeenCalledWith("Fonts loaded successfully!");
    });
  });

  describe("Error Handling", () => {
    it("should throw error when font loading fails", async () => {
      const mockLoadAsync = Font.loadAsync as jest.Mock;
      const error = new Error("Failed to load font");
      mockLoadAsync.mockRejectedValueOnce(error);

      await expect(loadFonts()).rejects.toThrow("Failed to load font");
      expect(mockLoadAsync).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith("Attempting to load fonts...");
      expect(console.log).not.toHaveBeenCalledWith(
        "Fonts loaded successfully!"
      );
    });

    it("should throw error on network errors", async () => {
      const mockLoadAsync = Font.loadAsync as jest.Mock;
      const error = new Error("Network request failed");
      mockLoadAsync.mockRejectedValueOnce(error);

      await expect(loadFonts()).rejects.toThrow("Network request failed");
      expect(mockLoadAsync).toHaveBeenCalledTimes(1);
    });

    it("should throw error when font files are missing", async () => {
      const mockLoadAsync = Font.loadAsync as jest.Mock;
      const error = new Error("Font file not found");
      mockLoadAsync.mockRejectedValueOnce(error);

      await expect(loadFonts()).rejects.toThrow("Font file not found");
      expect(mockLoadAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe("Multiple Calls", () => {
    it("should handle multiple sequential calls", async () => {
      const mockLoadAsync = Font.loadAsync as jest.Mock;
      mockLoadAsync.mockResolvedValue(true);

      await loadFonts();
      await loadFonts();
      await loadFonts();

      expect(mockLoadAsync).toHaveBeenCalledTimes(3);
      expect(console.log).toHaveBeenCalledTimes(6); // 2 logs per call
    });

    it("should handle concurrent calls", async () => {
      const mockLoadAsync = Font.loadAsync as jest.Mock;
      mockLoadAsync.mockResolvedValue(true);

      const promises = [loadFonts(), loadFonts(), loadFonts()];
      await Promise.all(promises);

      expect(mockLoadAsync).toHaveBeenCalledTimes(3);
      expect(console.log).toHaveBeenCalledTimes(6); // 2 logs per call
    });
  });

  describe("Font Configuration", () => {
    it("should load all required font variants", async () => {
      const mockLoadAsync = Font.loadAsync as jest.Mock;
      mockLoadAsync.mockResolvedValueOnce(true);

      await loadFonts();

      const fontConfig = mockLoadAsync.mock.calls[0][0];
      const fontNames = Object.keys(fontConfig);

      expect(fontNames).toContain("PoetsenOne");
      expect(fontNames).toContain("Poppins");
      expect(fontNames).toContain("PoppinsBold");
      expect(fontNames).toContain("PoppinsSemiBold");
      expect(fontNames).toContain("PoppinsLight");
      expect(fontNames).toHaveLength(5);
    });
  });
});
