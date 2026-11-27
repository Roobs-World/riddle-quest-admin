export const FACEBOOK_PROFILE_PHOTO_ERROR = "rq_profile_photo_error";
export const FACEBOOK_OVERLAY_DIRECTORY = "facebook-overlays";

export type FacebookProfileOverlayLayout = Readonly<{filename: string; xml: string}>;

const name = '<Text content="{{FBInstant.player.name}}" style="color:white;font:600 16px sans-serif;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;" />';
const cardStyle = "display:flex;align-items:center;gap:8px;min-height:64px;width:100%;overflow:hidden;background:transparent;";

/** The same reviewed XML is emitted as files and supplied to inline SDK factories. */
export const FACEBOOK_PROFILE_LAYOUT: FacebookProfileOverlayLayout = {
  filename: `${FACEBOOK_OVERLAY_DIRECTORY}/profile.xml`,
  xml: `<View style="${cardStyle}"><Image src="{{FBInstant.player.photo}}" onErrorEvent="${FACEBOOK_PROFILE_PHOTO_ERROR}" width="48" style="width:48px;height:48px;border-radius:50%;flex-shrink:0;" />${name}</View>`,
};

export const FACEBOOK_PROFILE_NAME_LAYOUT: FacebookProfileOverlayLayout = {
  filename: `${FACEBOOK_OVERLAY_DIRECTORY}/profile-name.xml`,
  xml: `<View style="${cardStyle}">${name}</View>`,
};
