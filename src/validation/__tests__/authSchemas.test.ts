import { signUpSchema, loginSchema } from "../authSchemas";

describe("Auth Validation Schemas", () => {
  describe("signUpSchema", () => {
    it("validates correct sign up data", () => {
      const validData = {
        username: "testuser",
        email: "test@example.com",
        password: "password123",
        confirmPassword: "password123",
      };

      const result = signUpSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const invalidData = {
        username: "testuser",
        email: "invalid-email",
        password: "password123",
        confirmPassword: "password123",
      };

      const result = signUpSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("rejects short password", () => {
      const invalidData = {
        username: "testuser",
        email: "test@example.com",
        password: "123",
        confirmPassword: "123",
      };

      const result = signUpSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("rejects mismatched passwords", () => {
      const invalidData = {
        username: "testuser",
        email: "test@example.com",
        password: "password123",
        confirmPassword: "different123",
      };

      const result = signUpSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("rejects empty username", () => {
      const invalidData = {
        username: "",
        email: "test@example.com",
        password: "password123",
        confirmPassword: "password123",
      };

      const result = signUpSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("validates clean username without profanity", () => {
      const validData = {
        username: "cleanuser", // This should pass the profanity filter
        email: "test@example.com",
        password: "password123",
        confirmPassword: "password123",
      };

      const result = signUpSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe("loginSchema", () => {
    it("validates correct login data", () => {
      const validData = {
        email: "test@example.com",
        password: "password123",
      };

      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const invalidData = {
        email: "invalid-email",
        password: "password123",
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("rejects empty password", () => {
      const invalidData = {
        email: "test@example.com",
        password: "",
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("rejects short password", () => {
      const invalidData = {
        email: "test@example.com",
        password: "123",
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("rejects empty email", () => {
      const invalidData = {
        email: "",
        password: "password123",
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});

