import {tr} from "../../i18n";

/** One displayed project credit. */
type Credit = readonly [name: string, role: string];

/** Stable project credits displayed in the credits modal. */
const PROJECT_CREDITS: readonly Credit[] = [
  ["Craig Beswetherick", "Lead Developer & Game Design"],
  ["Reuben Beswetherick", "Inspiration"],
  ["Mike Hawkyard", "Game Designer, Publisher, Overall Hero"],
  ["Gavin Harrison", "Sound Design"],
  ["Nathalia", "Design"],
  ["Mr Ben", "Design"],
];

/** Stable legal and support rows displayed in the about modal. */
const ABOUT_LEGAL_KEYS = [
  "RIDDLE_QUEST_WEBSITE",
  "PRIVACY_POLICY",
  "TERMS_OF_USE",
  "ACCOUNT_DELETION",
  "DATA_EXPORT",
  "THIRD_PARTY_LICENSES",
  "SUPPORT",
] as const;

/** Renders gameplay instructions and color-clue guidance. */
export function InstructionsModalPage({onClose}: {onClose: () => void}) {
  return (
    <div className="instructions-page">
      <p>{tr("Instructions.GOAL_DESCRIPTION")}</p>
      <h3>{tr("Instructions.COLOR_CLUES_TITLE")}</h3>
      <p><i className="clue green">A</i>{tr("Instructions.COLOR_CORRECT")}</p>
      <p><i className="clue yellow">B</i>{tr("Instructions.COLOR_MISPLACED")}</p>
      <p><i className="clue red">C</i>{tr("Instructions.COLOR_WRONG")}</p>
      <h3>{tr("Instructions.TIPS_TITLE")}</h3>
      <p>{tr("Instructions.TIPS_DESCRIPTION")}</p>
      <button className="play-primary" onClick={onClose}>{tr("Instructions.GOT_IT_BUTTON")}</button>
    </div>
  );
}

/** Renders the project credits and acknowledgements. */
export function CreditsModalPage() {
  return (
    <div className="credits-list">
      <p>{tr("Credits.SUBTITLE")}</p>
      {PROJECT_CREDITS.map(([name, role]) => (
        <article key={name}><strong>{name}</strong><span>{role}</span></article>
      ))}
      <h3>{tr("Credits.THANK_YOU_TITLE")}</h3>
      <p>{tr("Credits.THANK_YOU_TEXT")}</p>
    </div>
  );
}

/** Renders translated website, legal, privacy, and support information. */
export function AboutModalPage() {
  return (
    <div className="about-list">
      {ABOUT_LEGAL_KEYS.map((key) => <div key={key}>{tr(`AboutLegal.${key}`)}</div>)}
    </div>
  );
}
