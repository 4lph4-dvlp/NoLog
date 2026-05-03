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

  /** Publication status from the `Status` (select) property — "public" etc. */
  status: string;
}
