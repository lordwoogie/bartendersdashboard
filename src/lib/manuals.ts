// External documentation links (POS knowledge base, equipment manuals, ...)
// shown on the /help page and managed from /admin.

export interface ManualLink {
  id: string;
  title: string;
  url: string;
  note?: string; // short "what is this" hint under the title
}
