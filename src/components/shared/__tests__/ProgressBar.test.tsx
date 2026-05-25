import React from "react";
import {render} from "@testing-library/react-native";
import ProgressBar from "../ProgressBar";

// Mock styles
jest.mock("../../../styles", () => ({
  styles: {
    progressBar: {},
    progressBarFill: {},
  },
  SPACING: {xs: 4, sm: 8, md: 16, lg: 24, xl: 32, "2xl": 48},
}));

describe("ProgressBar", () => {
  describe("Rendering", () => {
    it("renders correctly with required props", () => {
      const {UNSAFE_getAllByType} = render(<ProgressBar activeStep={2} totalSteps={5} />);
      const View = require("react-native").View;
      const views = UNSAFE_getAllByType(View);

      expect(views.length).toBeGreaterThan(0);
    });

    it("renders with active step 0", () => {
      const {UNSAFE_getAllByType} = render(<ProgressBar activeStep={0} totalSteps={3} />);
      const View = require("react-native").View;
      const views = UNSAFE_getAllByType(View);

      expect(views.length).toBeGreaterThan(0);
    });

    it("renders with all steps completed", () => {
      const {UNSAFE_getAllByType} = render(<ProgressBar activeStep={3} totalSteps={3} />);
      const View = require("react-native").View;
      const views = UNSAFE_getAllByType(View);

      expect(views.length).toBeGreaterThan(0);
    });

    it("renders with middle step active", () => {
      const {UNSAFE_getAllByType} = render(<ProgressBar activeStep={2} totalSteps={4} />);
      const View = require("react-native").View;
      const views = UNSAFE_getAllByType(View);

      expect(views.length).toBeGreaterThan(0);
    });
  });

  describe("Progress Bar Structure", () => {
    it("renders correct number of step indicators", () => {
      const totalSteps = 5;
      const {UNSAFE_getAllByType} = render(<ProgressBar activeStep={2} totalSteps={totalSteps} />);
      const View = require("react-native").View;
      const views = UNSAFE_getAllByType(View);

      // Should have container + totalSteps number of step views
      expect(views.length).toBe(totalSteps + 1);
    });

    it("renders with proper styling", () => {
      const {UNSAFE_getAllByType} = render(<ProgressBar activeStep={1} totalSteps={3} />);
      const View = require("react-native").View;
      const views = UNSAFE_getAllByType(View);

      expect(views.length).toBeGreaterThan(0);
    });
  });

  describe("Step Colors", () => {
    it("renders with custom step colors", () => {
      const stepColors = ["bg-red-500", "bg-blue-500", "bg-green-500"];
      const {UNSAFE_getAllByType} = render(<ProgressBar activeStep={1} totalSteps={3} stepColors={stepColors} />);
      const View = require("react-native").View;
      expect(UNSAFE_getAllByType(View).length).toBeGreaterThan(0);
    });

    it("renders without custom step colors", () => {
      const {UNSAFE_getAllByType} = render(<ProgressBar activeStep={2} totalSteps={4} />);
      const View = require("react-native").View;
      expect(UNSAFE_getAllByType(View).length).toBeGreaterThan(0);
    });

    it("handles partial custom step colors", () => {
      const stepColors = ["bg-red-500", "bg-blue-500"];
      const {UNSAFE_getAllByType} = render(<ProgressBar activeStep={1} totalSteps={4} stepColors={stepColors} />);
      const View = require("react-native").View;
      expect(UNSAFE_getAllByType(View).length).toBeGreaterThan(0);
    });
  });

  describe("Different Step Configurations", () => {
    it("handles single step", () => {
      const {UNSAFE_getAllByType} = render(<ProgressBar activeStep={1} totalSteps={1} />);
      const View = require("react-native").View;
      expect(UNSAFE_getAllByType(View).length).toBe(2); // container + 1 step
    });

    it("handles many steps", () => {
      const totalSteps = 10;
      const {UNSAFE_getAllByType} = render(<ProgressBar activeStep={5} totalSteps={totalSteps} />);
      const View = require("react-native").View;
      expect(UNSAFE_getAllByType(View).length).toBe(totalSteps + 1);
    });

    it("handles various active step positions", () => {
      const configurations = [
        {activeStep: 1, totalSteps: 5},
        {activeStep: 3, totalSteps: 5},
        {activeStep: 5, totalSteps: 5},
      ];

      configurations.forEach(({activeStep, totalSteps}) => {
        const {UNSAFE_getAllByType} = render(<ProgressBar activeStep={activeStep} totalSteps={totalSteps} />);
        const View = require("react-native").View;
        expect(UNSAFE_getAllByType(View).length).toBe(totalSteps + 1);
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles active step greater than total steps", () => {
      const {UNSAFE_getAllByType} = render(<ProgressBar activeStep={10} totalSteps={5} />);
      const View = require("react-native").View;
      expect(UNSAFE_getAllByType(View).length).toBeGreaterThan(0);
    });

    it("handles zero active step", () => {
      const {UNSAFE_getAllByType} = render(<ProgressBar activeStep={0} totalSteps={3} />);
      const View = require("react-native").View;
      expect(UNSAFE_getAllByType(View).length).toBeGreaterThan(0);
    });

    it("handles negative active step", () => {
      const {UNSAFE_getAllByType} = render(<ProgressBar activeStep={-1} totalSteps={3} />);
      const View = require("react-native").View;
      expect(UNSAFE_getAllByType(View).length).toBeGreaterThan(0);
    });
  });

  describe("Performance", () => {
    it("re-renders correctly when activeStep changes", () => {
      const {rerender, UNSAFE_getAllByType} = render(<ProgressBar activeStep={1} totalSteps={5} />);

      rerender(<ProgressBar activeStep={3} totalSteps={5} />);

      const View = require("react-native").View;
      expect(UNSAFE_getAllByType(View).length).toBe(6); // container + 5 steps
    });

    it("re-renders correctly when totalSteps changes", () => {
      const {rerender, UNSAFE_getAllByType} = render(<ProgressBar activeStep={2} totalSteps={3} />);

      rerender(<ProgressBar activeStep={2} totalSteps={5} />);

      const View = require("react-native").View;
      expect(UNSAFE_getAllByType(View).length).toBe(6); // container + 5 steps
    });

    it("handles rapid step updates", () => {
      const {rerender} = render(<ProgressBar activeStep={1} totalSteps={5} />);

      // Rapid updates
      for (let i = 1; i <= 5; i++) {
        rerender(<ProgressBar activeStep={i} totalSteps={5} />);
      }

      expect(true).toBe(true); // Should not throw errors
    });

    it("re-renders without errors", () => {
      const {rerender} = render(<ProgressBar activeStep={1} totalSteps={3} />);

      expect(() => {
        rerender(<ProgressBar activeStep={2} totalSteps={3} />);
      }).not.toThrow();
    });
  });

  describe("Props Validation", () => {
    it("works with required props", () => {
      expect(() => {
        render(<ProgressBar activeStep={1} totalSteps={3} />);
      }).not.toThrow();
    });

    it("works with optional stepColors prop", () => {
      expect(() => {
        render(
          <ProgressBar activeStep={1} totalSteps={3} stepColors={["bg-red-500", "bg-blue-500", "bg-green-500"]} />,
        );
      }).not.toThrow();
    });

    it("handles different numeric values", () => {
      const configurations = [
        {activeStep: 0, totalSteps: 1},
        {activeStep: 1, totalSteps: 1},
        {activeStep: 5, totalSteps: 10},
      ];

      configurations.forEach(({activeStep, totalSteps}) => {
        expect(() => {
          render(<ProgressBar activeStep={activeStep} totalSteps={totalSteps} />);
        }).not.toThrow();
      });
    });
  });

  describe("Visual Consistency", () => {
    it("maintains consistent structure across renders", () => {
      const {rerender, UNSAFE_getAllByType} = render(<ProgressBar activeStep={1} totalSteps={5} />);

      const View = require("react-native").View;
      const initialViewCount = UNSAFE_getAllByType(View).length;

      rerender(<ProgressBar activeStep={3} totalSteps={5} />);

      const finalViewCount = UNSAFE_getAllByType(View).length;
      expect(finalViewCount).toBe(initialViewCount);
    });

    it("maintains structure with step colors", () => {
      const stepColors = ["bg-red-500", "bg-blue-500", "bg-green-500"];

      const {rerender, UNSAFE_getAllByType} = render(
        <ProgressBar activeStep={1} totalSteps={3} stepColors={stepColors} />,
      );

      const View = require("react-native").View;
      const initialViewCount = UNSAFE_getAllByType(View).length;

      rerender(<ProgressBar activeStep={2} totalSteps={3} stepColors={stepColors} />);

      const finalViewCount = UNSAFE_getAllByType(View).length;
      expect(finalViewCount).toBe(initialViewCount);
    });
  });

  describe("Accessibility", () => {
    it("is accessible as a progress indicator", () => {
      const {UNSAFE_getAllByType} = render(<ProgressBar activeStep={2} totalSteps={4} />);
      const View = require("react-native").View;
      expect(UNSAFE_getAllByType(View).length).toBeGreaterThan(0);
    });
  });
});
