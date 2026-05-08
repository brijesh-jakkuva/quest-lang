import type { Token, TokenType } from "./lexer.js";

export type Node =
  | ProgramNode | VarDeclNode | AnnounceNode | AssignNode
  | IfNode | PatrolNode | LootNode | QuestNode | ReturnNode
  | GuildNode | SummonNode | MemberExprNode | CallExprNode
  | BinaryExprNode | UnaryExprNode | IdentifierNode
  | NumberLiteralNode | StringLiteralNode | BoolLiteralNode
  | NullLiteralNode | ArrayLiteralNode | IndexExprNode
  | SurviveNode | PerishNode | RetreatNode | RestNode;

export interface ProgramNode       { kind: "Program";       body: Node[] }
export interface VarDeclNode       { kind: "VarDecl";       name: string; value: Node; constant: boolean }
export interface AnnounceNode      { kind: "Announce";      value: Node }
export interface AssignNode        { kind: "Assign";        target: Node; value: Node }
export interface IfNode            { kind: "If";            condition: Node; then: Node[]; elseIfs: {condition: Node; body: Node[]}[]; else_: Node[] }
export interface PatrolNode        { kind: "Patrol";        condition: Node; body: Node[] }
export interface LootNode          { kind: "Loot";          item: string; collection: Node; body: Node[] }
export interface QuestNode         { kind: "Quest";         name: string; params: string[]; body: Node[] }
export interface ReturnNode        { kind: "Return";        value: Node | null }
export interface GuildNode         { kind: "Guild";         name: string; methods: QuestNode[]; initiate: QuestNode | null }
export interface SummonNode        { kind: "Summon";        guild: string; args: Node[] }
export interface MemberExprNode    { kind: "MemberExpr";    object: Node; property: string }
export interface CallExprNode      { kind: "CallExpr";      callee: Node; args: Node[] }
export interface BinaryExprNode    { kind: "BinaryExpr";    op: string; left: Node; right: Node }
export interface UnaryExprNode     { kind: "UnaryExpr";     op: string; operand: Node }
export interface IdentifierNode    { kind: "Identifier";    name: string }
export interface NumberLiteralNode { kind: "NumberLiteral"; value: number }
export interface StringLiteralNode { kind: "StringLiteral"; value: string }
export interface BoolLiteralNode   { kind: "BoolLiteral";   value: boolean }
export interface NullLiteralNode   { kind: "NullLiteral" }
export interface ArrayLiteralNode  { kind: "ArrayLiteral";  elements: Node[] }
export interface IndexExprNode     { kind: "IndexExpr";     object: Node; index: Node }
export interface SurviveNode       { kind: "Survive";       body: Node[]; errorName: string; fallen: Node[] }
export interface PerishNode        { kind: "Perish";        value: Node }
export interface RetreatNode       { kind: "Retreat" }
export interface RestNode          { kind: "Rest" }

export class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token { return this.tokens[this.pos]!; }
  private prev(): Token { return this.tokens[this.pos - 1]!; }
  private advance(): Token { return this.tokens[this.pos++]!; }
  private isAtEnd(): boolean { return this.peek().type === "EOF"; }

  private check(type: TokenType, value?: string): boolean {
    if (this.isAtEnd()) return false;
    const t = this.peek();
    return t.type === type && (value === undefined || t.value === value);
  }

  private match(type: TokenType, value?: string): boolean {
    if (this.check(type, value)) { this.advance(); return true; }
    return false;
  }

  private expect(type: TokenType, value?: string): Token {
    if (this.check(type, value)) return this.advance();
    const t = this.peek();
    throw new Error(`[CursedScrollException] Expected ${value ?? type} but got '${t.value}' at line ${t.line}`);
  }

  parse(): ProgramNode {
    const body: Node[] = [];
    while (!this.isAtEnd()) body.push(this.parseStatement());
    return { kind: "Program", body };
  }

  private parseStatement(): Node {
    const t = this.peek();

    if (t.type === "KEYWORD") {
      switch (t.value) {
        case "equip":    return this.parseVarDecl(false);
        case "enchant":  return this.parseVarDecl(true);
        case "announce": return this.parseAnnounce();
        case "embark":   return this.parseIf();
        case "patrol":   return this.parsePatrol();
        case "loot":     return this.parseLoot();
        case "quest":    return this.parseQuest();
        case "guild":    return this.parseGuild();
        case "reward":   return this.parseReturn();
        case "survive":  return this.parseSurvive();
        case "perish":   return this.parsePerish();
        case "retreat":  this.advance(); return { kind: "Retreat" };
        case "rest":     this.advance(); return { kind: "Rest" };
      }
    }

    return this.parseExprStatement();
  }

  private parseVarDecl(constant: boolean): VarDeclNode {
    this.advance(); // equip / enchant
    const name = this.expect("IDENTIFIER").value;
    // optional type annotation — skip it
    if (this.match("COLON")) this.advance();
    this.expect("ASSIGN");
    const value = this.parseExpr();
    return { kind: "VarDecl", name, value, constant };
  }

  private parseAnnounce(): AnnounceNode {
    this.advance();
    return { kind: "Announce", value: this.parseExpr() };
  }

  private parseIf(): IfNode {
    this.advance(); // embark
    const condition = this.parseExpr();
    this.expect("LBRACE");
    const then = this.parseBlock();

    const elseIfs: { condition: Node; body: Node[] }[] = [];
    let else_: Node[] = [];

    while (this.check("KEYWORD", "otherwise")) {
      this.advance();
      if (this.check("KEYWORD", "embark")) {
        this.advance();
        const c = this.parseExpr();
        this.expect("LBRACE");
        elseIfs.push({ condition: c, body: this.parseBlock() });
      } else {
        this.expect("LBRACE");
        else_ = this.parseBlock();
        break;
      }
    }

    return { kind: "If", condition, then, elseIfs, else_ };
  }

  private parsePatrol(): PatrolNode {
    this.advance();
    const condition = this.parseExpr();
    this.expect("LBRACE");
    return { kind: "Patrol", condition, body: this.parseBlock() };
  }

  private parseLoot(): LootNode {
    this.advance();
    const item = this.expect("IDENTIFIER").value;
    this.expect("KEYWORD", "from");
    const collection = this.parseExpr();
    this.expect("LBRACE");
    return { kind: "Loot", item, collection, body: this.parseBlock() };
  }

  private parseQuest(): QuestNode {
    this.advance();
    const name = this.expect("IDENTIFIER").value;
    this.expect("LPAREN");
    const params: string[] = [];
    while (!this.check("RPAREN")) {
      params.push(this.expect("IDENTIFIER").value);
      if (this.check("COLON")) { this.advance(); this.advance(); }
      if (!this.check("RPAREN")) this.expect("COMMA");
    }
    this.expect("RPAREN");
    this.expect("LBRACE");
    return { kind: "Quest", name, params, body: this.parseBlock() };
  }

  private parseGuild(): GuildNode {
    this.advance();
    const name = this.expect("IDENTIFIER").value;
    this.expect("LBRACE");
    let initiate: QuestNode | null = null;
    const methods: QuestNode[] = [];
    while (!this.check("RBRACE") && !this.isAtEnd()) {
      if (this.check("KEYWORD", "initiate")) {
        this.advance();
        this.expect("LPAREN");
        const params: string[] = [];
        while (!this.check("RPAREN")) {
          params.push(this.expect("IDENTIFIER").value);
          if (this.check("COLON")) { this.advance(); this.advance(); }
          if (!this.check("RPAREN")) this.expect("COMMA");
        }
        this.expect("RPAREN");
        this.expect("LBRACE");
        initiate = { kind: "Quest", name: "initiate", params, body: this.parseBlock() };
      } else if (this.check("KEYWORD", "quest")) {
        methods.push(this.parseQuest());
      } else {
        this.advance();
      }
    }
    this.expect("RBRACE");
    return { kind: "Guild", name, initiate, methods };
  }

  private parseReturn(): ReturnNode {
    this.advance();
    if (this.isAtEnd() || this.check("RBRACE")) return { kind: "Return", value: null };
    return { kind: "Return", value: this.parseExpr() };
  }

  private parseSurvive(): SurviveNode {
    this.advance();
    this.expect("LBRACE");
    const body = this.parseBlock();
    this.expect("KEYWORD", "fallen");
    this.expect("LPAREN");
    const errorName = this.expect("IDENTIFIER").value;
    this.expect("RPAREN");
    this.expect("LBRACE");
    const fallen = this.parseBlock();
    return { kind: "Survive", body, errorName, fallen };
  }

  private parsePerish(): PerishNode {
    this.advance();
    return { kind: "Perish", value: this.parseExpr() };
  }

  private parseBlock(): Node[] {
    const stmts: Node[] = [];
    while (!this.check("RBRACE") && !this.isAtEnd()) stmts.push(this.parseStatement());
    this.expect("RBRACE");
    return stmts;
  }

  private parseExprStatement(): Node {
    const expr = this.parseExpr();
    return expr;
  }

  private parseExpr(): Node { return this.parseAssign(); }

  private parseAssign(): Node {
    const left = this.parseOr();
    if (this.match("ASSIGN")) {
      const value = this.parseAssign();
      return { kind: "Assign", target: left, value };
    }
    return left;
  }

  private parseOr(): Node {
    let left = this.parseAnd();
    while (this.match("OR")) {
      left = { kind: "BinaryExpr", op: "||", left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Node {
    let left = this.parseEquality();
    while (this.match("AND")) {
      left = { kind: "BinaryExpr", op: "&&", left, right: this.parseEquality() };
    }
    return left;
  }

  private parseEquality(): Node {
    let left = this.parseComparison();
    while (this.check("EQEQ") || this.check("NEQ")) {
      const op = this.advance().value;
      left = { kind: "BinaryExpr", op, left, right: this.parseComparison() };
    }
    return left;
  }

  private parseComparison(): Node {
    let left = this.parseAddSub();
    while (["LT","GT","LTE","GTE"].includes(this.peek().type)) {
      const op = this.advance().value;
      left = { kind: "BinaryExpr", op, left, right: this.parseAddSub() };
    }
    return left;
  }

  private parseAddSub(): Node {
    let left = this.parseMulDiv();
    while (this.check("PLUS") || this.check("MINUS")) {
      const op = this.advance().value;
      left = { kind: "BinaryExpr", op, left, right: this.parseMulDiv() };
    }
    return left;
  }

  private parseMulDiv(): Node {
    let left = this.parseUnary();
    while (this.check("STAR") || this.check("SLASH") || this.check("PERCENT")) {
      const op = this.advance().value;
      left = { kind: "BinaryExpr", op, left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): Node {
    if (this.check("NOT")) {
      this.advance();
      return { kind: "UnaryExpr", op: "!", operand: this.parseUnary() };
    }
    if (this.check("MINUS")) {
      this.advance();
      return { kind: "UnaryExpr", op: "-", operand: this.parseUnary() };
    }
    return this.parseCallMember();
  }

  private parseCallMember(): Node {
    let expr = this.parsePrimary();

    while (true) {
      if (this.match("DOT")) {
        const prop = this.expect("IDENTIFIER").value;
        expr = { kind: "MemberExpr", object: expr, property: prop };
      } else if (this.check("LPAREN")) {
        this.advance();
        const args: Node[] = [];
        while (!this.check("RPAREN")) {
          args.push(this.parseExpr());
          if (!this.check("RPAREN")) this.expect("COMMA");
        }
        this.expect("RPAREN");
        expr = { kind: "CallExpr", callee: expr, args };
      } else if (this.match("LBRACKET")) {
        const index = this.parseExpr();
        this.expect("RBRACKET");
        expr = { kind: "IndexExpr", object: expr, index };
      } else {
        break;
      }
    }

    return expr;
  }

  private parsePrimary(): Node {
    const t = this.peek();

    if (t.type === "NUMBER")  { this.advance(); return { kind: "NumberLiteral", value: Number(t.value) }; }
    if (t.type === "STRING")  { this.advance(); return { kind: "StringLiteral", value: t.value }; }
    if (t.type === "BOOLEAN") { this.advance(); return { kind: "BoolLiteral",   value: t.value === "alive" }; }
    if (t.type === "NULL")    { this.advance(); return { kind: "NullLiteral" }; }

    if (t.type === "KEYWORD" && t.value === "summon") {
      this.advance();
      const guild = this.expect("IDENTIFIER").value;
      this.expect("LPAREN");
      const args: Node[] = [];
      while (!this.check("RPAREN")) {
        args.push(this.parseExpr());
        if (!this.check("RPAREN")) this.expect("COMMA");
      }
      this.expect("RPAREN");
      return { kind: "Summon", guild, args };
    }

    if (t.type === "KEYWORD" && t.value === "self") {
      this.advance();
      return { kind: "Identifier", name: "self" };
    }

    if (t.type === "LBRACKET") {
      this.advance();
      const elements: Node[] = [];
      while (!this.check("RBRACKET")) {
        elements.push(this.parseExpr());
        if (!this.check("RBRACKET")) this.expect("COMMA");
      }
      this.expect("RBRACKET");
      return { kind: "ArrayLiteral", elements };
    }

    if (t.type === "LPAREN") {
      this.advance();
      const expr = this.parseExpr();
      this.expect("RPAREN");
      return expr;
    }

    if (t.type === "IDENTIFIER" || t.type === "KEYWORD") {
      this.advance();
      return { kind: "Identifier", name: t.value };
    }

    throw new Error(`[CursedScrollException] Unexpected token '${t.value}' at line ${t.line}`);
  }
}
