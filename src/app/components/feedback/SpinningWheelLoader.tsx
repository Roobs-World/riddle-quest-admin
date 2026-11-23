import {tr} from "../../../localization/browser/i18n";

/** Defines the spinner dot count value. */
const SPINNER_DOT_COUNT = 8;

/** Provides spinning wheel behavior. */
export function SpinningWheel() {
  return <span className="spinning-wheel-graphic" aria-hidden="true" />;
}

/** Provides pulsing spinner behavior. */
export function PulsingSpinner() {
  return (
    <span className="pulsing-spinner" aria-hidden="true">
      {Array.from({length: SPINNER_DOT_COUNT}, (_, index) => (
        <span className="pulsing-spinner-dot" data-testid="spinner-dot" key={index} />
      ))}
    </span>
  );
}

/** Provides spinning wheel loader behavior. */
export function SpinningWheelLoader({
  overlay = false,
  className = "",
  message,
  progress,
}: {
  /** Stores overlay. */
  overlay?: boolean;
  /** Stores class name. */
  className?: string;
  /** Stores message. */
  message?: string;
  /** Stores progress. */
  progress?: number;
}) {
  /** Provides classes behavior. */
  const classes = ["spinning-wheel-loader", overlay ? "spinning-wheel-loader-overlay" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      role="status"
      aria-live="polite"
      aria-label={message ?? tr("Accessibility.LOADING")}
      data-testid={overlay ? "server-activity-loader" : "preloader"}
    >
      <PulsingSpinner />
      {message ? (
        <div className="spinning-wheel-loader-status">
          <strong>{message}</strong>
          {typeof progress === "number" ? (
            <>
              <progress max={100} value={progress} aria-label={`${Math.round(progress)}%`} />
              <span>{Math.round(progress)}%</span>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
