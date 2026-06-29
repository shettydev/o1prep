import { createTheme } from "@uiw/codemirror-themes";
import { tags as t } from "@lezer/highlight";

// Amber-phosphor CodeMirror 6 theme matching the terminal design system.
export const terminalTheme = createTheme({
  theme: "dark",
  settings: {
    background: "#070605",
    foreground: "#ece4ce",
    caret: "#ffb000",
    selection: "rgba(255,176,0,0.20)",
    selectionMatch: "rgba(255,176,0,0.12)",
    lineHighlight: "rgba(255,176,0,0.04)",
    gutterBackground: "#070605",
    gutterForeground: "#5f5848",
    gutterBorder: "transparent",
    fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
  },
  styles: [
    { tag: t.comment, color: "#5f5848", fontStyle: "italic" },
    { tag: [t.keyword, t.operatorKeyword, t.moduleKeyword], color: "#ffb000" },
    { tag: [t.string, t.special(t.string)], color: "#46d68a" },
    {
      tag: [t.function(t.variableName), t.function(t.propertyName)],
      color: "#ffce5c",
    },
    { tag: [t.number, t.bool, t.null], color: "#f5c518" },
    {
      tag: [t.className, t.typeName, t.definition(t.typeName)],
      color: "#ffce5c",
    },
    { tag: t.variableName, color: "#ece4ce" },
    { tag: t.propertyName, color: "#9a907a" },
    { tag: [t.operator, t.bracket, t.punctuation, t.separator], color: "#9a907a" },
    { tag: t.definition(t.variableName), color: "#ece4ce" },
    { tag: [t.regexp, t.escape], color: "#46d68a" },
  ],
});
