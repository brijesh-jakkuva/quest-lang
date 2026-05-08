import * as fs from "fs";
import * as path from "path";
import { tokenise } from "./lexer.js";
import { Parser } from "./parser.js";
import { Interpreter } from "./interpreter.js";

const THEMES: Record<string, { icon: string; flavour: string }> = {
  CursedScrollException:     { icon: "📜", flavour: "Your scroll contains forbidden runes." },
  NullTreasureException:     { icon: "👻", flavour: "You reached into the chest and found only shadow." },
  UnknownQuestException:     { icon: "🗺️ ", flavour: "No quest by that name exists in this realm." },
  InventoryOverflowException:{ icon: "🎒", flavour: "Your bag cannot hold what you are reaching for." },
  WrongGuildException:       { icon: "⚔️ ", flavour: "That skill belongs to a different guild." },
  BetrayalException:         { icon: "🔐", flavour: "You tried to change something sacred." },
  InfinitePatrolException:   { icon: "🔁", flavour: "Your patrol has no end — the hero wanders forever." },
};

function printError(e: any): void {
  const raw = e?.message ?? String(e);

  // Extract exception type from message if present e.g. [NullTreasureException]
  const typeMatch = raw.match(/\[(\w+Exception)\]/);
  const type  = typeMatch?.[1] ?? "QuestException";
  const theme = THEMES[type] ?? { icon: "💀", flavour: "An unknown curse has struck the realm." };

  console.error(`
${theme.icon}  ${type}
${"─".repeat(44)}
${raw.replace(/\[\w+Exception\]\s*/, "")}

${theme.flavour}
${"─".repeat(44)}
`);
}

const file = process.argv[2];

if (!file) {
  console.log(`
╔══════════════════════════════════╗
║   QUEST Language Interpreter     ║
║   v1.0 — May your code not perish║
╚══════════════════════════════════╝

Usage: npm run quest <file.qst>

Examples:
  npm run quest examples/hello.qst
  npm run quest examples/battle.qst
  npm run quest examples/vault.qst
  `);
  process.exit(0);
}

const filePath = path.resolve(file);

if (!fs.existsSync(filePath)) {
  printError({ message: "[CursedScrollException] File not found: " + filePath });
  process.exit(1);
}

const source = fs.readFileSync(filePath, "utf-8");

try {
  const tokens = tokenise(source);
  const ast    = new Parser(tokens).parse();
  const interp = new Interpreter();
  interp.run(ast);
  interp.output.forEach(line => console.log(line));
} catch (e: any) {
  printError(e);
  process.exit(1);
}