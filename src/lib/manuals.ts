// External documentation links (POS knowledge base, equipment manuals, ...)
// shown on the /help page and managed from /admin.

export interface ManualLink {
  id: string;
  title: string;
  url: string;
  note?: string; // short "what is this" hint under the title
}

// Documents we wrote ourselves and host in /public/manuals. Unlike ManualLink
// entries these aren't admin-managed — they ship with the app, so they always
// appear on /help, need no setup, and can't be deleted by accident.
export interface HouseDocument {
  id: string;
  title: string;
  file: string; // path under /public
  note?: string;
}

export const HOUSE_DOCUMENTS: HouseDocument[] = [
  {
    id: "keg-purchasing",
    title: "Keg Purchasing & Deposit Refunds",
    file: "/manuals/keg-purchasing-and-deposits.pdf",
    note: "Selling a keg, taking the deposit in Arryved, and refunding returns.",
  },
  {
    id: "audio-video",
    title: "Audio & Video Guide",
    file: "/manuals/audio-video-guide.pdf",
    note: "AV Controller app, Spotify playlists, TV audio, and volume.",
  },
];
