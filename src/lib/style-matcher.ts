import bjcpStyles from "@/data/bjcp-styles.json";

// Map Untappd style names to BJCP style names
// Untappd uses formats like "Light Lager", "Lager - Mexican", "IPA - American", "Sour - Fruited Gose"
const STYLE_MAP: Record<string, string> = {
  // Direct matches and common Untappd → BJCP mappings
  "light lager": "American Light Lager",
  "lager - light": "American Light Lager",
  "lager - american": "American Lager",
  "lager - mexican": "International Pale Lager",
  "lager - amber / red": "International Amber Lager",
  "lager - amber": "International Amber Lager",
  "lager - dark": "International Dark Lager",
  "pilsner - czech": "Czech Premium Pale Lager",
  "pilsner - german": "German Pils",
  "pilsner - other": "German Pils",
  "pilsner": "German Pils",
  "stout - imperial / double": "Imperial Stout",
  "stout - imperial": "Imperial Stout",
  "stout - american": "American Stout",
  "stout - irish dry": "Irish Stout",
  "stout - oatmeal": "Oatmeal Stout",
  "stout - sweet": "Sweet Stout",
  "stout - foreign / export": "Foreign Extra Stout",
  "stout": "Irish Stout",
  "porter - american": "American Porter",
  "porter - english": "English Porter",
  "porter - baltic": "Baltic Porter",
  "porter": "American Porter",
  "belgian blonde": "Belgian Blond Ale",
  "belgian blond ale": "Belgian Blond Ale",
  "belgian golden strong ale": "Belgian Golden Strong Ale",
  "belgian dubbel": "Belgian Dubbel",
  "belgian tripel": "Belgian Tripel",
  "belgian dark strong ale": "Belgian Dark Strong Ale",
  "saison": "Saison",
  "saison / farmhouse ale": "Saison",
  "witbier": "Witbier",
  "fruit beer": "Fruit Beer",
  "ipa - american": "American IPA",
  "ipa - new england / hazy": "Hazy IPA",
  "ipa - new england": "Hazy IPA",
  "ipa - imperial / double": "Double IPA",
  "ipa - english": "English IPA",
  "ipa - session": "American Pale Ale",
  "ipa": "American IPA",
  "pale ale - american": "American Pale Ale",
  "pale ale - english": "Best Bitter",
  "pale ale": "American Pale Ale",
  "blonde ale": "Blonde Ale",
  "blonde / golden ale": "Blonde Ale",
  "cream ale": "Cream Ale",
  "wheat beer - american": "American Wheat Beer",
  "wheat beer - other": "American Wheat Beer",
  "hefeweizen": "Weissbier",
  "wheat beer - hefeweizen": "Weissbier",
  "amber ale - american": "American Amber Ale",
  "red ale - american": "American Amber Ale",
  "red ale - irish": "Irish Red Ale",
  "brown ale - american": "American Brown Ale",
  "brown ale - english": "British Brown Ale",
  "scotch ale / wee heavy": "Wee Heavy",
  "barleywine - american": "American Barleywine",
  "barleywine - english": "English Barley Wine",
  "sour - fruited gose": "Gose",
  "sour - gose": "Gose",
  "sour - berliner weisse": "Berliner Weisse",
  "sour - flanders red ale": "Flanders Red Ale",
  "sour - flanders oud bruin": "Oud Bruin",
  "sour - fruited": "Fruit Beer",
  "sour": "Straight Sour Beer",
  "kölsch": "Kölsch",
  "kolsch": "Kölsch",
  "märzen": "Märzen",
  "marzen": "Märzen",
  "bock - doppelbock": "Doppelbock",
  "bock - traditional": "Dunkles Bock",
  "bock - maibock": "Helles Bock",
  "bock - eisbock": "Eisbock",
  "schwarzbier": "Schwarzbier",
  "dunkel": "Munich Dunkel",
  "helles": "Munich Helles",
  "vienna lager": "Vienna Lager",
  "altbier": "Altbier",
  "lambic - fruit": "Fruit Lambic",
  "lambic - gueuze": "Gueuze",
  "lambic": "Lambic",
  "old ale": "Old Ale",
  "mild - dark": "Dark Mild",
  "bitter - best": "Best Bitter",
  "bitter - extra special": "Strong Bitter",
  "cocktail": "",
  "miscellaneous": "",
};

export function getStyleDescription(untappdStyle: string): string | null {
  if (!untappdStyle) return null;

  const lower = untappdStyle.toLowerCase().trim();

  // Try direct map
  if (STYLE_MAP[lower] !== undefined) {
    const bjcpName = STYLE_MAP[lower];
    if (!bjcpName) return null; // Empty string = no match (cocktails, etc.)
    return (bjcpStyles as Record<string, string>)[bjcpName] || null;
  }

  // Try partial matching - check if any BJCP style name is contained in the Untappd style
  const bjcp = bjcpStyles as Record<string, string>;
  for (const [bjcpName, desc] of Object.entries(bjcp)) {
    if (lower.includes(bjcpName.toLowerCase())) {
      return desc;
    }
  }

  // Try the other way - if the Untappd style is contained in a BJCP name
  for (const [bjcpName, desc] of Object.entries(bjcp)) {
    if (bjcpName.toLowerCase().includes(lower)) {
      return desc;
    }
  }

  return null;
}

export function getBjcpStyleName(untappdStyle: string): string | null {
  if (!untappdStyle) return null;
  const lower = untappdStyle.toLowerCase().trim();
  if (STYLE_MAP[lower] !== undefined) {
    return STYLE_MAP[lower] || null;
  }
  return null;
}
