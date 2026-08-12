import {tr} from "../../i18n";

/** One displayed project credit. */
type Credit = readonly [name: string, roleKey: string];

/** Stable project credits displayed in the credits modal. */
const PROJECT_CREDITS: readonly Credit[] = [
  ["Craig Beswetherick", "Credits.ROLE_LEAD_DEVELOPER_GAME_DESIGN"],
  ["Reuben Beswetherick", "Credits.ROLE_INSPIRATION"],
  ["Mike Hawkyard", "Credits.ROLE_GAME_DESIGNER_PUBLISHER_HERO"],
  ["Gavin Harrison", "Credits.ROLE_SOUND_DESIGN"],
  ["Nathalia", "Credits.ROLE_DESIGN"],
  ["Mr Ben", "Credits.ROLE_DESIGN"],
];

/** Verified Riddle Quest support mailbox. */
const SUPPORT_EMAIL = "grindheadgames@gmail.com";

/** Stable legal/support row order and the verified action, if one exists. */
const ABOUT_LEGAL_ROWS = [
  ["ACCOUNT_DELETION", "profile"],
  ["DATA_EXPORT", "contact"],
  ["THIRD_PARTY_LICENSES", "licenses"],
  ["SUPPORT", "contact"],
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
      {PROJECT_CREDITS.map(([name, roleKey]) => (
        <article key={name}><strong>{name}</strong><span>{tr(roleKey)}</span></article>
      ))}
      <h3>{tr("Credits.THANK_YOU_TITLE")}</h3>
      <p>{tr("Credits.THANK_YOU_TEXT")}</p>
    </div>
  );
}

/** Renders translated account, data-contact, license, and support information. */
export function AboutModalPage({onOpenModal}: {onOpenModal: (modal: "profile") => void}) {
  return (
    <div className="about-list">
      {ABOUT_LEGAL_ROWS.map(([key, action]) => {
        if (action === "profile") {
          return <button className="about-list-row about-list-action" type="button" key={key}
            onClick={() => onOpenModal("profile")}>{tr(`AboutLegal.${key}`)}</button>;
        }
        if (action === "contact") {
          return <div className="about-list-row" key={key}>
            {tr(`AboutLegal.${key}`)} <span dir="ltr">{SUPPORT_EMAIL}</span>
          </div>;
        }
        return <a className="about-list-row about-list-action" href="./third-party-licenses.txt"
          key={key}>{tr(`AboutLegal.${key}`)}</a>;
      })}
    </div>
  );
}
