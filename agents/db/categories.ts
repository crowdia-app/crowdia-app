import { getSupabase } from "./client";

// Standard categories that match the LLM extraction prompt
const STANDARD_CATEGORIES = [
  "Nightlife",
  "Concert",
  "Party",
  "Theater",
  "Comedy",
  "Art",
  "Food & Wine",
  "Tour",
  "Festival",
  "Workshop",
  "Cultural",
  "Sports",
  "Family",
  "Networking",
  "Film",
  "Other",
];

// Map various category names to standard categories
const CATEGORY_MAPPINGS: Record<string, string> = {
  // Nightlife variations
  "nightlife": "Nightlife",
  "club": "Nightlife",
  "disco": "Nightlife",
  "dj": "Nightlife",
  "techno": "Nightlife",
  "house": "Nightlife",
  "electronic": "Nightlife",
  "rave": "Nightlife",
  "afterparty": "Nightlife",
  "clubbing": "Nightlife",

  // Concert variations
  "concert": "Concert",
  "concerti": "Concert",
  "live music": "Concert",
  "musica": "Concert",
  "music": "Concert",
  "musica & concerti": "Concert",
  "concerti a palermo": "Concert",
  "concerti candlelight": "Concert",
  "candlelight": "Concert",
  "classica": "Concert",
  "manifestazione musicale": "Concert",

  // Party variations
  "party": "Party",
  "festa": "Party",
  "celebration": "Party",

  // Theater variations
  "theater": "Theater",
  "theatre": "Theater",
  "teatro": "Theater",
  "teatri": "Theater",
  "prosa": "Theater",
  "musical": "Theater",
  "musical & varietà": "Theater",
  "teatro e cabaret": "Theater",
  "spettacolo": "Theater",
  "danza": "Theater",

  // Comedy variations
  "comedy": "Comedy",
  "comico": "Comedy",
  "cabaret": "Comedy",
  "stand-up": "Comedy",

  // Art variations
  "art": "Art",
  "arte": "Art",
  "mostra": "Art",
  "mostre": "Art",
  "mostre a palermo": "Art",
  "exhibition": "Art",
  "gallery": "Art",
  "manifestazione artistica": "Art",

  // Food & Wine variations
  "food & wine": "Food & Wine",
  "food & drink": "Food & Wine",
  "cibo e vino": "Food & Wine",
  "wine": "Food & Wine",
  "wine tasting": "Food & Wine",
  "degustazione": "Food & Wine",
  "gastronomia": "Food & Wine",

  // Tour variations
  "tour": "Tour",
  "escursioni": "Tour",
  "visite guidate": "Tour",
  "visite ed escursioni": "Tour",
  "passeggiate culturali": "Tour",
  "turismo": "Tour",

  // Festival variations
  "festival": "Festival",
  "sagra": "Festival",

  // Workshop variations
  "workshop": "Workshop",
  "corso": "Workshop",
  "seminario": "Workshop",
  "education": "Workshop",

  // Cultural variations
  "cultural": "Cultural",
  "cultura": "Cultural",
  "culture": "Cultural",
  "evento culturale": "Cultural",
  "incontri culturali": "Cultural",
  "religione": "Cultural",
  "conference": "Cultural",
  "talk": "Cultural",
  "in evidenza": "Cultural",

  // Sports variations
  "sports": "Sports",
  "sport": "Sports",
  "fitness": "Sports",

  // Family variations
  "family": "Family",
  "famiglia": "Family",
  "bambini": "Family",

  // Networking variations
  "networking": "Networking",
  "business": "Networking",
  "social": "Networking",
  "meetup": "Networking",

  // Film variations
  "film": "Film",
  "cinema": "Film",
  "movie": "Film",

  // Education → Workshop
  "scuola e università": "Workshop",

  // Style → Other
  "stile e trend": "Other",
};

/**
 * Normalize a category name to a standard category
 */
function normalizeCategory(categoryName: string): string {
  const lower = categoryName.toLowerCase().trim();

  // Check direct mapping
  if (CATEGORY_MAPPINGS[lower]) {
    return CATEGORY_MAPPINGS[lower];
  }

  // Check if it's already a standard category (case-insensitive)
  const standardMatch = STANDARD_CATEGORIES.find(
    cat => cat.toLowerCase() === lower
  );
  if (standardMatch) {
    return standardMatch;
  }

  // Check if any mapping key is contained in the category name
  for (const [key, value] of Object.entries(CATEGORY_MAPPINGS)) {
    if (lower.includes(key)) {
      return value;
    }
  }

  // Default to Other for unknown categories
  return "Other";
}

export async function findOrCreateCategory(categoryName: string): Promise<string | null> {
  if (!categoryName) return null;

  // Normalize to standard category
  const normalizedName = normalizeCategory(categoryName);
  const slug = normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // Try to find existing by normalized name
  const { data: existing } = await getSupabase()
    .from("categories")
    .select("id")
    .or(`slug.eq.${slug},name.ilike.${normalizedName}`)
    .single();

  if (existing) return existing.id;

  // Create new with normalized name
  const { data, error } = await getSupabase()
    .from("categories")
    .insert({
      name: normalizedName,
      slug,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create category:", error.message);
    return null;
  }

  return data.id;
}
