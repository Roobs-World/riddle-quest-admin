import {createHash} from "node:crypto";

/** One hundred short verbs keep generated opponent names within ten characters. */
const VERBS = [
  "Act", "Add", "Aim", "Ask", "Bake", "Beam", "Bend", "Bind", "Blink", "Bloom",
  "Blow", "Boil", "Bolt", "Bound", "Bow", "Braid", "Break", "Brew", "Bring", "Brush",
  "Build", "Bump", "Burn", "Buzz", "Call", "Camp", "Carry", "Carve", "Catch", "Chase",
  "Cheer", "Chew", "Clap", "Clean", "Climb", "Close", "Cook", "Count", "Crawl", "Creep",
  "Cross", "Curl", "Dance", "Dare", "Dash", "Dig", "Dive", "Dodge", "Draw", "Dream",
  "Drift", "Drink", "Drive", "Drop", "Drum", "Earn", "Eat", "Fade", "Fetch", "Find",
  "Fish", "Fix", "Float", "Flow", "Fly", "Fold", "Glow", "Grab", "Grin", "Grow",
  "Guide", "Help", "Hide", "Hike", "Hold", "Hop", "Hug", "Hunt", "Jive", "Jog",
  "Join", "Joke", "Jump", "Kick", "Knit", "Land", "Laugh", "Leap", "Learn", "Lift",
  "Look", "March", "Melt", "Mix", "Move", "Nod", "Paint", "Play", "Pull", "Push",
];

/** One hundred short nouns pair independently with the verbs. */
const NOUNS = [
  "Ant", "Ape", "Bat", "Bear", "Bee", "Bird", "Boar", "Bull", "Carp", "Cat",
  "Clam", "Colt", "Crab", "Crow", "Cub", "Deer", "Dog", "Dove", "Duck", "Eel",
  "Elk", "Emu", "Fawn", "Finch", "Flea", "Fly", "Foal", "Fox", "Frog", "Goat",
  "Goose", "Gull", "Hare", "Hawk", "Hen", "Heron", "Hippo", "Horse", "Hound", "Jay",
  "Koala", "Lamb", "Lark", "Lemur", "Lion", "Lynx", "Mite", "Mole", "Moose", "Moth",
  "Mouse", "Newt", "Otter", "Owl", "Panda", "Pike", "Pony", "Prawn", "Quail", "Ram",
  "Raven", "Robin", "Seal", "Shark", "Sheep", "Shrew", "Skunk", "Sloth", "Snail", "Snake",
  "Squid", "Stag", "Stoat", "Swan", "Swift", "Tiger", "Toad", "Trout", "Tuna", "Vole",
  "Wasp", "Whale", "Wolf", "Wren", "Yak", "Zebra", "Acorn", "Birch", "Brook", "Cedar",
  "Cloud", "Coral", "Dune", "Fern", "Flame", "Flint", "Frost", "Leaf", "Maple", "Moss",
];

/** The server-owned seed fixes both independent word choices across transaction retries. */
export function generateRaceBotName(seed: string): string {
  const verbIndex = createHash("sha256").update(`${seed}:verb`).digest().readUInt32BE(0) % VERBS.length;
  const nounIndex = createHash("sha256").update(`${seed}:noun`).digest().readUInt32BE(0) % NOUNS.length;
  return `${VERBS[verbIndex]}${NOUNS[nounIndex]}`;
}
