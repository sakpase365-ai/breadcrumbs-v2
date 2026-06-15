// ── Spark Prompt Library ──────────────────────────────────────
// Curated library of prompts that help families preserve emotional presence
// across generations. Selection algorithm balances category, emotional weight,
// frequency, and 60-day recency history.

export type SparkCategory =
  | 'everyday'
  | 'love-affirmation'
  | 'family-stories'
  | 'childhood'
  | 'faith'
  | 'work-purpose'
  | 'identity-values'
  | 'humor'
  | 'love-relationships'
  | 'mistakes-regrets'
  | 'resilience'
  | 'money'
  | 'milestone'
  | 'hidden'
  | 'history'
  | 'legacy';

export interface SparkPrompt {
  id: string;
  category: SparkCategory;
  question: string;
  emotionalWeight: 'light' | 'medium' | 'heavy';
  frequency: 'common' | 'occasional' | 'rare';
}

export const SPARK_LIBRARY: SparkPrompt[] = [

  // ── Everyday Life (16%) ───────────────────────────────────────
  { id: 'ev-01', category: 'everyday', question: 'What does a typical Tuesday look like in your life right now — and what about it would you want them to remember?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'ev-02', category: 'everyday', question: 'Describe your morning routine. What is the one small thing in it that you actually enjoy?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'ev-03', category: 'everyday', question: 'What is something you do almost every day that you hope feels familiar to them someday?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'ev-04', category: 'everyday', question: 'What is your version of a perfect weekend — not the one you describe to people, the one you actually want?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'ev-05', category: 'everyday', question: 'What does your kitchen smell like when you are cooking something you love?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'ev-06', category: 'everyday', question: 'What is the most honest thing you can say about how you spend your time right now?', emotionalWeight: 'medium', frequency: 'common' },
  { id: 'ev-07', category: 'everyday', question: 'Describe a regular evening at home — what does the house sound like, and who is in it?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'ev-08', category: 'everyday', question: 'What small habit have you built that has quietly made your life better?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'ev-09', category: 'everyday', question: 'What do you do with the first 30 minutes after you wake up, and does it match who you want to be?', emotionalWeight: 'medium', frequency: 'common' },
  { id: 'ev-10', category: 'everyday', question: 'What does rest look like for you — real rest, not just stopping?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'ev-11', category: 'everyday', question: 'Describe a meal that always makes you feel at home, wherever you are.', emotionalWeight: 'light', frequency: 'common' },
  { id: 'ev-12', category: 'everyday', question: 'What is the most honest thing you can say about your phone habits right now?', emotionalWeight: 'medium', frequency: 'common' },
  { id: 'ev-13', category: 'everyday', question: 'What does your neighborhood or street look like? What do you notice that others might walk past?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'ev-14', category: 'everyday', question: 'What do you talk about with your closest people when no one is performing or being impressive?', emotionalWeight: 'medium', frequency: 'common' },
  { id: 'ev-15', category: 'everyday', question: 'What is one ordinary thing you do that you secretly find very satisfying?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'ev-16', category: 'everyday', question: 'What music, podcast, or show are you into right now — and what does it say about where your head is?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'ev-17', category: 'everyday', question: 'What is the last thing that made you laugh out loud when you were alone?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'ev-18', category: 'everyday', question: 'How do you handle a bad day — what do you actually do, not what you think you should do?', emotionalWeight: 'medium', frequency: 'common' },
  { id: 'ev-19', category: 'everyday', question: 'What does your commute, your drive, or your walk to work look like — and what do you think about during it?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'ev-20', category: 'everyday', question: 'What is something small and unremarkable about today that you would want them to know happened?', emotionalWeight: 'light', frequency: 'common' },

  // ── Love & Affirmation (13%) ──────────────────────────────────
  { id: 'la-01', category: 'love-affirmation', question: 'What do you want them to know you see in them — specifically, not generally?', emotionalWeight: 'medium', frequency: 'common' },
  { id: 'la-02', category: 'love-affirmation', question: 'When did you look at them and feel something so strong you did not have words for it?', emotionalWeight: 'medium', frequency: 'common' },
  { id: 'la-03', category: 'love-affirmation', question: 'What is one quality you hope they never let the world talk them out of?', emotionalWeight: 'medium', frequency: 'common' },
  { id: 'la-04', category: 'love-affirmation', question: 'Describe a moment when you were proud of them that you may never have said out loud.', emotionalWeight: 'medium', frequency: 'common' },
  { id: 'la-05', category: 'love-affirmation', question: 'What do you want them to know about how much space they take up in your daily thoughts?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'la-06', category: 'love-affirmation', question: 'What do you love most about spending time with them — be specific, not sentimental?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'la-07', category: 'love-affirmation', question: 'Tell them about a time they did something ordinary that you found extraordinary.', emotionalWeight: 'light', frequency: 'common' },
  { id: 'la-08', category: 'love-affirmation', question: 'What do you want them to carry into the world that you believe they already have inside them?', emotionalWeight: 'medium', frequency: 'common' },
  { id: 'la-09', category: 'love-affirmation', question: 'What do you want them to know they are allowed to want from life?', emotionalWeight: 'medium', frequency: 'common' },
  { id: 'la-10', category: 'love-affirmation', question: 'Tell them something you admire about them that has nothing to do with achievement.', emotionalWeight: 'light', frequency: 'common' },
  { id: 'la-11', category: 'love-affirmation', question: 'What would you want them to remember about how your face looked when they walked into a room?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'la-12', category: 'love-affirmation', question: 'What do you hope they feel on the day they read this — and what would you say to create that feeling?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'la-13', category: 'love-affirmation', question: 'What is the kindest, most honest thing you could say to them right now?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'la-14', category: 'love-affirmation', question: 'When did you realize the love you feel for them was different from any love you had known before?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'la-15', category: 'love-affirmation', question: 'What do you want them to know you were rooting for — in them, specifically?', emotionalWeight: 'medium', frequency: 'common' },
  { id: 'la-16', category: 'love-affirmation', question: 'Tell them about a worry you carried for them, and how it turned into hope.', emotionalWeight: 'medium', frequency: 'occasional' },

  // ── Family Stories (11%) ──────────────────────────────────────
  { id: 'fs-01', category: 'family-stories', question: 'Tell a story about a family gathering that ended in laughter no one expected.', emotionalWeight: 'light', frequency: 'common' },
  { id: 'fs-02', category: 'family-stories', question: 'Describe the house you grew up in — not just the rooms, but what it felt like to be inside it.', emotionalWeight: 'medium', frequency: 'common' },
  { id: 'fs-03', category: 'family-stories', question: 'Who in your family had a gift nobody talked about — and what was it?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'fs-04', category: 'family-stories', question: 'Tell the story of how your parents met, as much as you know it.', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'fs-05', category: 'family-stories', question: 'What is one family tradition that has outlasted everyone who started it?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'fs-06', category: 'family-stories', question: 'Describe a family member who is difficult to explain to people who never knew them.', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'fs-07', category: 'family-stories', question: 'Tell a story about a holiday or celebration where something went wrong and it became a better story because of it.', emotionalWeight: 'light', frequency: 'common' },
  { id: 'fs-08', category: 'family-stories', question: 'What is a story about your grandparents or great-grandparents that you hope never gets lost?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'fs-09', category: 'family-stories', question: 'What is something your family always did that you only later realized was unusual?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'fs-10', category: 'family-stories', question: 'Tell the story of the biggest move or transition your family made — and how it changed everyone.', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'fs-11', category: 'family-stories', question: 'Who was the most stubborn person in your family, and tell a story that proves it.', emotionalWeight: 'light', frequency: 'common' },
  { id: 'fs-12', category: 'family-stories', question: 'What piece of family history do you wish someone had written down before it was lost?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'fs-13', category: 'family-stories', question: 'Tell a story about sibling rivalry, family competition, or a longstanding argument that became affectionate over time.', emotionalWeight: 'light', frequency: 'common' },
  { id: 'fs-14', category: 'family-stories', question: 'What is the story of where your family name comes from, and what does it mean to carry it?', emotionalWeight: 'medium', frequency: 'occasional' },

  // ── Childhood & Growing Up (9%) ───────────────────────────────
  { id: 'ch-01', category: 'childhood', question: 'What did you do for fun at 10 years old that you still think about?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'ch-02', category: 'childhood', question: 'Describe your childhood bedroom — what was in it, and what did it feel like to be there alone?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'ch-03', category: 'childhood', question: 'Who was your best friend growing up, and what did you love about them?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'ch-04', category: 'childhood', question: 'What did you want to be when you grew up — and how do you feel about that now?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'ch-05', category: 'childhood', question: 'Tell about a teacher who either believed in you or did not — and what that did to you.', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'ch-06', category: 'childhood', question: 'What did your parents do on weekends, and what did it teach you about how adults were supposed to be?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'ch-07', category: 'childhood', question: 'Describe a summer from your childhood — where were you, who was there, what did it smell like?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'ch-08', category: 'childhood', question: 'What is something you believed as a child that you had to unlearn, and when did that happen?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'ch-09', category: 'childhood', question: 'Tell about a moment in childhood when you felt genuinely free — what were you doing?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'ch-10', category: 'childhood', question: 'What did your family struggle with when you were young that you only understood as an adult?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'ch-11', category: 'childhood', question: 'What did dinner look like in your house growing up — who cooked, who talked, who was quiet?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'ch-12', category: 'childhood', question: 'What song, book, or movie from your childhood still puts you right back there?', emotionalWeight: 'light', frequency: 'common' },

  // ── Faith & Spiritual Formation (9%) ──────────────────────────
  { id: 'fa-01', category: 'faith', question: 'Tell about a moment when something shifted in how you understand God, meaning, or what holds the world together.', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'fa-02', category: 'faith', question: 'What do you believe about prayer — not what you think you should believe, but what your actual experience has been?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'fa-03', category: 'faith', question: 'Describe a place where you have felt closest to something bigger than yourself.', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'fa-04', category: 'faith', question: 'What do you want them to know about doubt — how you have lived with it, and what it has done to your faith?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'fa-05', category: 'faith', question: 'Tell about a time your faith was tested in a way that felt very quiet and private — not dramatic, just hard.', emotionalWeight: 'heavy', frequency: 'occasional' },
  { id: 'fa-06', category: 'faith', question: 'What do you hope they carry from your spiritual life, without telling them what to believe?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'fa-07', category: 'faith', question: 'Who taught you what it looked like to live with integrity — and how did they do it?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'fa-08', category: 'faith', question: 'What is a verse, phrase, or idea you have returned to many times without knowing exactly why?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'fa-09', category: 'faith', question: 'How do you talk to God, or whatever you reach toward in hard moments — be honest about the form it takes.', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'fa-10', category: 'faith', question: 'What does Sabbath, rest, or stillness mean to you — and how well are you actually practicing it?', emotionalWeight: 'light', frequency: 'occasional' },
  { id: 'fa-11', category: 'faith', question: 'Tell about a person of faith who made you want to be better without ever telling you to be.', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'fa-12', category: 'faith', question: 'What do you believe about what happens after death, and has that belief changed over time?', emotionalWeight: 'heavy', frequency: 'rare' },

  // ── Work & Purpose (9%) ───────────────────────────────────────
  { id: 'wp-01', category: 'work-purpose', question: 'What is the most satisfying thing you have ever built, made, or helped create — inside or outside of a job?', emotionalWeight: 'medium', frequency: 'common' },
  { id: 'wp-02', category: 'work-purpose', question: 'Tell about your first real job — what surprised you, what embarrassed you, and what you took from it.', emotionalWeight: 'light', frequency: 'common' },
  { id: 'wp-03', category: 'work-purpose', question: 'What does your work give you beyond money — and what does it take that money does not replace?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'wp-04', category: 'work-purpose', question: 'Describe the worst job you ever had and what it taught you about what you actually need.', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'wp-05', category: 'work-purpose', question: 'What is a skill you have built that you are genuinely proud of — one most people would not know to ask you about?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'wp-06', category: 'work-purpose', question: 'Tell about a boss or mentor who changed how you see yourself professionally — for better or worse.', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'wp-07', category: 'work-purpose', question: 'What work have you done that felt meaningful even when no one was watching or praising it?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'wp-08', category: 'work-purpose', question: 'What do you wish someone had told you about work before you started — not ambition, the unglamorous part?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'wp-09', category: 'work-purpose', question: 'What is something you make or do with your hands that you want them to know about?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'wp-10', category: 'work-purpose', question: 'When have you felt closest to doing the thing you were made to do?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'wp-11', category: 'work-purpose', question: 'What do you want them to understand about ambition — what it is good for and what it costs?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'wp-12', category: 'work-purpose', question: 'Tell about a time you did something hard at work that no one saw — and why you still did it.', emotionalWeight: 'medium', frequency: 'occasional' },

  // ── Identity & Values (8%) ────────────────────────────────────
  { id: 'iv-01', category: 'identity-values', question: 'What do you believe that most people around you do not — and how did you come to believe it?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'iv-02', category: 'identity-values', question: 'What is a line you have never crossed, even when you could have — and why?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'iv-03', category: 'identity-values', question: 'What does integrity look like in your daily life — not in principle, in practice?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'iv-04', category: 'identity-values', question: 'What part of who you are took the longest to stop apologizing for?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'iv-05', category: 'identity-values', question: 'What is a belief you used to hold confidently that you have since changed — and what changed it?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'iv-06', category: 'identity-values', question: 'What is something about your culture, heritage, or background that you want to pass forward without losing?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'iv-07', category: 'identity-values', question: 'What does loyalty mean to you, and tell a story that shows what it looks like when you live it?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'iv-08', category: 'identity-values', question: 'What do you think is the most important thing a person can be — not do, be?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'iv-09', category: 'identity-values', question: 'What part of your upbringing do you want to repeat with them, and what do you want to do differently?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'iv-10', category: 'identity-values', question: 'What does home mean to you — not a place, the feeling?', emotionalWeight: 'light', frequency: 'occasional' },

  // ── Humor & Joy (8%) ─────────────────────────────────────────
  { id: 'hj-01', category: 'humor', question: 'Tell the most embarrassing thing that ever happened to you in public — spare no detail.', emotionalWeight: 'light', frequency: 'common' },
  { id: 'hj-02', category: 'humor', question: 'What is the funniest thing a child has ever said to you?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'hj-03', category: 'humor', question: 'Tell about a time you laughed so hard at the wrong moment that it made everything worse.', emotionalWeight: 'light', frequency: 'common' },
  { id: 'hj-04', category: 'humor', question: 'What is something you genuinely find funny that you know says something about you?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'hj-05', category: 'humor', question: 'Describe a family inside joke that would mean nothing to anyone outside your house.', emotionalWeight: 'light', frequency: 'common' },
  { id: 'hj-06', category: 'humor', question: 'What is the dumbest thing you ever did that somehow worked out fine?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'hj-07', category: 'humor', question: 'Tell about an animal encounter, a car trip, or a vacation that went completely sideways.', emotionalWeight: 'light', frequency: 'common' },
  { id: 'hj-08', category: 'humor', question: 'What is something you were deeply, sincerely wrong about for years — and find funny now?', emotionalWeight: 'light', frequency: 'common' },
  { id: 'hj-09', category: 'humor', question: 'Tell a story about you at their age that makes you simultaneously cringe and laugh.', emotionalWeight: 'light', frequency: 'common' },
  { id: 'hj-10', category: 'humor', question: 'What has brought you the most uncomplicated, uncomplicated joy recently?', emotionalWeight: 'light', frequency: 'common' },

  // ── Love & Relationships (part of spec) ───────────────────────
  { id: 'lr-01', category: 'love-relationships', question: 'What do you know about love now that you did not know in your twenties — and what changed?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'lr-02', category: 'love-relationships', question: 'Tell about a friendship that taught you something you did not expect to need.', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'lr-03', category: 'love-relationships', question: 'What do you want them to know about choosing a partner — the unglamorous parts included?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'lr-04', category: 'love-relationships', question: 'Describe a relationship in your life that was hard to leave and what finally clarified it for you.', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'lr-05', category: 'love-relationships', question: 'What does a good apology look like to you — and tell about a time you finally got one right?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'lr-06', category: 'love-relationships', question: 'What have you learned about love that surprised you — something that was not in any story or song?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'lr-07', category: 'love-relationships', question: 'Tell about a friendship you miss — what made it irreplaceable, and what happened to it?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'lr-08', category: 'love-relationships', question: 'What does it mean to you to be a good friend, and how well are you living that right now?', emotionalWeight: 'medium', frequency: 'occasional' },

  // ── Mistakes & Regrets (6%) ───────────────────────────────────
  { id: 'mr-01', category: 'mistakes-regrets', question: 'Tell about a mistake you made publicly and how you faced the people who saw it.', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'mr-02', category: 'mistakes-regrets', question: 'What is something you did to someone that took you a long time to make right — or that you have not yet?', emotionalWeight: 'heavy', frequency: 'occasional' },
  { id: 'mr-03', category: 'mistakes-regrets', question: 'What decision are you still proud of, even though it cost you something?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'mr-04', category: 'mistakes-regrets', question: 'What did you fail at that taught you more than any success?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'mr-05', category: 'mistakes-regrets', question: 'Tell about a time your pride got in the way — and what you eventually did about it.', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'mr-06', category: 'mistakes-regrets', question: 'What is something you wish you had said to someone while you still had the chance?', emotionalWeight: 'heavy', frequency: 'occasional' },
  { id: 'mr-07', category: 'mistakes-regrets', question: 'What is a risk you took that did not pay off — and would you take it again?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'mr-08', category: 'mistakes-regrets', question: 'What is something you are still working on in yourself that you want them to see clearly, not around?', emotionalWeight: 'medium', frequency: 'occasional' },

  // ── Resilience & Hardship (4%) ────────────────────────────────
  { id: 're-01', category: 'resilience', question: 'Describe a season of your life that was hard to survive and harder to explain — what got you through it?', emotionalWeight: 'heavy', frequency: 'occasional' },
  { id: 're-02', category: 'resilience', question: 'Tell about a time you felt completely alone in something — and who or what finally reached you.', emotionalWeight: 'heavy', frequency: 'occasional' },
  { id: 're-03', category: 'resilience', question: 'What do you do when you are overwhelmed that you want them to have permission to do too?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 're-04', category: 'resilience', question: 'What has chronic difficulty — long grief, sustained pressure, ongoing loss — taught you that relief could not?', emotionalWeight: 'heavy', frequency: 'occasional' },
  { id: 're-05', category: 'resilience', question: 'Tell about a time you had to stand alone in something — and how you found your footing.', emotionalWeight: 'heavy', frequency: 'occasional' },
  { id: 're-06', category: 'resilience', question: 'What is something you thought would break you that did not — and what are you different because of it?', emotionalWeight: 'medium', frequency: 'occasional' },

  // ── Money & Stewardship (2%) ──────────────────────────────────
  { id: 'mo-01', category: 'money', question: 'What did money mean in the home you grew up in — spoken or unspoken?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'mo-02', category: 'money', question: 'Tell about a financial decision you made that you are still learning from.', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'mo-03', category: 'money', question: 'What do you want them to understand about generosity — not as obligation, as a way of living?', emotionalWeight: 'medium', frequency: 'occasional' },
  { id: 'mo-04', category: 'money', question: 'What is the most honest thing you can say about your relationship with money right now?', emotionalWeight: 'medium', frequency: 'occasional' },

  // ── Milestone Guidance (2%) ───────────────────────────────────
  { id: 'mg-01', category: 'milestone', question: 'What do you want them to know before they leave home for the first time?', emotionalWeight: 'medium', frequency: 'rare' },
  { id: 'mg-02', category: 'milestone', question: 'What advice do you have for the first year of marriage — not the romantic version, the real one?', emotionalWeight: 'medium', frequency: 'rare' },
  { id: 'mg-03', category: 'milestone', question: 'What do you wish someone had told you before you became a parent?', emotionalWeight: 'medium', frequency: 'rare' },
  { id: 'mg-04', category: 'milestone', question: 'What would you want them to know in the season after a big loss — what helped you, in plain terms?', emotionalWeight: 'heavy', frequency: 'rare' },

  // ── Hidden Questions (1%) ─────────────────────────────────────
  { id: 'hq-01', category: 'hidden', question: 'What is a question you have never been asked that you have always wanted someone to ask?', emotionalWeight: 'medium', frequency: 'rare' },
  { id: 'hq-02', category: 'hidden', question: 'What is something true about you that almost no one knows — something you would want them to know?', emotionalWeight: 'medium', frequency: 'rare' },
  { id: 'hq-03', category: 'hidden', question: 'What are you still figuring out — not a problem to solve, just something you are still sitting with?', emotionalWeight: 'medium', frequency: 'rare' },

  // ── This Moment in History (1%) ───────────────────────────────
  { id: 'hi-01', category: 'history', question: 'What is happening in the world right now that you want them to understand from your perspective — not the news version?', emotionalWeight: 'medium', frequency: 'rare' },
  { id: 'hi-02', category: 'history', question: 'What is something about the time we are living in that you think future generations will find hard to believe?', emotionalWeight: 'medium', frequency: 'rare' },
  { id: 'hi-03', category: 'history', question: 'Tell about a moment in history you lived through — what did it feel like from the inside, not what you later understood?', emotionalWeight: 'medium', frequency: 'rare' },

  // ── Legacy & Mortality (1%) ───────────────────────────────────
  { id: 'lg-01', category: 'legacy', question: 'If you could only leave them one thing — not an object, a truth — what would it be?', emotionalWeight: 'heavy', frequency: 'rare' },
  { id: 'lg-02', category: 'legacy', question: 'What do you hope they say about you when they talk about you to their own children?', emotionalWeight: 'heavy', frequency: 'rare' },
  { id: 'lg-03', category: 'legacy', question: 'What has your life been for — not what you accomplished, what it was for?', emotionalWeight: 'heavy', frequency: 'rare' },
];

// ── History Tracking ──────────────────────────────────────────

const SPARK_HISTORY_KEY   = 'breadcrumbs_spark_history_v1';
const HISTORY_WINDOW_DAYS = 75;

interface SparkHistoryEntry {
  text:    string;
  shownAt: number;
}

interface SparkSelectionState {
  recentCategories: SparkCategory[];
  lastWeight:       'light' | 'medium' | 'heavy' | null;
}

export function loadSparkHistory(): SparkHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SPARK_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SparkHistoryEntry[];
    const cutoff = Date.now() - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return Array.isArray(parsed) ? parsed.filter((e) => e.shownAt > cutoff) : [];
  } catch {
    return [];
  }
}

export function saveSparkToHistory(text: string): void {
  if (typeof window === 'undefined') return;
  try {
    const history = loadSparkHistory();
    // Avoid duplicates
    const fingerprint = text.trim().toLowerCase().slice(0, 240);
    const alreadyTracked = history.some(
      (e) => e.text.trim().toLowerCase().slice(0, 240) === fingerprint,
    );
    if (!alreadyTracked) {
      history.push({ text, shownAt: Date.now() });
    }
    window.localStorage.setItem(SPARK_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // localStorage unavailable — non-fatal
  }
}

export function getSparkHistoryTexts(): string[] {
  return loadSparkHistory().map((e) => e.text);
}

// ── Selection Algorithm ───────────────────────────────────────

const FREQUENCY_WEIGHT: Record<SparkPrompt['frequency'], number> = {
  common:     3,
  occasional: 2,
  rare:       1,
};

function buildWeightedPool(prompts: SparkPrompt[]): SparkPrompt[] {
  return prompts.flatMap((p) => Array(FREQUENCY_WEIGHT[p.frequency]).fill(p) as SparkPrompt[]);
}

function fingerprintText(text: string): string {
  return text.trim().toLowerCase().slice(0, 240);
}

export function pickSpark(
  opts: {
    excludeTexts?:     string[];
    selectionState?:   SparkSelectionState;
  } = {},
): SparkPrompt {
  const { excludeTexts = [], selectionState } = opts;

  const excludeSet = new Set(excludeTexts.map(fingerprintText).filter(Boolean));

  // 1. Remove recently seen prompts
  let pool = SPARK_LIBRARY.filter(
    (p) => !excludeSet.has(fingerprintText(p.question)),
  );
  if (pool.length === 0) pool = [...SPARK_LIBRARY];

  // 2. Apply category constraint — avoid showing the same category more than
  //    twice in a row by filtering it out when it was the last two picks
  if (selectionState && selectionState.recentCategories.length >= 2) {
    const lastTwo = selectionState.recentCategories.slice(-2);
    if (lastTwo[0] === lastTwo[1]) {
      const filtered = pool.filter((p) => p.category !== lastTwo[0]);
      if (filtered.length > 0) pool = filtered;
    }
  }

  // 3. Apply emotional balance — after a heavy prompt, prefer lighter ones
  if (selectionState?.lastWeight === 'heavy') {
    const lighter = pool.filter((p) => p.emotionalWeight !== 'heavy');
    if (lighter.length > 0) pool = lighter;
  }

  // 4. Never surface grief/hardship/regret/legacy consecutively
  const heavyCategories = new Set<SparkCategory>(['resilience', 'mistakes-regrets', 'legacy', 'milestone']);
  if (
    selectionState &&
    selectionState.recentCategories.length >= 1 &&
    heavyCategories.has(selectionState.recentCategories[selectionState.recentCategories.length - 1])
  ) {
    const levity = pool.filter((p) => !heavyCategories.has(p.category));
    if (levity.length > 0) pool = levity;
  }

  // 5. Apply frequency weighting and pick
  const weighted = buildWeightedPool(pool);
  return weighted[Math.floor(Math.random() * weighted.length)];
}

// ── Session State Helpers ─────────────────────────────────────

const SESSION_STATE_KEY = 'breadcrumbs_spark_session_v1';

export function loadSelectionState(): SparkSelectionState {
  if (typeof window === 'undefined') return { recentCategories: [], lastWeight: null };
  try {
    const raw = window.sessionStorage.getItem(SESSION_STATE_KEY);
    if (!raw) return { recentCategories: [], lastWeight: null };
    return JSON.parse(raw) as SparkSelectionState;
  } catch {
    return { recentCategories: [], lastWeight: null };
  }
}

export function saveSelectionState(prompt: SparkPrompt): void {
  if (typeof window === 'undefined') return;
  try {
    const state = loadSelectionState();
    const updated: SparkSelectionState = {
      recentCategories: [...state.recentCategories, prompt.category].slice(-4),
      lastWeight:       prompt.emotionalWeight,
    };
    window.sessionStorage.setItem(SESSION_STATE_KEY, JSON.stringify(updated));
  } catch {
    // non-fatal
  }
}
