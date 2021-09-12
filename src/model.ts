export interface Link {
  path: string;
  displayText: string;
  slug?: string;
}

export interface LinkTree {
  label: string;
  children?: (Link | LinkTree)[];
}

export type LinkNode = Link | LinkTree;

export interface FileRef {
  title: string;
  path: string;
}

export interface File extends FileRef {
  body: string;
}

export interface SiteFile {
  id: string;
  structureFile: File;
}

export interface SiteLinks {
  id: string;

  blogLinks: TreeLeaf[];
  pageLinks: TreeLeaf[];
  navbarLinks: TreeNode[];
  sidebarLinks: TreeNode[];
}

/** Represents a piece of content in the source system. */
export interface Source {
  /** A canonical identifier for a piece of content in the source system. */
  id: string;

  /**
   * A filepath relative to the root of the source system.
   *
   * This should always start with `/`.
   */
  filepath: string;

  /** The name to use when displaying this content to an end user. */
  defaultDisplayName: string;
}

/** A bundle of metadata about a piece of content in the target system. */
export interface Target {
  /** A canonical identifier for a piece of content in the target system. */
  id: string;

  /**
   * The pathname of the absolute URL to locate the content in the target system.
   *
   * This should always start with `/`.
   */
  pathname: string;
}

/**
 * A mapping between source and target pieces of content.
 *
 * Pieces of content that previously linked to a source should now link to the corresponding target.
 */
// export type SourceToTarget = { [key: string]: Target };

export interface Site {
  logo: { path: string };
  path: string;
  repo: string;
  url: string;
  title: string;

  blog: Blog;
  pages: Pages;
  navbar: Navbar;
  sidebar: Sidebar;
}

export type DocumentIndex = { [key: string]: Document };

export interface Blog {
  posts: DocumentIndex;
}

export interface Pages {
  docs: DocumentIndex;
}

export interface Document {
  sourcePath: string;
  slug?: string;
  category?: "blog" | "docs";
  // source: Source;
}

export interface Navbar {
  items: NavbarItem[];
}

export interface Sidebar {
  items: TreeNode[];
}

export type NavbarItem = TreeNode & {
  // to: string;
  // label: string;
  position?: string;
};

export interface TreeBranch {
  label: string;
  children?: TreeNode[];
}

export interface TreeLeaf extends Document {
  label: string;
}

export type TreeNode = TreeBranch | TreeLeaf;
