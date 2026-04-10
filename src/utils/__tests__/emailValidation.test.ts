import { validateEmail } from "../emailValidation";
import { AppStrings } from "../../constants/AppStrings";

describe("emailValidation", () => {
  describe("validateEmail", () => {
    const expectedErrorMessage =
      AppStrings.AuthStrings.Login.INVALID_EMAIL_FORMAT_ERROR;

    it("should return empty string for valid email addresses", () => {
      const validEmails = [
        "test@example.com",
        "user_name@example.co.uk",
        "email@subdomain.example.com",
        "firstname_lastname@example.com",
        "123456789@example.com",
        "test@test-domain.com",
        "x@example.com",
        "email@test.org",
        "name.lastname@company.com",
        "user.name@example.net",
        "test123@gmail.com",
        "user-name@yahoo.com",
        "a@b.co",
        "test@subdomain.example.com",
        "email@test-domain.com",
        "user123@example123.com",
        "test.email.address@domain.com",
      ];

      validEmails.forEach((email) => {
        expect(validateEmail(email)).toBe("");
      });
    });

    it("should return error message for empty email", () => {
      expect(validateEmail("")).toBe(expectedErrorMessage);
    });

    it("should return error message for null or undefined email", () => {
      expect(validateEmail(null as any)).toBe(expectedErrorMessage);
      expect(validateEmail(undefined as any)).toBe(expectedErrorMessage);
    });

    it("should return error message for invalid email formats", () => {
      const invalidEmails = [
        "invalid-email",
        "test@",
        "@domain.com",
        "test@@domain.com",
        "test@domain",
        "test.domain.com",
        "test @domain.com",
        "test@ domain.com",
        "test@domain .com",
        "test@domain. com",
        "test@domain..com",
        ".test@domain.com",
        "test.@domain.com",
        "test@.domain.com",
        "test@domain.com.",
        "test@domain,com",
        "test@domain;com",
        "test@domain:com",
        "test@domain com",
        "test@",
        "@",
        "@@",
        "test@@",
        "@@domain.com",
      ];

      invalidEmails.forEach((email) => {
        expect(validateEmail(email)).toBe(expectedErrorMessage);
      });
    });

    it("should return error message for emails with invalid characters", () => {
      const invalidCharacterEmails = [
        "test@domain.c", // TLD too short
        "test@domain.c1", // TLD contains number
        "test@domain.c12345678", // TLD too long
        "test@domain.", // TLD missing
        "test()@domain.com", // Invalid characters in local part
        "test[]@domain.com", // Invalid characters in local part
        "test{}@domain.com", // Invalid characters in local part
        "test<>@domain.com", // Invalid characters in local part
        "test,@domain.com", // Invalid characters in local part
        "test;@domain.com", // Invalid characters in local part
        "test:@domain.com", // Invalid characters in local part
        'test"@domain.com', // Invalid characters in local part
        "test'@domain.com", // Invalid characters in local part
        "test+@domain.com", // Plus not allowed in this regex
        "test @domain.com", // Space not allowed
      ];

      invalidCharacterEmails.forEach((email) => {
        expect(validateEmail(email)).toBe(expectedErrorMessage);
      });
    });

    it("should return error message for emails with missing components", () => {
      const missingComponentEmails = [
        "domain.com", // Missing @ and local part
        "test@", // Missing domain
        "@domain.com", // Missing local part
        "test@.com", // Missing domain name
        "test@domain.", // Missing TLD
        "@", // Missing everything except @
        ".", // Just a dot
        ".com", // Just TLD
        "test.", // Missing @ and domain
        "@.", // Missing local part and domain name
      ];

      missingComponentEmails.forEach((email) => {
        expect(validateEmail(email)).toBe(expectedErrorMessage);
      });
    });

    it("should handle edge cases", () => {
      expect(validateEmail("   ")).toBe(expectedErrorMessage); // Whitespace only
      expect(validateEmail("\t")).toBe(expectedErrorMessage); // Tab character
      expect(validateEmail("\n")).toBe(expectedErrorMessage); // Newline character
      expect(validateEmail("0")).toBe(expectedErrorMessage); // Single character
      expect(validateEmail("123")).toBe(expectedErrorMessage); // Numbers only
    });

    it("should return error message for emails with invalid TLD patterns", () => {
      const invalidTldEmails = [
        "test@domain.c", // TLD too short (1 char)
        "test@domain.12", // TLD all numbers
        "test@domain.c1", // TLD with numbers
        "test@domain.com123", // TLD with numbers at end
        "test@domain.123com", // TLD with numbers in middle
        "test@domain.comverylongtld", // TLD too long (>7 chars)
      ];

      invalidTldEmails.forEach((email) => {
        expect(validateEmail(email)).toBe(expectedErrorMessage);
      });
    });

    it("should validate email regex pattern comprehensively", () => {
      // Test that the regex works as expected for boundary cases
      expect(validateEmail("a@b.co")).toBe(""); // Minimum valid email
      expect(validateEmail("test-user_name123@sub-domain123.example.com")).toBe(
        ""
      ); // Complex valid email

      // Test exact boundary conditions for TLD length
      expect(validateEmail("test@domain.ab")).toBe(""); // 2-char TLD (minimum)
      expect(validateEmail("test@domain.abcdefg")).toBe(""); // 7-char TLD (maximum)
      expect(validateEmail("test@domain.abcdefgh")).toBe(expectedErrorMessage); // 8-char TLD (invalid)
    });

    it("should handle special valid email patterns", () => {
      const specialValidEmails = [
        "user@sub.domain.com", // Subdomain
        "user123@domain123.com", // Numbers in domain
        "user-name@domain-name.com", // Hyphens in both parts
        "a1@b2.co", // Single chars with numbers
        "user.name@domain.com", // Dots in local part
        "user-name.test@domain.com", // Mix of hyphens and dots
      ];

      specialValidEmails.forEach((email) => {
        expect(validateEmail(email)).toBe("");
      });
    });

    it("should be consistent with error messages", () => {
      const testCases = ["", "invalid", null, undefined];

      testCases.forEach((testCase) => {
        const result = validateEmail(testCase as any);
        if (result !== "") {
          expect(result).toBe(expectedErrorMessage);
        }
      });
    });
  });
});

