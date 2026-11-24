import "./browserValidation";
import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Notification manager root is missing.");
const application = createRoot(root);
if (location.pathname === "/push/" || location.pathname === "/push") {
  const manifest = document.createElement("link");
  manifest.rel = "manifest";
  manifest.href = "/push/manifest.webmanifest";
  document.head.append(manifest);
  const icon = document.createElement("link");
  icon.rel = "apple-touch-icon";
  icon.href = "/push/icon.png";
  document.head.append(icon);
  void import("./PushEnrollment").then(({PushEnrollment}) => application.render(<StrictMode><PushEnrollment /></StrictMode>));
} else {
  void import("./App").then(({App}) => application.render(<StrictMode><App /></StrictMode>));
}
