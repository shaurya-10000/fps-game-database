import { ContentCatalog } from "./types";

export const CATALOG_V1: ContentCatalog = {
  version: "v1",

  maps: [
    { id: "map_redline", name: "Redline", description: "Abandoned subway station, tight CQB control fights", gameModes: ["team_deathmatch", "bomb_defusal"], size: "medium", hasCover: true },
    { id: "map_caravan", name: "Caravan", description: "Nomad camp in a desert canyon with long sightlines", gameModes: ["bomb_defusal", "battle_royale"], size: "large", hasCover: true },
    { id: "map_glacier", name: "Glacier", description: "Frozen research outpost, winding corridors", gameModes: ["bomb_defusal", "free_for_all"], size: "small", hasCover: true },
    { id: "map_emberfall", name: "Emberfall", description: "Volcanic extraction site with vertical gameplay", gameModes: ["team_deathmatch", "bomb_defusal", "battle_royale"], size: "medium", hasCover: true },
    { id: "map_terrace", name: "Terrace", description: "Rooftop arena in a dense urban district", gameModes: ["free_for_all", "team_deathmatch"], size: "small", hasCover: true },
    { id: "map_brine", name: "Brine", description: "Offshore oil rig with rotating platforms", gameModes: ["bomb_defusal", "battle_royale"], size: "large", hasCover: true },
    { id: "map_monolith", name: "Monolith", description: "Ancient ruins in a lush jungle", gameModes: ["bomb_defusal", "battle_royale"], size: "medium", hasCover: true },
    { id: "map_ashfall", name: "Ashfall", description: "Post-eruption mining town with ash clouds", gameModes: ["team_deathmatch", "free_for_all"], size: "medium", hasCover: true },
    { id: "map_crosswinds", name: "Crosswinds", description: "Desert highway checkpoint with wind gusts", gameModes: ["free_for_all", "team_deathmatch"], size: "small", hasCover: true },
    { id: "map_undertow", name: "Undertow", description: "Underground aqueduct system, water hazards", gameModes: ["bomb_defusal", "battle_royale"], size: "large", hasCover: true }
  ],

  weapons: [
    // Assault Rifles (5)
    { id: "wep_ar1", name: "Wraith", type: "assault_rifle", damage: 36, fireRate: 600, magazineSize: 30, reloadTimeMs: 2500, price: 2700, isAutomatic: true, headshotMultiplier: 4.0 },
    { id: "wep_ar2", name: "Havoc", type: "assault_rifle", damage: 33, fireRate: 666, magazineSize: 30, reloadTimeMs: 3100, price: 3100, isAutomatic: true, headshotMultiplier: 4.0 },
    { id: "wep_ar3", name: "Sentinel", type: "assault_rifle", damage: 38, fireRate: 600, magazineSize: 25, reloadTimeMs: 3200, price: 2900, isAutomatic: true, headshotMultiplier: 4.0 },
    { id: "wep_ar4", name: "Warden", type: "assault_rifle", damage: 40, fireRate: 600, magazineSize: 25, reloadTimeMs: 2500, price: 2900, isAutomatic: true, headshotMultiplier: 4.0 },
    { id: "wep_ar5", name: "Raptor", type: "assault_rifle", damage: 35, fireRate: 625, magazineSize: 30, reloadTimeMs: 2400, price: 3000, isAutomatic: true, headshotMultiplier: 3.5 },

    // SMGs (5)
    { id: "wep_smg1", name: "Viper", type: "smg", damage: 27, fireRate: 750, magazineSize: 30, reloadTimeMs: 2800, price: 1500, isAutomatic: true, headshotMultiplier: 4.0 },
    { id: "wep_smg2", name: "Hornet", type: "smg", damage: 26, fireRate: 857, magazineSize: 30, reloadTimeMs: 2100, price: 1250, isAutomatic: true, headshotMultiplier: 4.0 },
    { id: "wep_smg3", name: "Bolt", type: "smg", damage: 23, fireRate: 900, magazineSize: 32, reloadTimeMs: 2200, price: 1100, isAutomatic: true, headshotMultiplier: 4.0 },
    { id: "wep_smg4", name: "Wasp", type: "smg", damage: 26, fireRate: 800, magazineSize: 30, reloadTimeMs: 2500, price: 1600, isAutomatic: true, headshotMultiplier: 3.0 },
    { id: "wep_smg5", name: "Needle", type: "smg", damage: 24, fireRate: 820, magazineSize: 25, reloadTimeMs: 2000, price: 1350, isAutomatic: true, headshotMultiplier: 4.0 },

    // Snipers (5)
    { id: "wep_sniper1", name: "Hammerfall", type: "sniper", damage: 115, fireRate: 41, magazineSize: 10, reloadTimeMs: 3700, price: 4750, isAutomatic: false, headshotMultiplier: 4.0 },
    { id: "wep_sniper2", name: "Coldshot", type: "sniper", damage: 88, fireRate: 48, magazineSize: 10, reloadTimeMs: 3700, price: 1700, isAutomatic: false, headshotMultiplier: 4.0 },
    { id: "wep_sniper3", name: "Railgun", type: "sniper", damage: 150, fireRate: 40, magazineSize: 5, reloadTimeMs: 3700, price: 4700, isAutomatic: false, headshotMultiplier: 2.5 },
    { id: "wep_sniper4", name: "Longshot", type: "sniper", damage: 95, fireRate: 45, magazineSize: 5, reloadTimeMs: 3500, price: 3800, isAutomatic: false, headshotMultiplier: 4.0 },
    { id: "wep_sniper5", name: "Apexbreaker", type: "sniper", damage: 110, fireRate: 42, magazineSize: 8, reloadTimeMs: 3600, price: 4200, isAutomatic: false, headshotMultiplier: 4.0 },

    // LMGs (5)
    { id: "wep_lmg1", name: "Bulwark", type: "lmg", damage: 35, fireRate: 800, magazineSize: 150, reloadTimeMs: 5500, price: 1700, isAutomatic: true, headshotMultiplier: 4.0 },
    { id: "wep_lmg2", name: "Avalanche", type: "lmg", damage: 32, fireRate: 750, magazineSize: 100, reloadTimeMs: 5500, price: 5200, isAutomatic: true, headshotMultiplier: 4.0 },
    { id: "wep_lmg3", name: "Thunderhead", type: "lmg", damage: 30, fireRate: 780, magazineSize: 120, reloadTimeMs: 5200, price: 4800, isAutomatic: true, headshotMultiplier: 4.0 },
    { id: "wep_lmg4", name: "Ironbell", type: "lmg", damage: 33, fireRate: 720, magazineSize: 100, reloadTimeMs: 5600, price: 4600, isAutomatic: true, headshotMultiplier: 3.5 },
    { id: "wep_lmg5", name: "Siegeheart", type: "lmg", damage: 34, fireRate: 750, magazineSize: 125, reloadTimeMs: 5400, price: 4900, isAutomatic: true, headshotMultiplier: 4.0 },

    // Pistols (5)
    { id: "wep_pistol1", name: "Sidearm", type: "pistol", damage: 28, fireRate: 400, magazineSize: 20, reloadTimeMs: 2200, price: 200, isAutomatic: false, headshotMultiplier: 4.0 },
    { id: "wep_pistol2", name: "Whisper", type: "pistol", damage: 35, fireRate: 350, magazineSize: 12, reloadTimeMs: 2200, price: 200, isAutomatic: false, headshotMultiplier: 4.0 },
    { id: "wep_pistol3", name: "Judge", type: "pistol", damage: 63, fireRate: 267, magazineSize: 7, reloadTimeMs: 2200, price: 700, isAutomatic: false, headshotMultiplier: 4.0 },
    { id: "wep_pistol4", name: "Flashpoint", type: "pistol", damage: 26, fireRate: 400, magazineSize: 12, reloadTimeMs: 2000, price: 0, isAutomatic: false, headshotMultiplier: 3.0 },
    { id: "wep_pistol5", name: "Clawback", type: "pistol", damage: 30, fireRate: 380, magazineSize: 15, reloadTimeMs: 2100, price: 500, isAutomatic: false, headshotMultiplier: 4.0 },

    // Shotguns (5)
    { id: "wep_shotgun1", name: "Thunder", type: "shotgun", damage: 26, fireRate: 85, magazineSize: 8, reloadTimeMs: 2600, price: 1050, isAutomatic: false, headshotMultiplier: 3.0 },
    { id: "wep_shotgun2", name: "Striker", type: "shotgun", damage: 20, fireRate: 171, magazineSize: 8, reloadTimeMs: 2600, price: 2000, isAutomatic: true, headshotMultiplier: 3.0 },
    { id: "wep_shotgun3", name: "Scattershot", type: "shotgun", damage: 22, fireRate: 90, magazineSize: 6, reloadTimeMs: 2800, price: 1200, isAutomatic: false, headshotMultiplier: 3.0 },
    { id: "wep_shotgun4", name: "Breaker", type: "shotgun", damage: 24, fireRate: 100, magazineSize: 7, reloadTimeMs: 2500, price: 1500, isAutomatic: false, headshotMultiplier: 3.0 },
    { id: "wep_shotgun5", name: "Bastion", type: "shotgun", damage: 18, fireRate: 180, magazineSize: 10, reloadTimeMs: 2700, price: 2200, isAutomatic: true, headshotMultiplier: 3.0 },

    // Melee (5)
    { id: "wep_melee1", name: "Tactical Blade", type: "melee", damage: 55, fireRate: 120, magazineSize: 0, reloadTimeMs: 0, price: 0, isAutomatic: false, headshotMultiplier: 0 },
    { id: "wep_melee2", name: "Void Edge Dagger", type: "melee", damage: 55, fireRate: 120, magazineSize: 0, reloadTimeMs: 0, price: 0, isAutomatic: false, headshotMultiplier: 0 },
    { id: "wep_melee3", name: "Rift Cleaver", type: "melee", damage: 70, fireRate: 90, magazineSize: 0, reloadTimeMs: 0, price: 0, isAutomatic: false, headshotMultiplier: 0 },
    { id: "wep_melee4", name: "Ironfang", type: "melee", damage: 65, fireRate: 100, magazineSize: 0, reloadTimeMs: 0, price: 0, isAutomatic: false, headshotMultiplier: 0 },
    { id: "wep_melee5", name: "Nightreaver", type: "melee", damage: 75, fireRate: 85, magazineSize: 0, reloadTimeMs: 0, price: 0, isAutomatic: false, headshotMultiplier: 0 }
  ],

  throwables: [
    { id: "thr_frag1", name: "Shattercore", type: "frag", damage: 90, radiusMeters: 4, durationMs: 0, price: 300, description: "Explosive fragmentation grenade" },
    { id: "thr_smoke1", name: "Veilcloud", type: "smoke", damage: 0, radiusMeters: 5, durationMs: 15000, price: 200, description: "Vision-blocking smoke" },
    { id: "thr_flash1", name: "Blindlight", type: "flash", damage: 0, radiusMeters: 6, durationMs: 2500, price: 200, description: "Blinds enemies in line of sight" },
    { id: "thr_incendiary1", name: "Cinderwave", type: "incendiary", damage: 15, radiusMeters: 5, durationMs: 7000, price: 400, description: "Area-denial fire" },
    { id: "thr_decoy1", name: "Phantom Echo", type: "decoy", damage: 0, radiusMeters: 8, durationMs: 8000, price: 150, description: "Mimics gunfire to bait enemies" },
    { id: "thr_emp1", name: "Nullburst", type: "emp", damage: 0, radiusMeters: 6, durationMs: 4000, price: 500, description: "Disables abilities and HUD" },
    { id: "thr_healing1", name: "Lifebloom", type: "healing", damage: -50, radiusMeters: 4, durationMs: 3000, price: 350, description: "Heals allies in radius" },
    { id: "thr_stun1", name: "Quakejaw", type: "stun", damage: 0, radiusMeters: 5, durationMs: 3000, price: 250, description: "Slows and impairs enemies" }
  ],

  characters: [
    // Assault (5)
    { id: "char_as1", name: "Vandal", role: "assault", difficulty: "easy", abilities: ["burst_fire", "adrenaline"], description: "Straightforward burst-damage specialist" },
    { id: "char_as2", name: "Ravager", role: "assault", difficulty: "medium", abilities: ["dash_slash", "bloodthirst"], description: "Aggressive close-range brawler" },
    { id: "char_as3", name: "Pyre", role: "assault", difficulty: "easy", abilities: ["flame_cone", "backdraft"], description: "Fire-based area damage dealer" },
    { id: "char_as4", name: "Riptide", role: "assault", difficulty: "medium", abilities: ["water_dash", "crushing_wave"], description: "Fast flanker with crowd control" },
    { id: "char_as5", name: "Hawkeye", role: "assault", difficulty: "hard", abilities: ["precision_shot", "mark_target"], description: "Precision-assault hybrid" },

    // Sniper (5)
    { id: "char_sn1", name: "Coldshot", role: "sniper", difficulty: "medium", abilities: ["steady_aim", "tripwire"], description: "Patient long-range eliminator" },
    { id: "char_sn2", name: "Lattice", role: "sniper", difficulty: "easy", abilities: ["recon_scope", "tag_target"], description: "Information-focused sniper" },
    { id: "char_sn3", name: "Nightfall", role: "sniper", difficulty: "medium", abilities: ["silent_shot", "cloak"], description: "Stealth sniper, silent reposition" },
    { id: "char_sn4", name: "Talon", role: "sniper", difficulty: "hard", abilities: ["quick_scope", "mark_and_execute"], description: "Aggressive quick-scope duelist" },
    { id: "char_sn5", name: "Vigil", role: "sniper", difficulty: "medium", abilities: ["spotter_drone", "suppressive_fire"], description: "Overwatch sniper with a spotter drone" },

    // Controller (5)
    { id: "char_ct1", name: "Umbra", role: "controller", difficulty: "medium", abilities: ["dark_wall", "blind_orb", "teleport_dash"], description: "Shadow controller manipulating sightlines" },
    { id: "char_ct2", name: "Aegisveil", role: "controller", difficulty: "easy", abilities: ["smoke_veil", "counter_wall"], description: "Smoke-focused controller" },
    { id: "char_ct3", name: "Miasma", role: "controller", difficulty: "hard", abilities: ["toxic_wall", "acid_pool", "corrosive_orb"], description: "Chemical area-denial controller" },
    { id: "char_ct4", name: "Skywarden", role: "controller", difficulty: "medium", abilities: ["air_smoke", "vision_drone"], description: "Air-based sightline denial" },
    { id: "char_ct5", name: "Duskbrand", role: "controller", difficulty: "medium", abilities: ["ink_burst", "silhouette"], description: "Ink-based sightline controller" },

    // Support (5)
    { id: "char_sp1", name: "Vital", role: "support", difficulty: "easy", abilities: ["heal_aura", "revive_touch"], description: "Sustain-focused support healer" },
    { id: "char_sp2", name: "Lifeline", role: "support", difficulty: "easy", abilities: ["revive_drone", "healing_burst"], description: "Emergency-response healer" },
    { id: "char_sp3", name: "Mender", role: "support", difficulty: "medium", abilities: ["ammo_drop", "regen_field"], description: "Resource-support specialist" },
    { id: "char_sp4", name: "Symbiotic", role: "support", difficulty: "medium", abilities: ["link_shield", "shared_vision"], description: "Buff-transfer support" },
    { id: "char_sp5", name: "Halo", role: "support", difficulty: "hard", abilities: ["team_heal_pulse", "revive_wave"], description: "Global team-sustain support" },

    // Tank (5)
    { id: "char_tk1", name: "Bulwark", role: "tank", difficulty: "easy", abilities: ["barrier_shield", "ground_slam"], description: "Frontline barrier tank" },
    { id: "char_tk2", name: "Foundation", role: "tank", difficulty: "medium", abilities: ["fortify", "wall_deploy"], description: "Deployable-cover tank" },
    { id: "char_tk3", name: "Ironhide", role: "tank", difficulty: "easy", abilities: ["armor_plating", "slow_field"], description: "Armored pressure tank" },
    { id: "char_tk4", name: "Anchor", role: "tank", difficulty: "medium", abilities: ["tether_drag", "damage_soak"], description: "Lockdown tank, holds chokepoints" },
    { id: "char_tk5", name: "Stonewall", role: "tank", difficulty: "hard", abilities: ["wall_toss", "earthquake"], description: "Displacement tank, disrupts enemy lines" }
  ],

  gameModes: [
    { id: "team_deathmatch", name: "Team Deathmatch", description: "Two teams race to kill count", buckets: ["ranked", "unranked"], teamSize: 5, roundsPerMatch: 1 },
    { id: "free_for_all", name: "Free-for-All", description: "Everyone vs everyone", buckets: ["ranked", "unranked"], teamSize: 1, roundsPerMatch: 1 },
    { id: "bomb_defusal", name: "Bomb Defusal", description: "Attackers plant, defenders defuse", buckets: ["ranked", "unranked"], teamSize: 5, roundsPerMatch: 7 },
    { id: "battle_royale", name: "Battle Royale", description: "Last team standing", buckets: ["ranked", "unranked"], teamSize: 1, roundsPerMatch: 1, battleRoyaleTeamSizes: [1, 2, 3, 4, 5] }
  ],

  equipment: [
    // Armor
    { id: "eq_armor_1", name: "Light Armor", category: "armor", level: 1, effect: "+33 HP shield", price: 500 },
    { id: "eq_armor_2", name: "Medium Armor", category: "armor", level: 2, effect: "+66 HP shield", price: 1000 },
    { id: "eq_armor_3", name: "Heavy Armor", category: "armor", level: 3, effect: "+99 HP shield", price: 1500 },

    // Helmet
    { id: "eq_helmet_1", name: "Light Helmet", category: "helmet", level: 1, effect: "20% headshot reduction", price: 400 },
    { id: "eq_helmet_2", name: "Medium Helmet", category: "helmet", level: 2, effect: "40% headshot reduction", price: 800 },
    { id: "eq_helmet_3", name: "Heavy Helmet", category: "helmet", level: 3, effect: "60% headshot reduction", price: 1200 },

    // Ammo
    { id: "eq_ammo_ar", name: "AR Ammo", category: "ammo", ammoFor: "assault_rifle", effect: "Reserve ammo for assault rifles", price: 100 },
    { id: "eq_ammo_smg", name: "SMG Ammo", category: "ammo", ammoFor: "smg", effect: "Reserve ammo for SMGs", price: 80 },
    { id: "eq_ammo_sniper", name: "Sniper Ammo", category: "ammo", ammoFor: "sniper", effect: "Reserve ammo for snipers", price: 150 },
    { id: "eq_ammo_lmg", name: "LMG Ammo", category: "ammo", ammoFor: "lmg", effect: "Reserve ammo for LMGs", price: 120 },
    { id: "eq_ammo_pistol", name: "Pistol Ammo", category: "ammo", ammoFor: "pistol", effect: "Reserve ammo for pistols", price: 50 },
    { id: "eq_ammo_shotgun", name: "Shotgun Ammo", category: "ammo", ammoFor: "shotgun", effect: "Reserve ammo for shotguns", price: 90 },

    // Consumable
    { id: "eq_medkit", name: "Med Kit", category: "consumable", effect: "Restore 50 HP over 3 seconds", price: 250 }
  ]
};
