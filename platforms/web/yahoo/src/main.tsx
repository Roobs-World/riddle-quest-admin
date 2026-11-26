import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {YahooApp} from "./YahooApp";
import "../../../../src/gameplay/styles/local-game.css";

const root = document.getElementById("root");
if (!root) throw new Error("yahoo-root-missing");
createRoot(root).render(<StrictMode><YahooApp /></StrictMode>);
