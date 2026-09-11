// Mapping emojis intelligents pour le POS / catalogue
// Priorité : mots-clés du NOM du produit > CATÉGORIE > fallback

export const CATEGORY_EMOJI: Record<string, string> = {
  COMMANDES_DESSERTS: '🍰',
  DESSERTS: '🍰',
  VIENNOISERIE: '🥐',
  PAIN_BRO: '🥖',
  BOISSONS_CHAUDES: '☕',
  BOISSONS_FROIDES: '🥤',
  BOISSONS_SIGNATURES: '🧋',
  DOGEL: '🥯',
  PIZZA: '🍕',
  BURGERS: '🍔',
  HOT_DOG: '🌭',
  PANINI: '🥪',
  FORMULES: '🍱',
  PTIT_DEJ: '🍳',
  PANCAKE_CREPE: '🥞',
  ACCOMPAGNEMENT: '🍟',
  MENU_ENFANT: '🧸',
  BOUGIE__CARTE: '🕯️',
  PRODUITS_VEILLE: '🗓️',
  DIVERS: '📦',
};

// Mots-clés du nom (prioritaires sur la catégorie)
const NAME_RULES: { regex: RegExp; emoji: string }[] = [
  { regex: /thé|the$|infusion/i, emoji: '🍵' },
  { regex: /café|espresso|allongé|cappuccino|viennois|libanais|frap(e|p)ido/i, emoji: '☕' },
  { regex: /choco|chocolat/i, emoji: '🍫' },
  { regex: /smoothie/i, emoji: '🥤' },
  { regex: /jus |orange|ananas|bissap|multifruit|passion|mojito|limonade/i, emoji: '🧃' },
  { regex: /bière|soft|cola|tonic|ice tea|perrier|gazeuse|eau |red bull|orangina|youki|hugs|capri/i, emoji: '🥤' },
  { regex: /lait|milky|milk/i, emoji: '🥛' },
  { regex: /pizza|panini/i, emoji: '🍕' },
  { regex: /burger/i, emoji: '🍔' },
  { regex: /hot ?dog|saucisse/i, emoji: '🌭' },
  { regex: /frite|accompagnement|salade/i, emoji: '🍟' },
  { regex: /croissant|pain au chocolat|viennoiserie/i, emoji: '🥐' },
  { regex: /cookie|brownie|donut|milky|frapid/i, emoji: '🍩' },
  { regex: /tarte|flan|cheesecake|gateau|gâteau|moelleux|muffin|cupcake/i, emoji: '🍰' },
  { regex: /macaron|éclair|religieuse|choux/i, emoji: '🧁' },
  { regex: /crepe|pancake/i, emoji: '🥞' },
  { regex: /bougie|carte/i, emoji: '🕯️' },
  { regex: /menthe|grenadine|sirop/i, emoji: '🍹' },
];

export function productEmoji(nom: string, categorie: string): string {
  if (nom) {
    for (const r of NAME_RULES) {
      if (r.regex.test(nom)) return r.emoji;
    }
  }
  return CATEGORY_EMOJI[categorie] || '🍰';
}