# QUEST Programming Language

A fantasy-themed programming language where every line of code reads like an RPG adventure.

## Try it live
[quest-lang-fs7xf0sk3-jbrijeshkumar-2966s-projects.vercel.app](https://quest-lang-fs7xf0sk3-jbrijeshkumar-2966s-projects.vercel.app)

## What is QUEST?
QUEST is a fully interpreted programming language built from scratch in TypeScript.
Instead of `if`, you write `embark`. Instead of `while`, you write `patrol`.
Instead of `class`, you found a `guild`. Errors aren't exceptions - they're curses.

## Language features
- Variables: `equip` and `enchant`
- Functions: `quest` / `reward`
- Classes: `guild` / `initiate` / `summon`
- Loops: `patrol` (while) and `loot from` (for-of)
- Error handling: `survive` / `fallen` / `perish`
- Built-in: `roll(n)` for true random dice rolls
- Themed exceptions: `NullTreasureException`, `CursedScrollException`, and more

## Example

```
guild Hero {
  initiate(name) {
    self.name = name
    self.hp   = 100
  }
  quest smite(target) {
    equip dmg = roll(18)
    target.hp = target.hp - dmg
    announce self.name + " strikes for " + dmg + " damage!"
  }
}

equip hero    = summon Hero("Aldric")
equip monster = summon Hero("Cave Troll")
hero.smite(monster)
```

## Repo structure
```
quest-lang/        <- TypeScript interpreter + CLI
quest-playground/  <- React web playground (Monaco editor)
```

## Run locally

### CLI
```bash
cd quest-lang
npm install
npm run quest examples/battle.qst
```

### Playground
```bash
cd quest-playground
npm install
npm run dev
```

## Built with
- TypeScript - lexer, parser, tree-walk interpreter
- React + Vite - web playground
- Monaco Editor - syntax highlighting with custom QUEST theme
- Vercel - deployment

## Author
Built as a portfolio project. Designed and implemented from scratch -
lexer, parser, interpreter, IDE, and deployment pipeline.
