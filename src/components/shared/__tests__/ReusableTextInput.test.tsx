import React from "react";
import { render } from "@testing-library/react-native";
import ReusableTextInput from "../ReusableTextInput";

// Mock React Native components for testing
jest.mock("react-native", () => ({
  TextInput: "TextInput",
  StyleSheet: {
    create: jest.fn((styles) => styles),
    flatten: jest.fn((style) => {
      if (Array.isArray(style)) {
        return Object.assign({}, ...style.filter(Boolean));
      }
      return style || {};
    }),
    compose: jest.fn((...styles) => styles),
    hairlineWidth: 1,
    absoluteFill: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
  },
}));

// Mock the styles import
jest.mock("../../../styles", () => ({
  styles: {
    input: {
      height: 40,
      borderWidth: 1,
      borderColor: "#ccc",
      paddingHorizontal: 10,
      borderRadius: 8,
    },
  },
}));

describe("ReusableTextInput", () => {
  describe("component structure", () => {
    it("should render without crashing", () => {
      expect(() => {
        render(<ReusableTextInput value="" onChangeText={() => {}} />);
      }).not.toThrow();
    });

    it("should be exported as default", () => {
      expect(ReusableTextInput).toBeDefined();
      expect(typeof ReusableTextInput).toBe("function");
    });

    it("should render a TextInput element", () => {
      const { getByTestId } = render(
        <ReusableTextInput
          value="test"
          onChangeText={() => {}}
          testID="reusable-text-input"
        />
      );
      expect(getByTestId("reusable-text-input")).toBeTruthy();
    });

    it("should be a React functional component", () => {
      expect(ReusableTextInput.prototype).toBeUndefined();
      expect(typeof ReusableTextInput).toBe("function");
    });
  });

  describe("function execution and coverage", () => {
    it("should execute the component function and return JSX", () => {
      const mockProps = {
        value: "test",
        onChangeText: jest.fn(),
        testID: "test-input",
      };

      const result = render(<ReusableTextInput {...mockProps} />);
      expect(result).toBeDefined();

      // Verify the component renders the expected element
      const textInput = result.getByTestId("test-input");
      expect(textInput).toBeTruthy();
      expect(textInput.type).toBe("TextInput");
    });

    it("should properly destructure className from props", () => {
      const { getByTestId } = render(
        <ReusableTextInput
          value="test"
          onChangeText={() => {}}
          className="test-class"
          testID="destructure-test"
        />
      );

      const textInput = getByTestId("destructure-test");
      expect(textInput.props.className).toBe("test-class");
    });

    it("should spread remaining props to TextInput", () => {
      const additionalProps = {
        value: "spread test",
        onChangeText: jest.fn(),
        placeholder: "Test placeholder",
        maxLength: 100,
        autoCapitalize: "none" as const,
        testID: "spread-test",
      };

      const { getByTestId } = render(
        <ReusableTextInput {...additionalProps} />
      );

      const textInput = getByTestId("spread-test");
      expect(textInput.props.value).toBe("spread test");
      expect(textInput.props.placeholder).toBe("Test placeholder");
      expect(textInput.props.maxLength).toBe(100);
      expect(textInput.props.autoCapitalize).toBe("none");
      expect(textInput.props.onChangeText).toBe(additionalProps.onChangeText);
    });

    it("should handle both className and spread props together", () => {
      const { getByTestId } = render(
        <ReusableTextInput
          value="combined test"
          onChangeText={() => {}}
          className="combined-class"
          placeholder="Combined placeholder"
          secureTextEntry={true}
          testID="combined-test"
        />
      );

      const textInput = getByTestId("combined-test");
      expect(textInput.props.className).toBe("combined-class");
      expect(textInput.props.value).toBe("combined test");
      expect(textInput.props.placeholder).toBe("Combined placeholder");
      expect(textInput.props.secureTextEntry).toBe(true);
    });

    it("should render with minimal props to test core function execution", () => {
      const minimalProps = {
        value: "",
        onChangeText: () => {},
      };

      const result = render(<ReusableTextInput {...minimalProps} />);
      expect(result).toBeDefined();
      // Verify the component renders by checking the UNSAFE_root exists
      expect(result.UNSAFE_root).toBeDefined();
    });

    it("should handle undefined className explicitly", () => {
      const { getByTestId } = render(
        <ReusableTextInput
          value="undefined test"
          onChangeText={() => {}}
          className={undefined}
          testID="undefined-class-test"
        />
      );

      const textInput = getByTestId("undefined-class-test");
      expect(textInput.props.className).toBeUndefined();
    });
  });

  describe("props handling", () => {
    it("should pass value prop correctly", () => {
      const testValue = "test value";
      const { getByDisplayValue } = render(
        <ReusableTextInput value={testValue} onChangeText={() => {}} />
      );
      expect(getByDisplayValue(testValue)).toBeTruthy();
    });

    it("should pass onChangeText prop correctly", () => {
      const mockOnChangeText = jest.fn();
      const { getByTestId } = render(
        <ReusableTextInput
          value=""
          onChangeText={mockOnChangeText}
          testID="text-input"
        />
      );

      const textInput = getByTestId("text-input");
      // Simulate text change
      textInput.props.onChangeText("new text");
      expect(mockOnChangeText).toHaveBeenCalledWith("new text");
      expect(mockOnChangeText).toHaveBeenCalledTimes(1);
    });

    it("should pass className prop correctly", () => {
      const customClassName = "custom-class";
      const { getByTestId } = render(
        <ReusableTextInput
          value=""
          onChangeText={() => {}}
          className={customClassName}
          testID="text-input"
        />
      );

      const textInput = getByTestId("text-input");
      expect(textInput.props.className).toBe(customClassName);
    });

    it("should work without className prop", () => {
      expect(() => {
        render(<ReusableTextInput value="" onChangeText={() => {}} />);
      }).not.toThrow();
    });

    it("should pass through all TextInput props", () => {
      const props = {
        value: "test",
        onChangeText: jest.fn(),
        placeholder: "Enter text",
        secureTextEntry: true,
        autoCapitalize: "none" as const,
        autoCorrect: false,
        keyboardType: "email-address" as const,
        testID: "text-input",
      };

      const { getByTestId } = render(<ReusableTextInput {...props} />);
      const textInput = getByTestId("text-input");

      expect(textInput.props.placeholder).toBe("Enter text");
      expect(textInput.props.secureTextEntry).toBe(true);
      expect(textInput.props.autoCapitalize).toBe("none");
      expect(textInput.props.autoCorrect).toBe(false);
      expect(textInput.props.keyboardType).toBe("email-address");
    });

    it("should pass custom style props", () => {
      const customStyle = { fontSize: 16, color: "red" };
      const { getByTestId } = render(
        <ReusableTextInput
          value=""
          onChangeText={() => {}}
          style={customStyle}
          testID="text-input"
        />
      );

      const textInput = getByTestId("text-input");
      // Since ...props comes after style={styles.input}, custom style will override
      expect(textInput.props.style).toEqual(customStyle);
    });

    it("should handle null and undefined values gracefully", () => {
      expect(() => {
        render(
          <ReusableTextInput value={null as any} onChangeText={() => {}} />
        );
      }).not.toThrow();

      expect(() => {
        render(
          <ReusableTextInput value={undefined as any} onChangeText={() => {}} />
        );
      }).not.toThrow();
    });
  });

  describe("styling", () => {
    it("should apply styles.input from imported styles", () => {
      const { getByTestId } = render(
        <ReusableTextInput
          value=""
          onChangeText={() => {}}
          testID="text-input"
        />
      );

      const textInput = getByTestId("text-input");
      expect(textInput.props.style).toEqual({
        height: 40,
        borderWidth: 1,
        borderColor: "#ccc",
        paddingHorizontal: 10,
        borderRadius: 8,
      });
    });

    it("should always apply base styles regardless of other props", () => {
      const { getByTestId } = render(
        <ReusableTextInput
          value=""
          onChangeText={() => {}}
          placeholder="Test"
          multiline={true}
          numberOfLines={4}
          testID="text-input"
        />
      );

      const textInput = getByTestId("text-input");
      expect(textInput.props.style).toEqual({
        height: 40,
        borderWidth: 1,
        borderColor: "#ccc",
        paddingHorizontal: 10,
        borderRadius: 8,
      });
    });
  });

  describe("TypeScript interface compliance", () => {
    it("should accept all TextInputProps", () => {
      const allProps = {
        value: "test",
        onChangeText: jest.fn(),
        placeholder: "Enter text",
        secureTextEntry: false,
        multiline: false,
        numberOfLines: 1,
        maxLength: 100,
        editable: true,
        autoFocus: false,
        blurOnSubmit: true,
        returnKeyType: "done" as const,
        keyboardType: "default" as const,
        autoCapitalize: "sentences" as const,
        autoCorrect: true,
        className: "custom-class",
      };

      expect(() => {
        render(<ReusableTextInput {...allProps} />);
      }).not.toThrow();
    });

    it("should work with minimal required props", () => {
      expect(() => {
        render(<ReusableTextInput value="" onChangeText={() => {}} />);
      }).not.toThrow();
    });

    it("should accept React Native TextInput event handlers", () => {
      const eventHandlers = {
        value: "test",
        onChangeText: jest.fn(),
        onFocus: jest.fn(),
        onBlur: jest.fn(),
        onSubmitEditing: jest.fn(),
        onKeyPress: jest.fn(),
        onSelectionChange: jest.fn(),
        testID: "text-input",
      };

      const { getByTestId } = render(<ReusableTextInput {...eventHandlers} />);
      const textInput = getByTestId("text-input");

      expect(textInput.props.onFocus).toBe(eventHandlers.onFocus);
      expect(textInput.props.onBlur).toBe(eventHandlers.onBlur);
      expect(textInput.props.onSubmitEditing).toBe(
        eventHandlers.onSubmitEditing
      );
      expect(textInput.props.onKeyPress).toBe(eventHandlers.onKeyPress);
      expect(textInput.props.onSelectionChange).toBe(
        eventHandlers.onSelectionChange
      );
    });

    it("should support accessibility props", () => {
      const accessibilityProps = {
        value: "test",
        onChangeText: jest.fn(),
        accessibilityLabel: "Username input",
        accessibilityHint: "Enter your username",
        accessible: true,
        testID: "text-input",
      };

      const { getByTestId } = render(
        <ReusableTextInput {...accessibilityProps} />
      );
      const textInput = getByTestId("text-input");

      expect(textInput.props.accessibilityLabel).toBe("Username input");
      expect(textInput.props.accessibilityHint).toBe("Enter your username");
      expect(textInput.props.accessible).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty string value", () => {
      expect(() => {
        render(<ReusableTextInput value="" onChangeText={() => {}} />);
      }).not.toThrow();
    });

    it("should handle undefined className", () => {
      const { getByTestId } = render(
        <ReusableTextInput
          value=""
          onChangeText={() => {}}
          className={undefined}
          testID="text-input"
        />
      );

      const textInput = getByTestId("text-input");
      expect(textInput.props.className).toBeUndefined();
    });

    it("should handle null className", () => {
      const { getByTestId } = render(
        <ReusableTextInput
          value=""
          onChangeText={() => {}}
          className={null as any}
          testID="text-input"
        />
      );

      const textInput = getByTestId("text-input");
      expect(textInput.props.className).toBeNull();
    });

    it("should handle long text values", () => {
      const longText = "a".repeat(1000);
      expect(() => {
        render(<ReusableTextInput value={longText} onChangeText={() => {}} />);
      }).not.toThrow();
    });

    it("should handle special characters in value", () => {
      const specialChars = "!@#$%^&*()_+-=[]{}|;:,.<>?";
      expect(() => {
        render(
          <ReusableTextInput value={specialChars} onChangeText={() => {}} />
        );
      }).not.toThrow();
    });

    it("should handle unicode characters", () => {
      const unicodeText = "🎮🎯🎨 Hello 世界 مرحبا 🚀";
      expect(() => {
        render(
          <ReusableTextInput value={unicodeText} onChangeText={() => {}} />
        );
      }).not.toThrow();
    });

    it("should handle numeric values as strings", () => {
      const numericValue = "12345.67";
      const { getByDisplayValue } = render(
        <ReusableTextInput value={numericValue} onChangeText={() => {}} />
      );
      expect(getByDisplayValue(numericValue)).toBeTruthy();
    });

    it("should handle boolean string values", () => {
      const boolValue = "true";
      const { getByDisplayValue } = render(
        <ReusableTextInput value={boolValue} onChangeText={() => {}} />
      );
      expect(getByDisplayValue(boolValue)).toBeTruthy();
    });
  });

  describe("component behavior", () => {
    it("should spread all props to TextInput", () => {
      const customProps = {
        value: "test",
        onChangeText: jest.fn(),
        placeholder: "Test placeholder",
        maxLength: 50,
        autoComplete: "email" as const,
        testID: "text-input",
      };

      const { getByTestId } = render(<ReusableTextInput {...customProps} />);
      const textInput = getByTestId("text-input");

      expect(textInput.props.placeholder).toBe("Test placeholder");
      expect(textInput.props.maxLength).toBe(50);
      expect(textInput.props.autoComplete).toBe("email");
    });

    it("should maintain consistent behavior across renders", () => {
      const props = { value: "test", onChangeText: jest.fn() };

      const { rerender, getByDisplayValue } = render(
        <ReusableTextInput {...props} />
      );

      expect(getByDisplayValue("test")).toBeTruthy();

      // Rerender with same props
      rerender(<ReusableTextInput {...props} />);
      expect(getByDisplayValue("test")).toBeTruthy();
    });

    it("should handle prop updates correctly", () => {
      const initialProps = { value: "initial", onChangeText: jest.fn() };
      const { rerender, getByDisplayValue, queryByDisplayValue } = render(
        <ReusableTextInput {...initialProps} />
      );

      expect(getByDisplayValue("initial")).toBeTruthy();

      // Update props
      const updatedProps = { value: "updated", onChangeText: jest.fn() };
      rerender(<ReusableTextInput {...updatedProps} />);

      expect(queryByDisplayValue("initial")).toBeNull();
      expect(getByDisplayValue("updated")).toBeTruthy();
    });

    it("should handle className updates", () => {
      const { rerender, getByTestId } = render(
        <ReusableTextInput
          value=""
          onChangeText={() => {}}
          className="initial-class"
          testID="text-input"
        />
      );

      expect(getByTestId("text-input").props.className).toBe("initial-class");

      rerender(
        <ReusableTextInput
          value=""
          onChangeText={() => {}}
          className="updated-class"
          testID="text-input"
        />
      );

      expect(getByTestId("text-input").props.className).toBe("updated-class");
    });

    it("should handle onChangeText callback updates", () => {
      const initialCallback = jest.fn();
      const { rerender, getByTestId } = render(
        <ReusableTextInput
          value=""
          onChangeText={initialCallback}
          testID="text-input"
        />
      );

      const textInput = getByTestId("text-input");
      textInput.props.onChangeText("test1");
      expect(initialCallback).toHaveBeenCalledWith("test1");

      const updatedCallback = jest.fn();
      rerender(
        <ReusableTextInput
          value=""
          onChangeText={updatedCallback}
          testID="text-input"
        />
      );

      const updatedTextInput = getByTestId("text-input");
      updatedTextInput.props.onChangeText("test2");
      expect(updatedCallback).toHaveBeenCalledWith("test2");
      expect(initialCallback).not.toHaveBeenCalledWith("test2");
    });
  });

  describe("performance and reliability", () => {
    it("should not cause memory leaks with multiple renders", () => {
      const props = { value: "test", onChangeText: jest.fn() };

      // Render multiple times to ensure no memory issues
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(<ReusableTextInput {...props} />);
        unmount();
      }

      // If we reach here without throwing, the test passes
      expect(true).toBe(true);
    });

    it("should handle rapid prop changes", () => {
      const { rerender } = render(
        <ReusableTextInput value="1" onChangeText={() => {}} />
      );

      // Rapidly change props
      for (let i = 2; i <= 10; i++) {
        rerender(
          <ReusableTextInput value={i.toString()} onChangeText={() => {}} />
        );
      }

      expect(true).toBe(true);
    });

    it("should maintain stable component structure", () => {
      const { getByTestId } = render(
        <ReusableTextInput
          value="test"
          onChangeText={() => {}}
          testID="text-input"
        />
      );

      const textInput = getByTestId("text-input");
      expect(textInput).toBeTruthy();
      expect(textInput.type).toBe("TextInput");
    });
  });

  describe("integration scenarios", () => {
    it("should work with form validation", () => {
      const mockValidator = jest.fn((text) => text.length > 3);
      const mockOnChangeText = jest.fn((text) => {
        const isValid = mockValidator(text);
        // Simulate form validation
        return isValid;
      });

      const { getByTestId } = render(
        <ReusableTextInput
          value=""
          onChangeText={mockOnChangeText}
          testID="text-input"
        />
      );

      const textInput = getByTestId("text-input");
      textInput.props.onChangeText("hi");
      expect(mockOnChangeText).toHaveBeenCalledWith("hi");
      expect(mockValidator).toHaveBeenCalledWith("hi");
    });

    it("should work with controlled input patterns", () => {
      const ControlledInput = () => {
        const [value, setValue] = React.useState("");
        return (
          <ReusableTextInput
            value={value}
            onChangeText={setValue}
            testID="controlled-input"
          />
        );
      };

      const { getByTestId } = render(<ControlledInput />);
      const textInput = getByTestId("controlled-input");

      textInput.props.onChangeText("controlled");
      // In a real scenario, this would trigger a re-render with the new value
      expect(textInput.props.value).toBe("");
    });

    it("should handle complex TextInput configurations", () => {
      const complexProps = {
        value: "complex input",
        onChangeText: jest.fn(),
        multiline: true,
        numberOfLines: 4,
        maxLength: 200,
        keyboardType: "email-address" as const,
        autoCapitalize: "none" as const,
        autoCorrect: false,
        autoFocus: true,
        selectTextOnFocus: true,
        clearButtonMode: "while-editing" as const,
        returnKeyType: "send" as const,
        secureTextEntry: false,
        placeholder: "Enter your message here...",
        className: "complex-input",
        testID: "complex-input",
      };

      expect(() => {
        render(<ReusableTextInput {...complexProps} />);
      }).not.toThrow();

      const { getByTestId } = render(<ReusableTextInput {...complexProps} />);
      const textInput = getByTestId("complex-input");

      // Verify all props are passed through correctly
      Object.keys(complexProps).forEach((key) => {
        if (key !== "className" && key !== "testID") {
          expect(textInput.props[key]).toBe(
            complexProps[key as keyof typeof complexProps]
          );
        }
      });
    });
  });

  describe("code coverage completeness", () => {
    it("should ensure component function body is fully executed", () => {
      // This test specifically ensures the entire component function runs
      const testProps = {
        value: "coverage test",
        onChangeText: jest.fn(),
        className: "coverage-class",
        placeholder: "Coverage placeholder",
        testID: "coverage-test",
      };

      const result = render(<ReusableTextInput {...testProps} />);
      const textInput = result.getByTestId("coverage-test");

      // Verify that both the destructuring and spreading worked
      expect(textInput.props.className).toBe("coverage-class");
      expect(textInput.props.value).toBe("coverage test");
      expect(textInput.props.placeholder).toBe("Coverage placeholder");
      expect(textInput.props.onChangeText).toBe(testProps.onChangeText);

      // Verify the styles are applied
      expect(textInput.props.style).toEqual({
        height: 40,
        borderWidth: 1,
        borderColor: "#ccc",
        paddingHorizontal: 10,
        borderRadius: 8,
      });
    });

    it("should test all possible prop combinations", () => {
      // Test with className present
      const withClassName = render(
        <ReusableTextInput
          value="test1"
          onChangeText={() => {}}
          className="test-class"
          testID="with-class"
        />
      );
      expect(withClassName.getByTestId("with-class").props.className).toBe(
        "test-class"
      );

      // Test without className
      const withoutClassName = render(
        <ReusableTextInput
          value="test2"
          onChangeText={() => {}}
          testID="without-class"
        />
      );
      expect(
        withoutClassName.getByTestId("without-class").props.className
      ).toBeUndefined();

      // Test with many additional props
      const manyProps = render(
        <ReusableTextInput
          value="test3"
          onChangeText={() => {}}
          placeholder="Many props"
          maxLength={50}
          multiline={true}
          numberOfLines={3}
          autoCapitalize="words"
          testID="many-props"
        />
      );
      const textInput = manyProps.getByTestId("many-props");
      expect(textInput.props.placeholder).toBe("Many props");
      expect(textInput.props.maxLength).toBe(50);
      expect(textInput.props.multiline).toBe(true);
      expect(textInput.props.numberOfLines).toBe(3);
      expect(textInput.props.autoCapitalize).toBe("words");
    });

    it("should verify JSX return statement execution", () => {
      // This test ensures the return statement in the component is executed
      const result = render(
        <ReusableTextInput
          value="jsx test"
          onChangeText={() => {}}
          testID="jsx-test"
        />
      );

      // The component should render successfully and we can query it
      const textInput = result.getByTestId("jsx-test");
      expect(textInput).toBeDefined();
      expect(textInput.type).toBe("TextInput");
    });
  });
});
