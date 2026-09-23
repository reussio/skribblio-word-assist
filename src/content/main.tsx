import { createRoot } from "react-dom/client";
import { App } from "./App";
import { GameController } from "./GameController";
import "./styles.css";

const wrapperElement = document.createElement("div");
wrapperElement.id = "skribbl-helper-chat-column";

const rootElement = document.createElement("div");
rootElement.id = "skribbl-helper-root";
rootElement.hidden = true;
wrapperElement.appendChild(rootElement);

const controller = new GameController(rootElement, wrapperElement);
createRoot(rootElement).render(<App controller={controller} />);
