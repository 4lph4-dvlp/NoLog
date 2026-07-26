/**
 * Internal Post type — mapped from Notion database properties.
 * This abstraction decouples the frontend from the raw Notion API response shape.
 */
export interface Post {
  /** Notion page ID (UUID) */
  id: string;

  /** Post title from the `Name` (title) property */
  title: string;

  /** Short description from the `Summary` (rich_text) property */
  summary: string;

  /** Thumbnail image URL from the `Thumbnail` (files) property */
  thumbnail: string | null;

  /**
   * Which `files`-property variant `thumbnail` was read from: `"file"` for an
   * image uploaded directly into Notion, whose URL is a presigned S3 link
   * Notion expires one hour after the page is fetched
   * (see developers.notion.com/docs/retrieving-files); `"external"` for a
   * pasted public URL, which does not expire; `null` when no thumbnail is
   * set. Any consumer embedding `thumbnail` somewhere that cannot be
   * revalidated (an outbound email being the concrete case) MUST treat
   * `"file"` as equivalent to no thumbnail at all.
   */
  thumbnailType: "file" | "external" | null;

  /** Category from the `Category` (select) property */
  category: string;

  /** Tags from the `Tag` (multi_select) property */
  tags: string[];

  /** Author name from the `Author` (people or rich_text) property */
  author: string;

  /** ISO date string from the `CreateDate` (created_time) property */
  createDate: string;

  /** ISO date string from the `EditDate` (last_edited_time) property */
  editDate: string;

  /** Publication status from the `status` (select) property — "public" etc. */
  status: string;

  /** Whether a "public" post has already had its one-time subscriber notification sent — from the `emailed` (checkbox) property. Once true, stays true permanently (see Phase 1 D-02). */
  emailed: boolean;
}
