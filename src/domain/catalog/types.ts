export type WeaponType =
  | "assault_rifle" | "smg" | "sniper" | "lmg"
  | "pistol" | "shotgun" | "melee";

export type ThrowableType =
  | "frag" | "smoke" | "flash" | "incendiary"
  | "decoy" | "emp" | "healing" | "stun";

export type CharacterRole =
  | "assault" | "sniper" | "controller" | "support" | "tank";

export type GameModeId =
  | "team_deathmatch" | "free_for_all"
  | "bomb_defusal" | "battle_royale";

export type MatchmakingBucket = "ranked" | "unranked";

export interface WeaponStats {
  damage: number;
  fireRate: number;
  magazineSize: number;
  reloadTimeMs: number;
  headshotMultiplier: number;
  rangeMeters: number;
  falloffStartMeters: number;
  falloffEndMeters: number;
  minDamage: number;
  recoilVertical: number;
  recoilHorizontal: number;
  spread: number;
  penetration: number;
  isAutomatic: boolean;
}

export interface Weapon {
  id: string;
  name: string;
  type: WeaponType;
  price: number;
  stats: WeaponStats;
}

export interface Throwable {
  id: string;
  name: string;
  type: ThrowableType;
  damage: number;
  radiusMeters: number;
  durationMs: number;
  price: number;
  description: string;
}

export interface Character {
  id: string;
  name: string;
  role: CharacterRole;
  difficulty: "easy" | "medium" | "hard";
  abilities: string[];
  description: string;
}

export interface MapDefinition {
  id: string;
  name: string;
  description: string;
  gameModes: GameModeId[];
  size: "small" | "medium" | "large";
  hasCover: boolean;
}

export interface GameMode {
  id: GameModeId;
  name: string;
  description: string;
  buckets: MatchmakingBucket[];
  teamSize: number;
  roundsPerMatch: number;
  battleRoyaleTeamSizes?: number[];
}

export interface Equipment {
  id: string;
  name: string;
  category: "armor" | "helmet" | "ammo" | "consumable";
  level?: number;
  ammoFor?: WeaponType;
  effect: string;
  price: number;
}

export interface ContentCatalog {
  version: string;
  maps: MapDefinition[];
  weapons: Weapon[];
  throwables: Throwable[];
  characters: Character[];
  gameModes: GameMode[];
  equipment: Equipment[];
}
