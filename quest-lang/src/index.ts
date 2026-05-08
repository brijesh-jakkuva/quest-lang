import { tokenise } from "./lexer.js";
import { Parser } from "./parser.js";
import { Interpreter } from "./interpreter.js";

const source = `
~ Full test ~
quest greet(name) {
  announce "Welcome, " + name + "!"
}

equip hp = 30
greet("Aldric")

embark hp > 50 {
  announce "Battle ready!"
} otherwise {
  announce "Drink a potion, your hp is " + hp
}

equip items = ["sword", "shield", "potion"]
loot item from items {
  announce "Carrying: " + item
}
`;

const tokens = tokenise(source);
const ast    = new Parser(tokens).parse();
const interp = new Interpreter();
interp.run(ast);
interp.output.forEach(line => console.log(line));