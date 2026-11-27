import {useState} from "react";
import {YouTubePlayableApp} from "../../../../src/gameplay/components/local/LocalGameApp";
import {createStandaloneSdkPort} from "../../../../src/app/standalone/standaloneSdk";

export function YahooApp() {
  const [sdk] = useState(createStandaloneSdkPort);
  return <YouTubePlayableApp sdk={sdk} />;
}
