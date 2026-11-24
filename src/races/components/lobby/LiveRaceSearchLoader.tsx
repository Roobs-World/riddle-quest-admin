import {SpinningWheelLoader} from "../../../app/components/feedback/SpinningWheelLoader";
import {tr} from "../../../localization/browser/i18n";

export function LiveRaceSearchLoader() {
  return <SpinningWheelLoader className="live-race-search-loader" message={tr("RaceTo10.LIVE_FINDING")} />;
}
