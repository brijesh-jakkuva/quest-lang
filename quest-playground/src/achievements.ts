export interface Achievement {
    id: string;
    icon: string;
    title: string;
    condition: (output: string[]) => boolean;
  }
  
  export const ACHIEVEMENTS: Achievement[] = [
    {
      id: "first_run",
      icon: "⚔️",
      title: "First Quest",
      condition: (o) => o.length > 0,
    },
    {
      id: "battle_won",
      icon: "🏆",
      title: "Victorious!",
      condition: (o) => o.some(l => l.toLowerCase().includes("victorious")),
    },
    {
      id: "fallen",
      icon: "💀",
      title: "Hero Fallen",
      condition: (o) => o.some(l => l.toLowerCase().includes("fallen") || l.toLowerCase().includes("has fallen")),
    },
    {
      id: "null_survived",
      icon: "👻",
      title: "Curse Survived",
      condition: (o) => o.some(l => l.toLowerCase().includes("shadow")),
    },
    {
      id: "loot_found",
      icon: "🎒",
      title: "Loot Claimed",
      condition: (o) => o.some(l => l.toLowerCase().includes("found:") || l.toLowerCase().includes("claim")),
    },
    {
      id: "dungeon_ready",
      icon: "🗺️",
      title: "Dungeon Ready",
      condition: (o) => o.some(l => l.toLowerCase().includes("dungeon")),
    },
    {
      id: "many_lines",
      icon: "📜",
      title: "Prolific Scribe",
      condition: (o) => o.length >= 10,
    },
    {
      id: "damage_high",
      icon: "🎲",
      title: "Big Hit!",
      condition: (o) => o.some(l => {
        const m = l.match(/(\d+)\s*damage/);
        return m ? parseInt(m[1]) >= 15 : false;
      }),
    },
  ];
  
  export function checkAchievements(output: string[]): Achievement[] {
    return ACHIEVEMENTS.filter(a => a.condition(output));
  }