import type { ShelfCategory } from "./personal-shelf-rank";

/** Reviewed label vocabulary only. Never translates a product name or supplies nutrients.
 * This fallback is called only when v1.3 cannot classify the first ingredient.
 * Full ingredient words (not suffixes such as Latvian āboli/kodoli) identify oils.
 */
const token = (pattern: string) => new RegExp(`(?:^|[^\\p{L}])(?:${pattern})(?=$|[^\\p{L}])`, "u");
const extracted = token("oil|oils|butter|ella|ellas|ellu|alieju\\p{L}*|sviests|sviestas|tauki|tauku|taukus|spekis|speka|riebalai|riebalu|margar\\p{L}*|масло|масла|жир\\p{L}*|oli|voi");
const fraction = token("protein\\p{L}*|olbaltum\\p{L}*|baltym\\p{L}*|белок|белка|valk|starch|ciete|krakmol\\p{L}*|pulver\\p{L}*|powder|miltel\\p{L}*|pectin|pektin\\p{L}*|fiber|fibre|skiedul\\p{L}*");
const liquidFruit = token("juice|juices|nectar|sula|sulas|sulu|sultys|sulciu|nektars|nektaras|nektaro|koncentr\\p{L}*|concentrat\\p{L}*|dzems|jam|syrup|sirup\\p{L}*|cukruot\\p{L}*|candied|сок|сока|сироп|siirup");

const dairy = token("piens|piena|vajpiens|vajpiena|pilnpiens|pilnpiena|svaigpiens|biezpiens|biezpiena|biezpienamasa|krejums|krejuma|jogurts?|siers|suris|surio|pienas|pieno|grietinele|grietineles|milk|curd|quark|cheese|yogurt|yoghurt|cream|молоко|творог|йогурт|сыр|piim|jogurt|kodujuust");
const dairyDescriptor = /^(?:(?:pasterizet\p{L}*|pastarizet\p{L}*|nepasterizet\p{L}*|atjaunot\p{L}*|rehidret\p{L}*|rekombinet\p{L}*|raudzets|beztauku|saldais|skabais|svaigais|mikstais|puscietais|cietais|nogatavinats|kausetais|kupinats|govs|kazas|aitas|bifelu|majas|grieku|sviezia|puskietis|brandintas|cederio|cedara|camembert|mozzarella|mocarellas|gorgonzola|biologisk\p{L}*|ekologisk\p{L}*|skimmed|pasteurized|pasteurised|organic|whole|fresh|soft|hard|greek|cow['’]?s?|goat['’]?s?)\s+)*/u;
const dairyHead = /^(?:piens|piena (?:siers|krejums)|vajpiens|pilnpiens|svaigpiens|biezpiens|biezpiena masa|biezpienamasa|vajpiena biezpiens|pilnpiena biezpiens|krejums|krejuma jogurts|jogurts?|siers|suris|pienas|grietinele|milk|curd|quark|cheese|yogurt|yoghurt|cream|молоко|творог|йогурт|сыр|piim|jogurt|kodujuust)(?=$|[^\p{L}])/u;

const wholeGrain = /^(?:auzas|avizos|aviziniai dribsniai|avizu dribsniai|oats|auzu parslas|buckwheat|grikiai|griki|griķi|гречка|овес|овсяные хлопья|kaer)(?=$|[^\p{L}])/u;
const wholePlant = /^(?:mandeles|mandelu|almonds?|pistacijas|pistacijos|pistachios?|anakardziai|cashews?|magones|chia|cia|lauka pupas|soju pupeles|sarkanas pupinas|ciedru riekstu kodoli|kokosu dribsniai|kokoso skeveldros|coconut flakes|aboli|abolu biezenis|obuoliai|apples?|datules|dateles|datelu (?:pasta|masa)|datuliu mase|dates?|rozines|raisins?|banani|bananai|bananas?|mangai|mango|aprikozes|apricots?|plumes|viges|figs?|cidonijas|kirsi|kirsu biezenis|cherries|braskes|strawberries|avietes|raspberries|melynes|blueberries|spanguoles|cranberries|kriauses|pears?|hurma|papaija|papaijas gabalini|godzi ogas|goji uogos|dried fruits?|dziovinti vaisiai(?: ir uogos)?|vaisiai|pomidorai|pomidoru (?:minkstimas|pasta|tyre)|tomatoes|pievagrybiai|mushrooms?|artisokai|artichokes?|bazilikas|bazilikai|basil|paprika|paprikos|burokeliai|beetroot|morkos|carrots?|lapiniai kopustai|kale|kalteti darzeni|darzeni|saknu darzeni|оливк\p{L}*|яблок\p{L}*|финик\p{L}*)(?=$|[^\p{L}])/u;
const plantDescriptor = /^(?:(?:dziovint\p{L}*|zavet\p{L}*|sviez\p{L}*|ekologisk\p{L}*|biologisk\p{L}*|grauzdet\p{L}*|kepint\p{L}*|salted|roasted|dried|fresh|organic|apdorot\p{L}*|rehidruoti|pustos|raudonosios|juodosios|zaliosios|un|salitas)\s+)*/u;
const refinedGrain = /^(?:kietuju kvieciu manu kruopos|kietagrudziu kvieciu manu kruopos|cieto kviesu manna|cietie kviesi|durum kviesu graudi|kviesu graudi|kvieciai|kviesi|kviesu parslas|uzpusti(?:e)? kviesu graudi|semolina|wheat|манная крупа)(?=$|[^\p{L}])/u;
const refinedFood = /^(?:nudeles|nudelu tipa makaroni|makaroni|pasta|noodles|mikla|dough|vafeles?|vaflis|wafers?|cepumi|sausainiai|biscuits?|cookies?|marcipan[as]?|marcipana masa|marzipan|glazura|kakao glazuras gabalini|graudaugu kraukski)(?=$|[^\p{L}])/u;

export function reviewedIngredientBase(normalizedFirstPart: string, language: string, category: ShelfCategory) {
  if (!["lv", "lt", "en", "ru", "et"].includes(language)) return null;
  const brackets: string[] = [];
  for (const char of normalizedFirstPart) {
    if (char === "(" || char === "[") brackets.push(char);
    if ((char === ")" && brackets.pop() !== "(") || (char === "]" && brackets.pop() !== "[")) return null;
  }
  if (brackets.length) return null;
  const label = normalizedFirstPart
    .replace(/^(?:sudetis|sastavdalas|ingredients|состав|koostisosad)\s*:\s*/, "")
    .split(/[([]/)[0].replace(/&[a-z]+;?/g, " ").replace(/[_*"„“”]/g, "")
    .replace(/^\s*\d+(?:[.,]\d+)?\s*%\s*/, "").replace(/\s+/g, " ").trim();
  // Never skip water/oil, borrow a later ingredient, or classify an extract as its plant.
  if (!label || extracted.test(label) || liquidFruit.test(label) || token("extract|ekstrakt\\p{L}*|flavou?r|garsas|aromat\\p{L}*|aizviet\\p{L}*|substitute").test(label)) return null;
  const simpleDairy = label.replace(dairyDescriptor, "");
  if (dairyHead.test(simpleDairy) && dairy.test(label) && !fraction.test(label)) {
    return { score: 85, rule: "dairy-label" };
  }
  const plant = label.replace(plantDescriptor, "").replace(/^be gliuteno\s+/, "");
  if (!fraction.test(label) && !token("filling|pildijum\\p{L}*|idaras|dessert|desert\\p{L}*").test(label) && (wholeGrain.test(plant) || wholePlant.test(plant))) {
    return { score: 100, rule: "whole-plant-label" };
  }
  if (/^(?:kakavos (?:mase|pasta|pupeles)|cocoa mass|cocoa beans)(?=$|[^\p{L}])/u.test(plant)) {
    return { score: 100, rule: "cocoa-mass-label" };
  }
  const grain = plant.replace(/^(?:(?:ceptas|variti|varita|spiralveida|atri pagatavojamas|oriental|karamelizeti)\s+)*/, "");
  if (refinedGrain.test(grain) || refinedFood.test(grain)) return { score: 25, rule: "refined-grain-or-compound-label" };
  // Match the existing English milk-base rule; powder is not isolated milk protein.
  if (/^(?:vajpiena|piena|skimmed milk|milk) (?:pulveris|powder)(?=$|[^\p{L}])/u.test(label)) {
    return { score: 85, rule: "dairy-powder-label" };
  }
  if (category === "meat-product" || category === "fish-product") {
    if (fraction.test(label) || token("broth|stock|buljon\\p{L}*").test(label)) return null;
    const animal = token("liellopu|broilera|broileru|cala|cuku|lasa|lasu|makreles|renges|rengu|forele|ansovi|ansovu|saira|tunics");
    if (animal.test(label)) {
      const percent = normalizedFirstPart.match(/(?:^|\s|\()(\d+(?:[.,]\d+)?)\s*%/)?.[1];
      const amount = percent ? Number(percent.replace(",", ".")) : null;
      const score = /mehaniski atkaulot|mehaniski atdalit/.test(label) || (amount !== null && amount < 50) ? 40
        : amount !== null && amount < 80 ? 70 : 85;
      return { score, rule: "animal-label" };
    }
  }
  return null;
}
