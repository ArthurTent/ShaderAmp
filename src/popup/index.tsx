import * as React from "react";
import {createRoot} from "react-dom/client";
import browser from "webextension-polyfill";
import { Popup } from "./popup";
import "../css/app.css";

browser.tabs.query({ active: true, currentWindow: true }).then(() => {
    const container = document.getElementById('popup');
    const root = createRoot(container!);
    root.render(<Popup />);
});
