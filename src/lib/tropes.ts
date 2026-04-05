import type { AnimeWithRelations } from "./types";

// Trope definitions — keywords in description/franchise that signal specific tropes
// These are used as additional recommendation signals beyond genres

export type Trope =
  | "isekai"
  | "reincarnation"
  | "leveling"
  | "overpowered_mc"
  | "game_world"
  | "dark_fantasy"
  | "tournament"
  | "revenge";

type TropeRule = {
  trope: Trope;
  russian: string;
  descriptionKeywords: RegExp[];
  franchiseKeywords?: string[];
  genreBoost?: number[]; // genre IDs that make this trope more likely
};

const TROPE_RULES: TropeRule[] = [
  {
    trope: "isekai",
    russian: "Исекай",
    descriptionKeywords: [
      /друг(ой|ом|ого) мир/i,
      /иной мир/i,
      /иного мира/i,
      /попада[её]т в/i,
      /перенос[иёя]тся в/i,
      /оказыва[её]тся в (друг|ин|нов|фантас|магич)/i,
      /другое измерение/i,
      /other world/i,
      /another world/i,
      /transported to/i,
      /summoned to/i,
      /isekai/i,
      /trapped in a/i,
      /reborn in/i,
      /wakes up in/i,
    ],
    genreBoost: [10], // Fantasy
  },
  {
    trope: "reincarnation",
    russian: "Перерождение",
    descriptionKeywords: [
      /перерожд/i,
      /реинкарнац/i,
      /переродил/i,
      /прошл(ой|ая) жизн/i,
      /заново родил/i,
      /родился заново/i,
      /reincarnated/i,
      /reborn as/i,
      /past life/i,
      /second life/i,
      /previous life/i,
    ],
  },
  {
    trope: "leveling",
    russian: "Прокачка",
    descriptionKeywords: [
      /уровн[иеяь]/i,
      /прокач/i,
      /систем[аеу] уровней/i,
      /ранг[иаов]/i,
      /level up/i,
      /leveling/i,
      /rank up/i,
      /skill points/i,
      /status window/i,
      /experience points/i,
      /становится сильн/i,
      /слабейш/i,
    ],
    genreBoost: [10, 1], // Fantasy, Action
  },
  {
    trope: "overpowered_mc",
    russian: "Сильный ГГ",
    descriptionKeywords: [
      /непобедим/i,
      /сильнейш/i,
      /могуществен/i,
      /безгранич(ная|ную|ной) сил/i,
      /overpowered/i,
      /strongest/i,
      /invincible/i,
      /one punch/i,
      /unbeatable/i,
      /всемогущ/i,
    ],
  },
  {
    trope: "game_world",
    russian: "Игровой мир",
    descriptionKeywords: [
      /виртуальн(ой|ая|ую) реальност/i,
      /MMORPG/i,
      /онлайн.?игр/i,
      /game world/i,
      /virtual reality/i,
      /VRMMO/i,
      /NPC/i,
      /logged in/i,
      /игров(ой|ом|ого) мир/i,
    ],
    genreBoost: [11], // Game
  },
  {
    trope: "dark_fantasy",
    russian: "Тёмное фэнтези",
    descriptionKeywords: [
      /тёмн(ое|ого|ому) фэнтези/i,
      /мрачн(ый|ого|ом) мир/i,
      /dark fantasy/i,
      /жесток(ий|ого|ом) мир/i,
      /демон(ов|ы|ам)/i,
      /кров(ь|и|ью) и/i,
    ],
    genreBoost: [10, 6], // Fantasy, Demons
  },
  {
    trope: "tournament",
    russian: "Турнир",
    descriptionKeywords: [
      /турнир/i,
      /соревнован/i,
      /чемпионат/i,
      /tournament/i,
      /competition/i,
      /battle royale/i,
    ],
  },
  {
    trope: "revenge",
    russian: "Месть",
    descriptionKeywords: [
      /мест(ь|и|ью)/i,
      /отомст/i,
      /revenge/i,
      /avenge/i,
      /предательств/i,
    ],
  },
];

// Known isekai franchises (partial match)
const ISEKAI_FRANCHISES = [
  "sword_art_online", "re_zero", "konosuba", "overlord", "tate_no_yuusha",
  "tensei_shitara_slime", "mushoku_tensei", "no_game_no_life", "log_horizon",
  "isekai_maou", "death_march", "arifureta", "tsuki_ga_michibiku", "kumo_desu_ga",
  "hai_to_gensou_no_grimgar", "gate", "isekai_ojisan", "isekai_shokudou",
  "tondemo_skill", "solo_leveling", "shangri_la_frontier", "bofuri",
  "cautious_hero", "wise_mans_grandchild", "smartphone", "digimon",
  ".hack", "dungeon_ni_deai", "grimgar", "zero_no_tsukaima",
];

export function detectTropes(anime: AnimeWithRelations): Trope[] {
  const tropes: Trope[] = [];
  const desc = anime.description ?? "";
  const franchise = anime.franchise ?? "";
  const genreIds = new Set(anime.genres.map((g) => g.id));

  for (const rule of TROPE_RULES) {
    let matched = false;

    // Check description keywords
    for (const pattern of rule.descriptionKeywords) {
      if (pattern.test(desc)) {
        matched = true;
        break;
      }
    }

    // Check franchise keywords
    if (!matched && rule.franchiseKeywords) {
      for (const kw of rule.franchiseKeywords) {
        if (franchise.toLowerCase().includes(kw)) {
          matched = true;
          break;
        }
      }
    }

    if (matched) tropes.push(rule.trope);
  }

  // Special: detect isekai by franchise name
  if (!tropes.includes("isekai")) {
    for (const f of ISEKAI_FRANCHISES) {
      if (franchise.toLowerCase().includes(f.replace(/_/g, ""))) {
        tropes.push("isekai");
        break;
      }
    }
  }

  return tropes;
}

export function getTropeLabel(trope: Trope): string {
  const rule = TROPE_RULES.find((r) => r.trope === trope);
  return rule?.russian ?? trope;
}

export const ALL_TROPES = TROPE_RULES.map((r) => ({ trope: r.trope, russian: r.russian }));
