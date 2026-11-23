import {useState, type FormEvent} from "react";
import {useTranslator} from "../../i18n";
import {canSubmitUsername, normalizeUsernameInput, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH} from "./usernameForm";

/** Props required to submit a profile username change. */
export type UsernameModalPageProps = {
  /** Stores on update username. */
  onUpdateUsername: (username: string) => void;
};

/** Renders and owns the transient username editing form state. */
export function UsernameModalPage({onUpdateUsername}: UsernameModalPageProps) {
  /** Copy changes invalidate compiler caches while preserving local page state. */
  const tr = useTranslator();
  /** Provides [username, set username] behavior. */
  const [username, setUsername] = useState("");
  /** Normalizes d username. */
  const normalizedUsername = normalizeUsernameInput(username);
  /** Indicates whether can submit. */
  const canSubmit = canSubmitUsername(username);

  /** Normalizes and submits a valid username to the authoritative profile handler. */
  const submitUsername = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    onUpdateUsername(normalizedUsername);
    setUsername("");
  };

  return (
    <form className="username-form" onSubmit={submitUsername}>
      <label>
        {tr("Profile.USERNAME_LABEL")}
        <input
          autoFocus
          minLength={USERNAME_MIN_LENGTH}
          maxLength={USERNAME_MAX_LENGTH}
          value={username}
          placeholder={tr("Profile.ENTER_NEW_USERNAME_PLACEHOLDER")}
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>
      <button className="play-primary" disabled={!canSubmit}>
        {tr("Profile.SAVE_BUTTON")}
      </button>
    </form>
  );
}
