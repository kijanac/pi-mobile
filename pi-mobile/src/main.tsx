/* @refresh reload */
import { render } from "solid-js/web";
import "./index.css";
import App from "./App";
import { installAppLifecycle } from "./lib/lifecycle";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
installAppLifecycle();
render(() => <App />, root);
