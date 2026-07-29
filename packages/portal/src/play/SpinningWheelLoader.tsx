import {tr} from "./i18n";

export function SpinningWheel() {
  return <span className="spinning-wheel-graphic" aria-hidden="true" />;
}

export function SpinningWheelLoader({
  overlay = false,
  className = "",
}: {
  overlay?: boolean;
  className?: string;
}) {
  const classes = [
    "spinning-wheel-loader",
    overlay ? "spinning-wheel-loader-overlay" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      role="status"
      aria-live="polite"
      aria-label={tr("Accessibility.LOADING")}
      data-testid={overlay ? "server-activity-loader" : "preloader"}
    >
      <SpinningWheel />
    </div>
  );
}
