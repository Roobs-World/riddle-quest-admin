import "./browserValidation";
import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Notification manager root is missing.");
const application = createRoot(root);
if (location.pathname === "/push/" || location.pathname === "/push") {
  void import("./PushEnrollment").then(({PushEnrollment, retireBrowserPush}) => {
    retireBrowserPush();
    application.render(<PushEnrollment />);
  });
} else {
  void import("./App").then(({App}) => application.render(<StrictMode><App /></StrictMode>));
}
