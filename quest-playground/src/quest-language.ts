import type * as Monaco from "monaco-editor";

export function registerQuestLanguage(monaco: typeof Monaco) {
  // Prevent double-registration on hot reload
  if (monaco.languages.getLanguages().some(l => l.id === "quest")) return;

  monaco.languages.register({ id: "quest" });

  monaco.languages.setMonarchTokensProvider("quest", {
    keywords: [
      "quest", "reward", "equip", "enchant", "embark", "otherwise",
      "patrol", "loot", "from", "retreat", "rest", "guild", "initiate",
      "summon", "inherit", "announce", "chronicle", "as", "seal",
      "perish", "survive", "fallen", "alive", "dead", "null",
      "legend", "prophecy", "sacred", "self",
    ],

    tokenizer: {
      root: [
        // Comments: ~ ... ~ or ~ to end of line
        [/~[^~]*~/, "comment"],
        [/~.*$/, "comment"],

        // Strings
        [/"([^"\\]|\\.)*"/, "string"],

        // Numbers
        [/\d+(\.\d+)?/, "number"],

        // Keywords and identifiers
        [/[a-zA-Z_]\w*/, {
          cases: {
            "@keywords": "keyword",
            "@default":  "identifier",
          },
        }],

        // Operators
        [/==|!=|<=|>=|&&|\|\|/, "operator"],
        [/[+\-*/%=<>!]/, "operator"],

        // Brackets
        [/[{}()\[\]]/, "delimiter"],

        // Punctuation
        [/[.,:]/, "punctuation"],
      ],
    },
  });

  monaco.languages.setLanguageConfiguration("quest", {
    comments: { lineComment: "~" },
    brackets: [
      ["{", "}"],
      ["(", ")"],
      ["[", "]"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "(", close: ")" },
      { open: "[", close: "]" },
      { open: '"', close: '"' },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "(", close: ")" },
      { open: "[", close: "]" },
      { open: '"', close: '"' },
    ],
    indentationRules: {
      increaseIndentPattern: /^.*\{[^}]*$/,
      decreaseIndentPattern: /^\s*\}/,
    },
  });

  monaco.editor.defineTheme("quest-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword",     foreground: "a89dff", fontStyle: "bold" },
      { token: "string",      foreground: "5dcaa5" },
      { token: "number",      foreground: "ef9f27" },
      { token: "comment",     foreground: "555566", fontStyle: "italic" },
      { token: "identifier",  foreground: "e8e6e0" },
      { token: "operator",    foreground: "888899" },
      { token: "delimiter",   foreground: "666677" },
      { token: "punctuation", foreground: "666677" },
    ],
    colors: {
      "editor.background":          "#0f0f13",
      "editor.foreground":          "#e8e6e0",
      "editor.lineHighlightBackground": "#1a1a24",
      "editorLineNumber.foreground":    "#444455",
      "editorLineNumber.activeForeground": "#a89dff",
      "editor.selectionBackground": "#2a2840",
      "editorCursor.foreground":    "#a89dff",
      "editorIndentGuide.background1": "#1e1e2e",
    },
  });
}