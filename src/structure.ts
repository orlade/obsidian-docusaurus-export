import { findIndex } from "lodash";
import { CachedMetadata, CacheItem, LinkCache, ListItemCache } from "obsidian";
import {
  File,
  FileRef,
  Link,
  LinkNode,
  LinkTree,
  Site,
  SiteFile,
  SiteLinks,
  TreeBranch,
  TreeLeaf,
  TreeNode,
} from "./model";
import { ContentStore } from "./store";

export async function findStructureFiles(store: ContentStore): Promise<SiteFile[]> {
  const re = /(?:^|\s)#docusaurus\/([^\/]+)\/_\b/;
  const refs = await store.getTextFiles();
  const fs = await Promise.all(refs.map(async (ref) => await store.loadFile(ref)));

  const matchSiteFile: (f: File) => SiteFile | null = (f: File) => {
    const match = f.body.match(re);
    return match && { id: match[1], structureFile: f };
  };
  return fs.map(matchSiteFile).filter((r) => r);
}

export async function extractStructure(store: ContentStore, sref: SiteFile): Promise<SiteLinks> {
  const ref = sref.structureFile;
  const m = await store.getMetadata(ref);
  return {
    ...sref,
    blogLinks: await extractLinks(store, ref, m, "Blog"),
    pageLinks: await extractLinks(store, ref, m, "Pages"),
    navbarLinks: await extractLinkTree(store, ref, m, "Navbar"),
    sidebarLinks: await extractLinkTree(store, ref, m, "Sidebars"),
  };
}

function forHeading(heading: string, m: CachedMetadata): CachedMetadata {
  const i = findIndex(m.headings, (h) => h.heading === heading);
  if (i === -1) {
    return {};
  }
  const p = m.headings[i].position;
  const start = p.start.line;
  const end =
    i < m.headings.length - 1 ? m.headings[i + 1].position.start.line : Number.MAX_SAFE_INTEGER;
  const inRange = (i: CacheItem) => i.position.start.line > start && i.position.end.line < end;
  return {
    headings: m.headings?.filter(inRange),
    links: m.links?.filter(inRange),
    listItems: m.listItems?.filter(inRange),
  };
}

function linkOnLine(links: LinkCache[], line: Number): LinkCache {
  return links.find((l) => l.position.start.line === line);
}

async function toLink(store: ContentStore, c: LinkCache): Promise<TreeLeaf> {
  const ref: FileRef = {
    title: c.displayText,
    path: `${c.link}.md`,
  };
  const meta = await store.getMetadata(ref);
  return {
    label: c.displayText,
    sourcePath: ref.path,
    slug: meta?.frontmatter?.slug,
  };
}

function getText(f: File, i: ListItemCache): string {
  return f.body.substring(i.position.start.offset, i.position.end.offset).replace(/^\s*\-\s*/, "");
}

/** Extracts the links under a heading. */
export async function extractLinks(
  store: ContentStore,
  f: File,
  m: CachedMetadata,
  heading: string
): Promise<TreeLeaf[]> {
  m = forHeading(heading, m);
  if (!m.listItems) {
    return [];
  }
  return Promise.all(
    m.listItems
      .map((i) => linkOnLine(m.links, i.position.start.line))
      .map(async (i) => toLink(store, i))
  );
}

/** Converts the link content under a heading into a tree. */
export async function extractLinkTree(
  store: ContentStore,
  file: File,
  meta: CachedMetadata,
  heading: string
): Promise<TreeNode[]> {
  meta = forHeading(heading, meta);

  const roots: TreeNode[] = [];
  const index: { [key: string]: TreeNode } = {};

  async function toNode(item: ListItemCache): Promise<TreeNode> {
    const link = linkOnLine(meta.links, item.position.start.line);
    return link ? await toLink(store, link) : { label: getText(file, item), children: [] };
  }

  const nodes = await Promise.all(meta.listItems?.map(toNode));
  nodes.forEach((node, i) => {
    const item = meta.listItems?.[i];
    index[item.position.start.line] = node;

    if (item.parent < 0) {
      roots.push(node);
    } else {
      (index[item.parent] as TreeBranch).children.push(node);
    }
  });
  return roots;
}

/** Enriches tree nodes with a category. */
export function categorize(tree: TreeNode[], site: Site) {
  tree?.forEach((item) => {
    if ("sourcePath" in item) {
      if (item.sourcePath in site.blog.posts) {
        item.category = "blog";
      } else if (item.sourcePath in site.pages.docs) {
        item.category = "docs";
      }
    } else {
      categorize(item.children, site);
    }
  });
}
