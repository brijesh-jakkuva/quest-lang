import type { Node } from "./parser.js";

class QuestError {
  constructor(public value: unknown) {}
}
class ReturnSignal {
  constructor(public value: unknown) {}
}
class RetreatSignal {}
class RestSignal {}

type QuestFunction = {
  kind: "function";
  params: string[];
  body: Node[];
  closure: Environment;
};

type GuildInstance = {
  kind: "instance";
  guildName: string;
  fields: Record<string, unknown>;
  methods: Record<string, QuestFunction>;
};

class Environment {
  private vars = new Map<string, unknown>();
  private constants = new Set<string>();

  constructor(private parent?: Environment) {}

  get(name: string): unknown {
    if (this.vars.has(name)) return this.vars.get(name);
    if (this.parent) return this.parent.get(name);
    throw new QuestError({ type: "UnknownQuestException", message: `'${name}' has not been defined.` });
  }

  set(name: string, value: unknown, constant = false): void {
    if (this.constants.has(name))
      throw new QuestError({ type: "BetrayalException", message: `'${name}' is enchanted and cannot be changed.` });
    this.vars.set(name, value);
    if (constant) this.constants.add(name);
  }

  assign(name: string, value: unknown): void {
    if (this.vars.has(name)) {
      if (this.constants.has(name))
        throw new QuestError({ type: "BetrayalException", message: `'${name}' is enchanted and cannot be changed.` });
      this.vars.set(name, value);
      return;
    }
    if (this.parent) { this.parent.assign(name, value); return; }
    throw new QuestError({ type: "UnknownQuestException", message: `'${name}' has not been defined.` });
  }
}

export class Interpreter {
  private globals = new Environment();
  public output: string[] = [];

  constructor() {
    // Built-in: roll(n)
    this.globals.set("roll", {
      kind: "function",
      params: ["n"],
      body: [],
      closure: this.globals,
      builtin: (n: unknown) => Math.floor(Math.random() * Number(n)) + 1,
    } as any);

    // Built-in: Math helpers
    this.globals.set("Math", {
      floor: Math.floor,
      ceil:  Math.ceil,
      round: Math.round,
      min:   Math.min,
      max:   Math.max,
      abs:   Math.abs,
    });
  }

  run(program: import("./parser.js").ProgramNode): void {
    this.output = [];
    this.execBlock(program.body, this.globals);
  }

  private execBlock(nodes: Node[], env: Environment): void {
    for (const node of nodes) {
      const sig = this.exec(node, env);
      if (sig instanceof ReturnSignal || sig instanceof RetreatSignal || sig instanceof RestSignal) {
        throw sig;
      }
    }
  }

  private exec(node: Node, env: Environment): unknown {
    switch (node.kind) {
      case "VarDecl": {
        const val = this.eval(node.value, env);
        env.set(node.name, val, node.constant);
        return null;
      }

      case "Assign": {
        const val = this.eval(node.value, env);
        if (node.target.kind === "Identifier") {
          env.assign(node.target.name, val);
        } else if (node.target.kind === "MemberExpr") {
          const obj = this.eval(node.target.object, env) as any;
          if (obj?.kind === "instance") {
            obj.fields[node.target.property] = val;
          } else if (obj && typeof obj === "object") {
            obj[node.target.property] = val;
          }
        } else if (node.target.kind === "IndexExpr") {
          const obj = this.eval(node.target.object, env) as any[];
          const idx = this.eval(node.target.index, env) as number;
          obj[idx] = val;
        }
        return val;
      }

      case "Announce": {
        const val = this.eval(node.value, env);
        const str = this.stringify(val);
        this.output.push(str);
        return null;
      }

      case "If": {
        if (this.isTruthy(this.eval(node.condition, env))) {
          this.execBlock(node.then, new Environment(env));
        } else {
          let handled = false;
          for (const ei of node.elseIfs) {
            if (this.isTruthy(this.eval(ei.condition, env))) {
              this.execBlock(ei.body, new Environment(env));
              handled = true;
              break;
            }
          }
          if (!handled && node.else_.length > 0) {
            this.execBlock(node.else_, new Environment(env));
          }
        }
        return null;
      }

      case "Patrol": {
        while (this.isTruthy(this.eval(node.condition, env))) {
          try {
            this.execBlock(node.body, new Environment(env));
          } catch (sig) {
            if (sig instanceof RetreatSignal) break;
            if (sig instanceof RestSignal) continue;
            throw sig;
          }
        }
        return null;
      }

      case "Loot": {
        const collection = this.eval(node.collection, env);
        if (!Array.isArray(collection))
          throw new QuestError({ type: "WrongGuildException", message: "loot requires an inventory (array)." });
        for (const item of collection) {
          const loopEnv = new Environment(env);
          loopEnv.set(node.item, item);
          try {
            this.execBlock(node.body, loopEnv);
          } catch (sig) {
            if (sig instanceof RetreatSignal) break;
            if (sig instanceof RestSignal) continue;
            throw sig;
          }
        }
        return null;
      }

      case "Quest": {
        const fn: QuestFunction = { kind: "function", params: node.params, body: node.body, closure: env };
        env.set(node.name, fn);
        return null;
      }

      case "Guild": {
        env.set(node.name, { kind: "guild", node });
        return null;
      }

      case "Return": {
        throw new ReturnSignal(node.value ? this.eval(node.value, env) : null);
      }

      case "Retreat": throw new RetreatSignal();
      case "Rest":    throw new RestSignal();

      case "Survive": {
        try {
          this.execBlock(node.body, new Environment(env));
        } catch (e) {
          if (e instanceof QuestError) {
            const fallenEnv = new Environment(env);
            fallenEnv.set(node.errorName, e.value);
            this.execBlock(node.fallen, fallenEnv);
          } else {
            throw e;
          }
        }
        return null;
      }

      case "Perish": {
        throw new QuestError(this.eval(node.value, env));
      }

      default:
        return this.eval(node, env);
    }
  }

  private eval(node: Node, env: Environment): unknown {
    switch (node.kind) {
      case "NumberLiteral": return node.value;
      case "StringLiteral": return node.value;
      case "BoolLiteral":   return node.value;
      case "NullLiteral":   return null;

      case "Identifier": return env.get(node.name);

      case "ArrayLiteral": return node.elements.map(e => this.eval(e, env));

      case "BinaryExpr": {
        const left  = this.eval(node.left,  env);
        const right = this.eval(node.right, env);
        switch (node.op) {
          case "+":  return typeof left === "string" || typeof right === "string"
                       ? String(left) + String(right)
                       : (left as number) + (right as number);
          case "-":  return (left as number) - (right as number);
          case "*":  return (left as number) * (right as number);
          case "/":  return (left as number) / (right as number);
          case "%":  return (left as number) % (right as number);
          case ">":  return (left as number) > (right as number);
          case "<":  return (left as number) < (right as number);
          case ">=": return (left as number) >= (right as number);
          case "<=": return (left as number) <= (right as number);
          case "==": return left === right;
          case "!=": return left !== right;
          case "&&": return this.isTruthy(left) && this.isTruthy(right);
          case "||": return this.isTruthy(left) || this.isTruthy(right);
        }
        break;
      }

      case "UnaryExpr": {
        const val = this.eval(node.operand, env);
        if (node.op === "!") return !this.isTruthy(val);
        if (node.op === "-") return -(val as number);
        break;
      }

      case "MemberExpr": {
        const obj = this.eval(node.object, env) as any;
        if (obj?.kind === "instance") {
          if (node.property in obj.fields) return obj.fields[node.property];
          if (node.property in obj.methods) return obj.methods[node.property];
          throw new QuestError({ type: "NullTreasureException", message: `'${node.property}' not found on ${obj.guildName}.` });
        }
        if (obj && typeof obj === "object") return obj[node.property];
        throw new QuestError({ type: "NullTreasureException", message: `Cannot access '${node.property}' on null.` });
      }

      case "IndexExpr": {
        const obj = this.eval(node.object, env);
        const idx = this.eval(node.index, env) as number;
        if (!Array.isArray(obj))
          throw new QuestError({ type: "InventoryOverflowException", message: "Index access requires an inventory." });
        if (idx < 0 || idx >= obj.length)
          throw new QuestError({ type: "InventoryOverflowException", message: `Index ${idx} is out of bounds.` });
        return obj[idx];
      }

      case "Summon": {
        const guildDef = env.get(node.guild) as any;
        if (!guildDef || guildDef.kind !== "guild")
          throw new QuestError({ type: "UnknownQuestException", message: `No guild named '${node.guild}'.` });

        const instance: GuildInstance = {
          kind: "instance",
          guildName: node.guild,
          fields: {},
          methods: {},
        };

        // Register methods
        for (const method of guildDef.node.methods) {
          instance.methods[method.name] = { kind: "function", params: method.params, body: method.body, closure: env };
        }

        // Run initiate
        if (guildDef.node.initiate) {
          const args = node.args.map(a => this.eval(a, env));
          const initEnv = new Environment(env);
          initEnv.set("self", instance);
          guildDef.node.initiate.params.forEach((p: string, i: number) => initEnv.set(p, args[i] ?? null));
          try { this.execBlock(guildDef.node.initiate.body, initEnv); } catch (e) {
            if (!(e instanceof ReturnSignal)) throw e;
          }
        }

        return instance;
      }

      case "CallExpr": {
        const callee = this.eval(node.callee, env) as any;
        const args   = node.args.map(a => this.eval(a, env));

        // Built-in function
        if (callee?.builtin) return callee.builtin(...args);

        // Method call on instance
        if (node.callee.kind === "MemberExpr") {
          const obj = this.eval((node.callee as any).object, env) as GuildInstance;
          const methodName = (node.callee as any).property;

          if (obj?.kind === "instance") {
            const method = obj.methods[methodName];
            if (!method) throw new QuestError({ type: "UnknownQuestException", message: `No quest '${methodName}' on ${obj.guildName}.` });
            const callEnv = new Environment(method.closure);
            callEnv.set("self", obj);
            method.params.forEach((p, i) => callEnv.set(p, args[i] ?? null));
            try { this.execBlock(method.body, callEnv); }
            catch (e) { if (e instanceof ReturnSignal) return e.value; throw e; }
            return null;
          }

          // Native object method (e.g. Math.min)
          if (obj && typeof obj === "object") {
            const fn = (obj as any)[methodName];
            if (typeof fn === "function") return fn(...args);
          }
        }

        // Regular quest call
        if (!callee || callee.kind !== "function")
          throw new QuestError({ type: "UnknownQuestException", message: `Not a callable quest.` });

        const callEnv = new Environment(callee.closure);
        callee.params.forEach((p: string, i: number) => callEnv.set(p, args[i] ?? null));
        try { this.execBlock(callee.body, callEnv); }
        catch (e) { if (e instanceof ReturnSignal) return e.value; throw e; }
        return null;
      }

      default:
        return this.exec(node, env);
    }

    return null;
  }

  private isTruthy(val: unknown): boolean {
    if (val === null || val === false || val === 0 || val === "") return false;
    return true;
  }

  private stringify(val: unknown): string {
    if (val === null) return "null";
    if (typeof val === "boolean") return val ? "alive" : "dead";
    if (Array.isArray(val)) return "[" + val.map(v => this.stringify(v)).join(", ") + "]";
    if (val && typeof val === "object" && (val as any).kind === "instance")
      return `[${(val as GuildInstance).guildName} instance]`;
    return String(val);
  }
}