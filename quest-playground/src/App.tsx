import { registerQuestLanguage } from "./quest-language";
import { useState, useCallback, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { tokenise } from "./lexer";
import { Parser } from "./parser";
import { Interpreter } from "./interpreter";
import { checkAchievements, Achievement, ACHIEVEMENTS } from "./achievements";

const EXAMPLES: Record<string, string> = {
  "Hello Realm": `~ Hello, realm! ~
equip hero = "Aldric"
equip level = 5

announce "Welcome, " + hero + "!"
announce "You are level " + level

embark level >= 5 {
  announce "Ready to enter the dungeon!"
} otherwise {
  announce "Train more before venturing forth."
}`,

  "Battle": `~ Turn-based battle ~
guild Hero {
  initiate(name) {
    self.name = name
    self.hp = 100
    self.attack = 18
  }
  quest smite(target) {
    equip dmg = roll(self.attack)
    target.hp = target.hp - dmg
    announce self.name + " strikes for " + dmg + " damage!"
  }
}

guild Monster {
  initiate(name, hp) {
    self.name = name
    self.hp = hp
    self.attack = 12
  }
  quest claw(target) {
    equip dmg = roll(self.attack)
    target.hp = target.hp - dmg
    announce self.name + " claws back for " + dmg + " damage!"
  }
}

equip hero    = summon Hero("Aldric")
equip monster = summon Monster("Cave Troll", 40)
announce "--- Battle begins! ---"

patrol hero.hp > 0 && monster.hp > 0 {
  hero.smite(monster)
  embark monster.hp <= 0 { retreat }
  monster.claw(hero)
}

embark hero.hp > 0 {
  announce hero.name + " is victorious!"
} otherwise {
  announce hero.name + " has fallen..."
}`,

  "Vault": `~ NullTreasureException demo ~
guild NullTreasureException {
  initiate(chestName) {
    self.type    = "NullTreasureException"
    self.message = "[NullTreasureException] Nothing in '" + chestName + "'!"
    self.chest   = chestName
  }
}

quest openChest(chest) {
  embark chest == null {
    perish summon NullTreasureException("unknown")
  }
  reward chest
}

quest claimTreasure(chest, label) {
  survive {
    equip item = openChest(chest)
    announce "You claim: " + item
  } fallen(curse) {
    announce curse.message
    announce "The chest '" + label + "' held only shadow."
  }
}

claimTreasure("Sword of Dawn", "Oak Chest")
claimTreasure(null, "Cursed Coffer")
claimTreasure("Ancient Map", "Iron Lockbox")`,

  "Loot Loop": `~ Loop through an inventory ~
equip chest = ["sword", "shield", "potion", "gold coins", "ancient map"]

announce "Opening the chest..."
loot item from chest {
  announce "Found: " + item
}
announce "Chest empty. Onwards!"`,
};

const ERRTHEMES: Record<string, string> = {
  CursedScrollException:      "📜",
  NullTreasureException:      "👻",
  UnknownQuestException:      "🗺️",
  InventoryOverflowException: "🎒",
  WrongGuildException:        "⚔️",
  BetrayalException:          "🔐",
};

type OutputLine = { text: string; kind: "output" | "error" | "info" };

function compileQuest(source: string): { steps: string[][]; error: string | null } {
  try {
    const tokens = tokenise(source);
    const ast    = new Parser(tokens).parse();
    const interp = new Interpreter();
    interp.run(ast);
    const steps = interp.steps.length > 0 ? interp.steps : [interp.output];
    return { steps, error: null };
  } catch (e: any) {
    const msg: string = e?.message ?? String(e);
    const typeMatch   = msg.match(/\[(\w+Exception)\]/);
    const type        = typeMatch?.[1] ?? "QuestException";
    const icon        = ERRTHEMES[type] ?? "💀";
    return { steps: [], error: `${icon} ${type}\n${msg.replace(/\[\w+Exception\]\s*/, "")}` };
  }
}

// Toast component
function Toast({ achievement, onDone }: { achievement: Achievement; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 999,
      background: "#1a1a24", border: "1px solid #4a4270",
      borderRadius: 10, padding: "12px 16px",
      display: "flex", alignItems: "center", gap: 10,
      boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
      animation: "slideIn 0.3s ease",
    }}>
      <span style={{ fontSize: 22 }}>{achievement.icon}</span>
      <div>
        <div style={{ fontSize: 10, color: "#7f77dd", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Achievement</div>
        <div style={{ fontSize: 13, color: "#e8e6e0", fontWeight: 500 }}>{achievement.title}</div>
      </div>
    </div>
  );
}

export default function App() {
  const getInitialCode = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get("code");
      if (encoded) return decodeURIComponent(atob(encoded));
    } catch {}
    return EXAMPLES["Hello Realm"];
  };

  const [code, setCode]         = useState(getInitialCode);
  const [output, setOutput]     = useState<OutputLine[]>([]);
  const [ran, setRan]           = useState(false);
  const [copied, setCopied]     = useState(false);

  // Debugger state
  const [steps, setSteps]       = useState<string[][]>([]);
  const [stepIdx, setStepIdx]   = useState(0);
  const [debugMode, setDebugMode] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Achievements
  const [toast, setToast]       = useState<Achievement | null>(null);
  const unlockedRef             = useRef<Set<string>>(new Set());

  const handleShare = useCallback(() => {
    const encoded = btoa(encodeURIComponent(code));
    const url = `${window.location.origin}${window.location.pathname}?code=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  const fireAchievements = useCallback((out: string[]) => {
    const earned = checkAchievements(out);
    for (const a of earned) {
      if (!unlockedRef.current.has(a.id)) {
        unlockedRef.current.add(a.id);
        setTimeout(() => setToast(a), 200);
        break; // show one at a time
      }
    }
  }, []);

  const handleRun = useCallback(() => {
    const { steps: s, error: err } = compileQuest(code);
    setError(err);
    setSteps(s);
    setStepIdx(s.length > 0 ? s.length - 1 : 0);
    setDebugMode(false);

    if (err) {
      setOutput([{ text: err, kind: "error" }]);
    } else {
      const finalOut = s.length > 0 ? s[s.length - 1] : [];
      const lines: OutputLine[] = finalOut.map(t => ({ text: t, kind: "output" }));
      lines.push({ text: `✓ Quest complete (${finalOut.length} line${finalOut.length !== 1 ? "s" : ""})`, kind: "info" });
      setOutput(lines);
      fireAchievements(finalOut);
    }
    setRan(true);
  }, [code, fireAchievements]);

  const handleDebug = useCallback(() => {
    const { steps: s, error: err } = compileQuest(code);
    setError(err);
    setSteps(s);
    setStepIdx(0);
    setDebugMode(true);
    setRan(true);

    if (err) {
      setOutput([{ text: err, kind: "error" }]);
      setDebugMode(false);
    } else {
      setOutput(s[0]?.map(t => ({ text: t, kind: "output" as const })) ?? []);
    }
  }, [code]);

  const handleStep = useCallback((dir: 1 | -1) => {
    setStepIdx(prev => {
      const next = Math.max(0, Math.min(steps.length - 1, prev + dir));
      const snap = steps[next] ?? [];
      setOutput(snap.map(t => ({ text: t, kind: "output" as const })));
      if (next === steps.length - 1) fireAchievements(snap);
      return next;
    });
  }, [steps, fireAchievements]);

  const handleExample = (name: string) => {
    setCode(EXAMPLES[name]);
    setOutput([]);
    setRan(false);
    setDebugMode(false);
    setSteps([]);
    setError(null);
  };

  const debugOutput: OutputLine[] = debugMode
    ? (steps[stepIdx] ?? []).map(t => ({ text: t, kind: "output" }))
    : output;

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from { transform: translateY(16px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {toast && <Toast achievement={toast} onDone={() => setToast(null)} />}

      <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px",
          background: "#1a1a24", borderBottom: "1px solid #2e2e3e",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: "#a89dff" }}>QUEST</span>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "#2a2840", color: "#7f77dd", fontWeight: 500 }}>v1.0</span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {Object.keys(EXAMPLES).map(name => (
              <button key={name} onClick={() => handleExample(name)} style={{
                padding: "5px 12px", fontSize: 12, fontWeight: 500,
                background: code === EXAMPLES[name] ? "#2a2840" : "transparent",
                color: code === EXAMPLES[name] ? "#a89dff" : "#888",
                border: "1px solid",
                borderColor: code === EXAMPLES[name] ? "#4a4270" : "#2e2e3e",
                borderRadius: 6, cursor: "pointer",
              }}>{name}</button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleShare} style={{
              padding: "7px 16px", fontSize: 13, fontWeight: 500,
              background: copied ? "#1a3a2a" : "transparent",
              color: copied ? "#5dcaa5" : "#888",
              border: "1px solid", borderColor: copied ? "#2a5a3a" : "#2e2e3e",
              borderRadius: 7, cursor: "pointer", transition: "all 0.2s",
            }}>{copied ? "✓ Copied!" : "Share"}</button>

            <button onClick={handleDebug} style={{
              padding: "7px 16px", fontSize: 13, fontWeight: 500,
              background: debugMode ? "#2a2840" : "transparent",
              color: debugMode ? "#a89dff" : "#888",
              border: "1px solid", borderColor: debugMode ? "#4a4270" : "#2e2e3e",
              borderRadius: 7, cursor: "pointer",
            }}>⏱ Debug</button>

            <button onClick={handleRun} style={{
              padding: "7px 20px", fontSize: 13, fontWeight: 600,
              background: "#7f77dd", color: "#fff",
              border: "none", borderRadius: 7, cursor: "pointer",
            }}>▶ Run Quest</button>
          </div>
        </div>

        {/* Main split */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* Editor */}
          <div style={{ flex: 1, borderRight: "1px solid #2e2e3e", overflow: "hidden" }}>
            <Editor
              height="100%"
              language="quest"
              theme="quest-dark"
              value={code}
              beforeMount={registerQuestLanguage}
              onChange={v => { setCode(v ?? ""); setRan(false); setDebugMode(false); }}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: "on",
                renderLineHighlight: "line",
                wordWrap: "on",
                tabSize: 2,
              }}
            />
          </div>

          {/* Output panel */}
          <div style={{ width: 360, display: "flex", flexDirection: "column", background: "#0f0f13", overflow: "hidden" }}>

            {/* Output header */}
            <div style={{
              padding: "8px 14px", fontSize: 11, fontWeight: 500,
              color: "#555", background: "#1a1a24",
              borderBottom: "1px solid #2e2e3e",
              letterSpacing: "0.05em", textTransform: "uppercase",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span>{debugMode ? `Step ${stepIdx + 1} of ${steps.length}` : "Output"}</span>
              {debugMode && steps.length > 0 && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => handleStep(-1)} disabled={stepIdx === 0} style={{
                    padding: "2px 10px", fontSize: 12, background: "transparent",
                    color: stepIdx === 0 ? "#333" : "#a89dff",
                    border: "1px solid", borderColor: stepIdx === 0 ? "#222" : "#4a4270",
                    borderRadius: 5, cursor: stepIdx === 0 ? "default" : "pointer",
                  }}>← Prev</button>
                  <button onClick={() => handleStep(1)} disabled={stepIdx === steps.length - 1} style={{
                    padding: "2px 10px", fontSize: 12, background: "transparent",
                    color: stepIdx === steps.length - 1 ? "#333" : "#a89dff",
                    border: "1px solid", borderColor: stepIdx === steps.length - 1 ? "#222" : "#4a4270",
                    borderRadius: 5, cursor: stepIdx === steps.length - 1 ? "default" : "pointer",
                  }}>Next →</button>
                </div>
              )}
            </div>

            {/* Output lines */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", fontFamily: "monospace", fontSize: 13 }}>
              {!ran && (
                <div style={{ color: "#444", fontStyle: "italic" }}>
                  Press ▶ Run Quest or ⏱ Debug to begin.
                </div>
              )}
              {debugOutput.map((line, i) => (
                <div key={i} style={{
                  marginBottom: 4, lineHeight: 1.6, whiteSpace: "pre-wrap",
                  color: line.kind === "error" ? "#f08080"
                       : line.kind === "info"  ? "#7f77dd"
                       : "#d4e8c2",
                  background: debugMode && i === (steps[stepIdx]?.length ?? 0) - 1
                    ? "#1a2a1a" : "transparent",
                  borderRadius: 3, padding: "0 4px",
                }}>{line.text}</div>
              ))}
              {debugMode && !error && stepIdx === steps.length - 1 && steps.length > 0 && (
                <div style={{ color: "#7f77dd", marginTop: 8, fontSize: 12 }}>✓ Quest complete</div>
              )}
            </div>

            {/* Achievements shelf */}
            {unlockedRef.current.size > 0 && (
              <div style={{
                borderTop: "1px solid #2e2e3e", padding: "8px 14px",
                background: "#1a1a24",
              }}>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Achievements</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ACHIEVEMENTS.filter((a: Achievement) => unlockedRef.current.has(a.id)).map((a: Achievement) => (
                    <span key={a.id} title={a.title} style={{
                      fontSize: 11, padding: "3px 8px", borderRadius: 99,
                      background: "#2a2840", color: "#a89dff",
                      border: "1px solid #4a4270",
                    }}>{a.icon} {a.title}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}