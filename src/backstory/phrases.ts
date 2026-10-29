// Story fragments the backstory drafter combines, in every app language.
// Placeholders: {name}, {race}, {cls}, {bg}. Hebrew avoids gendered verbs (no gender on Character),
// so its lines lean on nouns and "{name}'s" phrasing.
import type { Locale } from '../i18n/translate'

export type Axis = 'good' | 'evil' | 'law' | 'chaos' | 'neutral'

export interface Phrases {
  /** Opening line, keyed by race or species id; '*' for homebrew and anything missing. */
  race: Record<string, string[]>
  /** Life before adventuring, keyed by background id; 'custom' = player-made background. */
  background: Record<string, string[]>
  /** What started the adventuring life. */
  turn: string[]
  /** How the class came to them, keyed by class id. */
  calling: Record<string, string[]>
  traits: string[]
  ideals: Record<Axis, string[]>
  bonds: string[]
  flaws: string[]
  /** Loose threads a DM can pull. */
  hooks: string[]
  labels: { personality: string; ideal: string; bond: string; flaw: string; hook: string }
}

const en: Phrases = {
  race: {
    dwarf: ['{name} is a dwarf from a hold carved deep into the mountains, where every family keeps a ledger of old debts and older grudges.', '{name} is a dwarf raised among forge-smoke and clan songs, taught that a promise is worth more than gold.'],
    elf: ['{name} is an elf who has watched a century of human kings come and go from beneath the old forest canopy.', '{name} is an elf whose family still speaks of a homeland lost before most cities were founded.'],
    halfling: ['{name} is a halfling from a village of round doors and full pantries, where nobody quite understood the urge to leave.', '{name} is a halfling who grew up on a river barge, always moving, always welcome somewhere new.'],
    human: ['{name} is a human from a busy crossroads town, where news, trouble and travellers all pass through sooner or later.', '{name} is a human born to a farming family on the edge of a kingdom that rarely remembers they exist.'],
    dragonborn: ['{name} is a dragonborn whose clan measures worth by deeds, and keeps a long list of the deeds still expected.', '{name} is a dragonborn raised far from any clan, with only stories of a draconic ancestor to go on.'],
    gnome: ['{name} is a gnome from a burrow full of clockwork, half-finished inventions and arguments about both.', '{name} is a gnome who spent a childhood in the forest, befriending things most people would call pests.'],
    'half-elf': ['{name} is a half-elf who grew up in two worlds and never felt fully at home in either.', '{name} is a half-elf who learned early to read a room and become whoever it needed.'],
    'half-orc': ['{name} is a half-orc who grew up proving, every single day, that strength and kindness can live in the same body.', '{name} is a half-orc raised in a frontier fort, where everyone was judged by what they did when the raiders came.'],
    tiefling: ['{name} is a tiefling who has heard every whisper about horns and hellfire, and stopped caring which ones are true.', '{name} is a tiefling born to ordinary parents, the infernal blood surfacing from some ancestor nobody talks about.'],
    goliath: ['{name} is a goliath from the high peaks, where the thin air leaves no room for the weak or the boastful.', '{name} is a goliath whose giant ancestry shows in a stride that makes doorways nervous.'],
    orc: ['{name} is an orc whose people remember the god who gave them endurance, and expect it to be used well.', '{name} is an orc who left a tribe of wanderers to see what lies past the last familiar horizon.'],
    '*': ['{name} is a {race} from a place few maps bother to name.', '{name} is a {race} with a past that took a long road to get here.'],
  },
  background: {
    acolyte: ['Before adventuring, {name} served in a temple, tending candles, copying prayers and listening to pilgrims confess things they told no one else.', '{name} spent years as an acolyte, until a vision (or perhaps a fever dream) pointed to the world outside the temple walls.'],
    criminal: ['Before adventuring, {name} made a living on the wrong side of the law, and still has contacts who owe favours, and some who want them repaid.', '{name} ran with a crew of thieves until a job went badly wrong and only {name} walked away.'],
    sage: ['Before adventuring, {name} lived among books and scrolls, chasing a single question that no library could answer.', '{name} was a scholar until one footnote in a forgotten text proved that the answers lay somewhere far more dangerous.'],
    soldier: ['Before adventuring, {name} served in an army, and still wakes at dawn out of habit and listens for the drums.', '{name} was a soldier whose company was scattered after a battle that history books call a victory.'],
    custom: ['Before adventuring, {name} lived as {bg}, a life that taught lessons no school could.', '{name} once lived as {bg}, and the habits of that life still show in how {name} sizes up a stranger.'],
    '*': ['Before adventuring, {name} lived as {bg}, a life that taught lessons no school could.'],
  },
  turn: [
    'Everything changed the night a stranger arrived with a map, a warning and an arrow in the back.',
    'Then a fire took the only home {name} had ever known, and the people responsible are still out there.',
    'Then a debt came due, one that could not be paid in coin.',
    'Then a mentor vanished, leaving only a half-burnt letter and a name.',
    'Then a dream began to repeat every night, always ending at the same ruined tower.',
    'Then a simple errand went wrong and {name} saw something that was never meant to be seen.',
  ],
  calling: {
    barbarian: ['In the fury of that moment {name} discovered a rage that does not burn out, only waits.'],
    bard: ['{name} took up the bard\'s road, sure that the best songs are the ones nobody has lived through yet.'],
    cleric: ['A god answered the first desperate prayer, and has expected service from {name} ever since.'],
    druid: ['The wild itself seemed to choose {name}, and the old circle of druids was not about to argue.'],
    fighter: ['{name} picked up a weapon and learned, the hard way, how to be the one still standing.'],
    monk: ['A monastery took {name} in and taught a discipline that turns the body into a weapon and the mind into a shield.'],
    paladin: ['{name} swore an oath that day, and the oath has been pulling on {name} like a compass needle ever since.'],
    ranger: ['{name} learned to read tracks, weather and wilderness, and to hunt the kind of thing that hunts people.'],
    rogue: ['{name} learned that the quiet, clever answer usually beats the loud one, and that locks are suggestions.'],
    sorcerer: ['That was when the magic in {name}\'s blood woke up, wild and unasked for.'],
    warlock: ['In that dark hour a voice offered power for a price, and {name} said yes before hearing all the terms.'],
    wizard: ['{name} turned to study, convinced that enough knowledge can fix anything, even this.'],
    '*': ['So {name} became a {cls}, and has not looked back since.'],
  },
  traits: [
    'Quick to laugh, slow to forgive.',
    'Keeps a small notebook of everyone met on the road.',
    'Always has a snack, and always shares it.',
    'Hums when nervous, which is often.',
    'Treats every locked door as a personal challenge.',
    'Asks one question too many, every time.',
    'Calm in a crisis; a mess in a market.',
    'Names every horse, mule and particularly brave rat.',
  ],
  ideals: {
    good: ['Mercy. Everyone deserves a second chance.', 'Protection. The weak should never face the dark alone.'],
    evil: ['Power. The world bends to those strong enough to bend it.', 'Ambition. Nothing will stand between me and what I am owed.'],
    law: ['Duty. A promise is a chain I choose to wear.', 'Order. Without rules, the strong just eat the weak.'],
    chaos: ['Freedom. No crown, no cage, no master.', 'Change. Tomorrow should never look like yesterday.'],
    neutral: ['Balance. Every victory costs something; pay it knowingly.', 'Curiosity. The truth matters more than who it hurts or helps.'],
  },
  bonds: [
    'A sibling still waits back home for a letter that has not been written yet.',
    'Carries a ring that belonged to someone who did not make it.',
    'Owes a life debt to a stranger whose name was never learned.',
    'Swore to find whoever started the fire.',
    'The old mentor\'s last words are a riddle still unsolved.',
    'Would do anything for the companions met along the way, though saying so out loud is hard.',
  ],
  flaws: [
    'Cannot resist a bet, even a bad one.',
    'Trusts too quickly anyone who shows kindness.',
    'Holds grudges like heirlooms.',
    'Lies about small things for no reason at all.',
    'Freezes when the past is mentioned.',
    'Believes, deep down, that it should have been someone else who survived.',
  ],
  hooks: [
    'Somewhere out there, someone is looking for {name}, and they are not friendly.',
    'An old acquaintance from {name}\'s past is about to turn up asking for a favour.',
    'The map from that night is still unfinished, and the missing piece is close.',
    '{name} still does not know why it all happened, and the answer will not be comfortable.',
  ],
  labels: { personality: 'Personality', ideal: 'Ideal', bond: 'Bond', flaw: 'Flaw', hook: 'Story hook for the DM' },
}

const he: Phrases = {
  race: {
    dwarf: ['{name}, גמד מעיר-מבצר חצובה עמוק בהרים, שבה כל משפחה שומרת פנקס של חובות ישנים וטינות ישנות עוד יותר.', 'ילדותו של {name}, גמד, עברה בין עשן הנפחייה לשירי השבט, ובה הלקח שהבטחה שווה יותר מזהב.'],
    elf: ['{name}, אלף שראה מאה שנים של מלכי אדם באים והולכים תחת צמרות היער העתיק.', 'במשפחתו של {name}, אלף, עדיין מדברים על מולדת שאבדה לפני שרוב הערים נוסדו.'],
    halfling: ['{name}, בן-חצי מכפר של דלתות עגולות ומזווים מלאים, שבו אף אחד לא הבין את הדחף לעזוב.', 'ילדותו של {name}, בן-חצי, עברה על דוברת בנהר, תמיד בתנועה, תמיד רצוי במקום חדש.'],
    human: ['{name}, אדם מעיירת צומת סואנת, שבה חדשות, צרות ונוסעים עוברים כולם במוקדם או במאוחר.', '{name}, אדם ממשפחת איכרים בקצה ממלכה שכמעט לא זוכרת שהם קיימים.'],
    dragonborn: ['{name}, בן-דרקון משבט שמודד ערך במעשים, ומחזיק רשימה ארוכה של מעשים שעוד מצופים.', 'ילדותו של {name}, בן-דרקון, עברה הרחק מכל שבט, ורק סיפורים על אב-קדמון דרקוני ליוו אותה.'],
    gnome: ['{name}, גנום ממחילה מלאה בשעונים, המצאות חצי-גמורות וויכוחים על שתיהן.', 'ילדותו של {name}, גנום, עברה ביער, בחברת יצורים שרוב האנשים היו קוראים להם מזיקים.'],
    'half-elf': ['{name}, חצי-אלף שגדל בין שני עולמות ומעולם לא הרגיש בבית באף אחד מהם.', 'כבר בילדות למד {name}, חצי-אלף, לקרוא חדר ולהפוך למי שהחדר צריך.'],
    'half-orc': ['{name}, חצי-אורק שמוכיח בכל יום מחדש שכוח וטוב-לב יכולים לגור באותו גוף.', 'ילדותו של {name}, חצי-אורק, עברה במבצר ספר, שבו כל אחד נשפט לפי מה שעשה כשהפושטים הגיעו.'],
    tiefling: ['{name}, טיפלינג ששמע כל לחישה על קרניים ואש גיהנום, וכבר לא אכפת לו אילו מהן נכונות.', '{name}, טיפלינג להורים רגילים לגמרי; הדם השאולי עלה מאיזה אב-קדמון שאף אחד לא מדבר עליו.'],
    goliath: ['{name}, גוליית מהפסגות הגבוהות, שבהן האוויר הדליל לא משאיר מקום לחלשים או לרברבנים.', 'המוצא הענקי של {name}, גוליית, ניכר בצעד שגורם למשקופים להילחץ.'],
    orc: ['{name}, אורק מעם שזוכר את האל שנתן לו כוח עמידה, ומצפה שישתמשו בו היטב.', '{name}, אורק שעזב שבט נוודים כדי לראות מה יש מעבר לאופק המוכר האחרון.'],
    '*': ['{name}, {race} ממקום שמעט מפות טורחות לתת לו שם.', '{name}, {race} שעבר דרך ארוכה עד שהגיע לכאן.'],
  },
  background: {
    acolyte: ['לפני ההרפתקאות, חייו של {name} עברו במקדש: הדלקת נרות, העתקת תפילות והקשבה לעולי רגל שהתוודו על דברים שלא סיפרו לאף אחד אחר.', 'שנים של שירות במקדש, עד שחזון (או אולי חלום קדחת) הצביע ל{name} על העולם שמחוץ לחומות.'],
    criminal: ['לפני ההרפתקאות, הפרנסה של {name} הגיעה מהצד הלא נכון של החוק, ועדיין יש אנשי קשר שחייבים טובות, ואחרים שרוצים אותן בחזרה.', 'הכנופיה של {name} עבדה יחד עד שעבודה אחת השתבשה, ורק {name} יצא ממנה.'],
    sage: ['לפני ההרפתקאות, חייו של {name} עברו בין ספרים ומגילות, במרדף אחרי שאלה אחת שאף ספרייה לא ענתה עליה.', 'הלימודים של {name} נמשכו עד שהערת שוליים אחת בספר נשכח הוכיחה שהתשובות נמצאות במקום מסוכן הרבה יותר.'],
    soldier: ['לפני ההרפתקאות, {name} שירת בצבא, ועדיין מתעורר עם שחר מתוך הרגל ומקשיב לתופים.', 'הפלוגה של {name} התפזרה אחרי קרב שספרי ההיסטוריה קוראים לו ניצחון.'],
    custom: ['לפני ההרפתקאות, חייו של {name} היו חיים של {bg}, חיים שלימדו לקחים שאף בית ספר לא מלמד.', 'בעבר {name} חי כ{bg}, והרגלי החיים ההם עדיין ניכרים בדרך שבה הוא בוחן זרים.'],
    '*': ['לפני ההרפתקאות, חייו של {name} היו חיים של {bg}, חיים שלימדו לקחים שאף בית ספר לא מלמד.'],
  },
  turn: [
    'הכול השתנה בלילה שבו הגיע זר עם מפה, אזהרה וחץ בגב.',
    'ואז אש כילתה את הבית היחיד ש{name} הכיר, והאחראים עדיין מסתובבים חופשי.',
    'ואז הגיע מועד פירעון של חוב שאי אפשר לשלם במטבעות.',
    'ואז המורה של {name} נעלם, והשאיר רק מכתב חרוך למחצה ושם אחד.',
    'ואז חלום אחד חזר בכל לילה, ותמיד הסתיים באותו מגדל הרוס.',
    'ואז שליחות פשוטה השתבשה, ו{name} ראה משהו שלא נועד לעיני אף אחד.',
  ],
  calling: {
    barbarian: ['בזעם של אותו רגע התגלה ל{name} כעס שלא כבה, רק מחכה.'],
    bard: ['מכאן יצא {name} לדרך הפייטנים, בטוח שהשירים הטובים ביותר הם אלה שאף אחד עוד לא חי.'],
    cleric: ['אל ענה לתפילה הנואשת הראשונה, ומאז מצפה לשירות מ{name}.'],
    druid: ['הטבע עצמו כאילו בחר ב{name}, ומעגל הדרואידים הוותיק לא התכוון להתווכח.'],
    fighter: ['{name} הרים נשק ולמד, בדרך הקשה, איך להיות זה שנשאר עומד.'],
    monk: ['מנזר אסף את {name} ולימד משמעת שהופכת את הגוף לנשק ואת התודעה למגן.'],
    paladin: ['באותו יום נשבעה שבועה, ומאז היא מושכת את {name} כמו מחט של מצפן.'],
    ranger: ['{name} למד לקרוא עקבות, מזג אוויר ושממה, ולצוד את סוג הדברים שצדים אנשים.'],
    rogue: ['{name} למד שהתשובה השקטה והחכמה מנצחת בדרך כלל את הרועשת, ושמנעולים הם רק הצעה.'],
    sorcerer: ['זה היה הרגע שבו הקסם בדם של {name} התעורר, פרוע ובלי שהתבקש.'],
    warlock: ['באותה שעה אפלה קול הציע כוח תמורת מחיר, ו{name} הסכים עוד לפני ששמע את כל התנאים.'],
    wizard: ['{name} פנה ללימוד, משוכנע שמספיק ידע יכול לתקן הכול, אפילו את זה.'],
    '*': ['כך הפך {name} ל{cls}, ומאז לא הביט לאחור.'],
  },
  traits: [
    'צחוק מהיר, סליחה איטית.',
    'פנקס קטן עם כל מי שפגש בדרך.',
    'תמיד יש חטיף בכיס, ותמיד מתחלקים בו.',
    'מזמזם כשהוא לחוץ, כלומר לעיתים קרובות.',
    'כל דלת נעולה היא אתגר אישי.',
    'תמיד שאלה אחת יותר מדי.',
    'שלווה במשבר; בלגן בשוק.',
    'נותן שם לכל סוס, פרד ועכברוש אמיץ במיוחד.',
  ],
  ideals: {
    good: ['רחמים. לכל אחד מגיעה הזדמנות שנייה.', 'הגנה. החלשים לעולם לא צריכים לפגוש את החושך לבד.'],
    evil: ['כוח. העולם מתכופף בפני מי שחזק מספיק לכופף אותו.', 'שאפתנות. שום דבר לא יעמוד ביני לבין מה שמגיע לי.'],
    law: ['חובה. הבטחה היא שרשרת שאני בוחר לענוד.', 'סדר. בלי חוקים, החזקים פשוט טורפים את החלשים.'],
    chaos: ['חירות. בלי כתר, בלי כלוב, בלי אדון.', 'שינוי. מחר לעולם לא צריך להיראות כמו אתמול.'],
    neutral: ['איזון. לכל ניצחון יש מחיר; משלמים אותו בעיניים פקוחות.', 'סקרנות. האמת חשובה יותר ממי שהיא פוגעת בו או עוזרת לו.'],
  },
  bonds: [
    'אח או אחות עדיין מחכים בבית למכתב שעוד לא נכתב.',
    'טבעת ששייכת למישהו שלא שרד.',
    'חוב חיים לזר ששמו מעולם לא נודע.',
    'שבועה למצוא את מי שהצית את האש.',
    'המילים האחרונות של המורה הן חידה שעדיין לא נפתרה.',
    'מוכן לעשות הכול בשביל החברים מהדרך, גם אם קשה להגיד את זה בקול.',
  ],
  flaws: [
    'לא מסוגל לסרב להתערבות, גם גרועה.',
    'סומך מהר מדי על כל מי שמראה טוב-לב.',
    'שומר טינה כמו ירושה משפחתית.',
    'משקר על דברים קטנים בלי שום סיבה.',
    'קופא כשמזכירים את העבר.',
    'מאמין, עמוק בפנים, שמישהו אחר היה צריך לשרוד במקומו.',
  ],
  hooks: [
    'מישהו שם בחוץ מחפש את {name}, והוא לא ידידותי.',
    'מכר ישן מהעבר של {name} עומד להופיע ולבקש טובה.',
    'המפה מאותו לילה עדיין לא גמורה, והחלק החסר קרוב.',
    '{name} עדיין לא יודע למה כל זה קרה, והתשובה לא תהיה נוחה.',
  ],
  labels: { personality: 'אישיות', ideal: 'אידיאל', bond: 'קשר', flaw: 'חולשה', hook: 'חוט עלילה לשה"מ' },
}

export const PHRASES: Record<Locale, Phrases> = { en, he }
