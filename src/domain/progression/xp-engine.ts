import { ParticipantStats } from "../matches/canonical-service";

export class XpEngine {
  // The XP required to go from Level N to N+1 gets progressively harder.
  // Formula: 100 * (Level ^ 1.5)
  static getXpRequiredForNextLevel(level: number): number {
    return Math.floor(100 * Math.pow(level, 1.5));
  }

  static calculateMatchXp(stats: ParticipantStats, gameModeId: string): number {
    let xp = 0;

    // 1. Base XP for just finishing the match
    xp += 50;

    // 2. Mode-Specific XP
    if (gameModeId === "team_deathmatch" || gameModeId === "free_for_all") {
      // K/D and Kills matter heavily
      xp += (stats.kills * 100);
      xp += (stats.damage * 0.5);
      // Death penalty (but don't go negative overall)
      xp -= (stats.deaths * 20);
    } 
    else if (gameModeId === "battle_royale") {
      // Survival time matters most (e.g., 1 XP per second alive = 10 mins is 600 XP)
      xp += (stats.survivalTimeSeconds * 1.5);
      // Kills still matter, but less than TDM
      xp += (stats.kills * 50);
    }
    else if (gameModeId === "bomb_defusal") {
      // Objective + Kills
      xp += (stats.kills * 80);
      xp += (stats.score * 2);
    }

    // Ensure minimum XP earned for a match
    return Math.max(10, Math.floor(xp));
  }
}
