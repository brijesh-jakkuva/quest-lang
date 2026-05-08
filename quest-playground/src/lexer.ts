export type TokenType =
  | "KEYWORD" | "IDENTIFIER" | "NUMBER" | "STRING"
  | "BOOLEAN" | "NULL" | "LPAREN" | "RPAREN"
  | "LBRACE" | "RBRACE" | "LBRACKET" | "RBRACKET"
  | "COMMA" | "DOT" | "COLON" | "PLUS" | "MINUS"
  | "STAR" | "SLASH" | "PERCENT" | "EQ" | "EQEQ"
  | "NEQ" | "LT" | "GT" | "LTE" | "GTE"
  | "AND" | "OR" | "NOT" | "ASSIGN" | "EOF";

  export const KEYWORDS = new Set([
    "quest", "reward", "equip", "enchant", "embark", "otherwise",
    "patrol", "loot", "from", "retreat", "rest", "guild", "initiate",
    "summon", "inherit", "announce", "chronicle", "as", "seal",
    "perish", "survive", "fallen", "alive", "dead", "null",
    "legend", "prophecy", "sacred", "self"
  ]);

export interface Token {
  type: TokenType;
  value: string;
  line: number;
}

export function tokenise(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;

  while (i < source.length) {
    const c = source.charAt(i);
    // Skip whitespace
    if (/\s/.test(c)) {
      if (c === "\n") line++;
      i++;
      continue;
    }

    // Skip comments ~ ... ~ or ~ to end of line
    if (c === "~") {
      i++;
      if (source.charAt(i) === " " || source.charAt(i - 1) === "~") {
        while (i < source.length && source.charAt(i) !== "~" && source.charAt(i) !== "\n") i++;
        if (source.charAt(i) === "~") i++;
      }
      continue;
    }

    // String literals
    if (c === '"') {
      let str = "";
      i++;
      while (i < source.length && source.charAt(i) !== '"') {
        str += source.charAt(i);
        i++;
      }
      i++;
      tokens.push({ type: "STRING", value: str, line });
      continue;
    }

    // Numbers
    if (/[0-9]/.test(c)) {
      let num = "";
      while (i < source.length && /[0-9.]/.test(source.charAt(i))) num += source.charAt(i++);
      tokens.push({ type: "NUMBER", value: num, line });
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(c)) {
      let word = "";
      while (i < source.length && /[a-zA-Z0-9_]/.test(source.charAt(i))) word += source.charAt(i++);
      if (word === "alive" || word === "dead") {
        tokens.push({ type: "BOOLEAN", value: word, line });
      } else if (word === "null") {
        tokens.push({ type: "NULL", value: "null", line });
      } else if (KEYWORDS.has(word)) {
        tokens.push({ type: "KEYWORD", value: word, line });
      } else {
        tokens.push({ type: "IDENTIFIER", value: word, line });
      }
      continue;
    }

    // Two-character operators
    const two = source.slice(i, i + 2);
    if (two === "==") { tokens.push({ type: "EQEQ",  value: "==", line }); i += 2; continue; }
    if (two === "!=") { tokens.push({ type: "NEQ",   value: "!=", line }); i += 2; continue; }
    if (two === "<=") { tokens.push({ type: "LTE",   value: "<=", line }); i += 2; continue; }
    if (two === ">=") { tokens.push({ type: "GTE",   value: ">=", line }); i += 2; continue; }
    if (two === "&&") { tokens.push({ type: "AND",   value: "&&", line }); i += 2; continue; }
    if (two === "||") { tokens.push({ type: "OR",    value: "||", line }); i += 2; continue; }

    // Single-character tokens
    const single: Record<string, TokenType> = {
      "(": "LPAREN",  ")": "RPAREN",
      "{": "LBRACE",  "}": "RBRACE",
      "[": "LBRACKET","]": "RBRACKET",
      ",": "COMMA",   ".": "DOT",
      ":": "COLON",   "+": "PLUS",
      "-": "MINUS",   "*": "STAR",
      "/": "SLASH",   "%": "PERCENT",
      "=": "ASSIGN",  "<": "LT",
      ">": "GT",      "!": "NOT",
    };
    const singleChar = source.charAt(i);
    if (single[singleChar]) {
      tokens.push({ type: single[singleChar], value: singleChar, line });
      i++;
      continue;
    }

    // Unknown character — skip with a warning
    console.warn(`Unknown character '${singleChar}' at line ${line}`);
    i++;
  }

  tokens.push({ type: "EOF", value: "", line });
  return tokens;
}