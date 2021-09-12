import { each, isEmpty, flatten, map, keyBy, some } from "lodash";
import { basename, join } from "path";
import { Link, LinkNode, ref, Site, SiteFile, Source, TreeNode } from "./model";
import { ContentStore } from "./store";
import { categorize, extractLinks, extractLinkTree, findStructureFiles } from "./structure";
import {
  babelConfig,
  customCss,
  defaultHome,
  docusaurusConfig,
  gitignore,
  moduleCss,
  packageJson,
  sidebars,
} from "./template/templates";

// Gather published content
// Find all #docusaurus/*/_ structure docs
// Extract spec from structure doc
// Pages
// Blog
// Sidebars
// Navbar
// Logo

// Build an inventory of notes that will be copied, with canonical IDs (e.g. TFile).
// Build a mapping from the canonical IDs to the destination details, e.g. dir, filename, slug, absoluteUrl
// Basically enough information for any link in any context to be rewritten to point to it.

// Read content from vault
// Adjust content
// Remove links that link to non-published content
// Replace wikilinks with md links
// Change links to blog posts from docs/ to blog/
// Write content to repo

// Write config
// Write navbar
// Write sidebars

// Publish
// git add
// git commit
// git pull
// git push

function linkToSource(link: Link): Source {
  return {
    id: link.path,
    filepath: link.path,
    defaultDisplayName: basename(link.path, ".md"),
  };
}

function linkNodeToSources(node: LinkNode): Source[] {
  if ("children" in node) {
    return flatten(node.children.map(linkNodeToSources));
  } else {
    return [linkToSource(node as Link)];
  }
}

export class SiteBuilder {
  store: ContentStore;

  constructor(store: ContentStore) {
    this.store = store;
  }

  async build({ title = "", path, repo, url }): Promise<Site> {
    const site: Site = {
      title,

      path,
      repo,
      url,
      logo: { path: "" },

      blog: {
        posts: {},
      },
      pages: {
        docs: {},
      },
      navbar: {
        items: [],
      },
      sidebar: {
        items: [],
      },
    };

    const store = this.store;

    async function buildIndex(site: Site, file: SiteFile) {
      const ref = file.structureFile;
      const m = await store.getMetadata(ref);
      const linksForHeading = async (h: string) => extractLinks(store, ref, m, h);

      site.blog.posts = keyBy(await linksForHeading("Blog"), "sourcePath");
      site.pages.docs = keyBy(await linksForHeading("Pages"), "sourcePath");

      // Sidebar
      site.sidebar.items = await extractLinkTree(store, ref, m, "Sidebars");
      categorize(site.sidebar.items, site);

      // Navbar
      const navbar = await extractLinkTree(store, ref, m, "Navbar");
      categorize(navbar, site);
      if (!isEmpty(site.blog.posts)) {
        navbar.push({ label: "Blog", sourcePath: "/blog" });
      }
      site.navbar.items.push(...navbar);
    }

    async function enrichContent(site: Site) {
      return Promise.all(
        map([site.blog.posts, site.pages.docs], async (index) =>
          Promise.all(
            map(index, async (p) => (p.content = (await store.loadFile(ref(p.sourcePath))).body))
          )
        )
      );
    }

    const files = await findStructureFiles(store);
    if (files.length !== 1) {
      throw new Error("must be exactly one structure file");
    }

    await buildIndex(site, files[0]);
    await enrichContent(site);
    return site;
  }

  async write(site: Site): Promise<void> {
    console.log("writing site", site.path, site.repo);
    const dir = site.path;
    const logoRelDestPath = join("static", "img", "logo.png");
    const logoDestPath = join(dir, logoRelDestPath);

    const files: { [key: string]: string } = {
      ".gitignore": gitignore(),
      "package.json": packageJson(),
      "babel.config.js": babelConfig(),
      "docusaurus.config.js": await docusaurusConfig(
        {
          title: site.title,
          url: site.url,
        },
        {
          repo: site.repo,
          navbar: site.navbar,
          logoSrc: logoRelDestPath,
        }
      ),
      "sidebars.js": sidebars(site.sidebar),
      "src/pages/index.js": defaultHome(),
      "src/pages/styles.module.css": moduleCss(),
      "src/css/custom.css": customCss(),
    };
    const logoPath = site.logo?.path; // TODO: default.
    if (logoPath) {
      const logo = await this.store.loadFile({ title: "", path: logoPath });
      await this.store.copy(logo, logoDestPath);
    }

    const write = this.store.write.bind(this.store);

    await Promise.all(
      flatten([
        map(files, (content, name) => write(content, join(dir, name))),
        map(site.blog.posts, (post) => write(post.content!, join(dir, "blog", post.sourcePath))),
        map(site.pages.docs, (doc) => write(doc.content!, join(dir, "docs", doc.sourcePath))),
      ])
    );
    console.log("done write");
  }

  // async build() {
  //   const sources: { [key: string]: Source } = {};
  //   // const targets: { [key: string]: Target } = {};

  //   const files = await findStructureFiles(this.store);
  //   const structures = await Promise.all(
  //     files.map(async (f) => await extractStructure(this.store, f))
  //   );

  //   // Build set of all sources.
  //   structures.forEach((s) => {
  //     merge(
  //       sources,
  //       keyBy(map(s.pageLinks, linkToSource), "id"),
  //       keyBy(map(s.blogLinks, linkToSource), "id"),
  //       keyBy(flatten(map(s.navbarLinks, linkNodeToSources)), "id"),
  //       keyBy(flatten(map(s.sidebarLinks, linkNodeToSources)), "id")
  //     );
  //   });

  //   // Build mapping of sources to targets.
  //   await Promise.all(
  //     map(sources, async (source, id): Promise<void> => {
  //       const m = await this.store.getMetadata({
  //         path: source.filepath,
  //         title: "",
  //       });
  //       let pathname = source.filepath;
  //       const slug = m?.frontmatter?.slug;
  //       if (slug) {
  //         slug === "/" ? "index.md" : slug;
  //       }
  //       targets[id] = { id, pathname };
  //     })
  //   );
  //   return { sources, targets };
  // }

  oldPrepare() {
    // console.log("preparing");
    // const files = this.app.vault.getMarkdownFiles();
    // const re = new RegExp(`\\s#docusaurus/([^/]+)/_\\s`);
    // const content: any = {};
    // await Promise.all(
    //   files.map((f) =>
    //     this.app.vault.read(f).then((md) => {
    //       const match = md.match(re);
    //       if (match) {
    //         content[match[1]] = {
    //           path: f.path,
    //           content: md,
    //         };
    //       }
    //     })
    //   )
    // );
    // console.log(content);
    // const prepare = async (name: string) => {
    //   const out: Content = {};
    //   console.log("preparing", name);
    //   const record = content[name];
    //   const { headings, links, embeds, listItems, frontmatter } = this.app.metadataCache.getCache(
    //     record.path
    //   );
    //   console.log("links", links);
    //   console.log("embeds", embeds);
    //   out.title = frontmatter?.title;
    //   const logoLink = embeds.filter((e) => e.displayText.toLowerCase() === "logo")[0]?.link;
    //   out.logo = logoLink && this.app.metadataCache.getFirstLinkpathDest(logoLink, record.path);
    //   const linkOnLine = (line: Number) => links.filter((l) => l.position.start.line === line)[0];
    //   headings.forEach((h, i) => {
    //     const start = h.position.start.line;
    //     const end =
    //       headings.length > i + 1 ? headings[i + 1].position.start.line : Number.MAX_SAFE_INTEGER;
    //     const items = listItems.filter(
    //       (i) => i.position.start.line > start && i.position.end.line < end
    //     );
    //     const fromText = (i: ListItemCache): SidebarBuilder => {
    //       const value = record.content
    //         .substring(i.position.start.offset, i.position.end.offset)
    //         .replace(/^\s*\-\s*/, "");
    //       return { value, children: [] };
    //     };
    //     const fromLink = (l: LinkCache): SidebarBuilder => ({
    //       value: l.link,
    //       children: [],
    //     });
    //     if (h.heading === "Navbar") {
    //       out.navbar = items.map((i) => {
    //         const link = linkOnLine(i.position.start.line);
    //         return {
    //           to: `docs/${link.link}`,
    //           label: link.displayText || link.link,
    //           position: "left",
    //         };
    //       });
    //     } else if (h.heading === "Sidebars") {
    //       const roots: SidebarBuilder[] = [];
    //       const index: { [key: string]: SidebarBuilder } = {};
    //       items.forEach((i) => {
    //         const link = linkOnLine(i.position.start.line);
    //         const si = link ? fromLink(link) : fromText(i);
    //         index[i.position.start.line] = si;
    //         if (i.parent > 0) {
    //           index[i.parent].children.push(si);
    //         } else {
    //           roots.push(si);
    //         }
    //       });
    //       out.sidebars = roots;
    //     } else if (h.heading === "Pages") {
    //       out.pages = items.map((i) => {
    //         const link = linkOnLine(i.position.start.line);
    //         return (link ? fromLink(link) : fromText(i)).value;
    //       });
    //     } else if (h.heading === "Blog") {
    //       out.blog = items.map((i) => {
    //         const link = linkOnLine(i.position.start.line);
    //         return (link ? fromLink(link) : fromText(i)).value;
    //       });
    //     }
    //   });
    //   const vaultDir = (this.app.vault.adapter as FileSystemAdapter).getBasePath();
    //   const repoDir = this.absRepoDir(this.settings.gitRepo);
    //   const copyLink = (dir: string) => async (link: string) => {
    //     const getRealLink = (link: string): string => {
    //       const linkFile = this.app.metadataCache.getFirstLinkpathDest(link, record.path);
    //       const cache = this.app.metadataCache.getFileCache(linkFile);
    //       const slug = cache.frontmatter?.slug;
    //       if (slug) {
    //         return path.join(dir, slug);
    //       } else {
    //         return path.join(dir, clean(linkFile.path));
    //       }
    //     };
    //     const linkFile = this.app.metadataCache.getFirstLinkpathDest(link, record.path);
    //     console.log("copying link", link, "in", record.path, "file", linkFile);
    //     const cache = this.app.metadataCache.getFileCache(linkFile);
    //     // Clean filenames.
    //     let filepath = path.join(dir, clean(linkFile.path));
    //     // Rename to `index.md` if slug is `/`.
    //     const slug = cache.frontmatter?.slug;
    //     if (slug === "/") {
    //       filepath = path.join(dir, "index.md");
    //     } else if (slug) {
    //     }
    //     // Replace wikilinks with Markdown links.
    //     let content = await this.app.vault.read(linkFile);
    //     cache.links &&
    //       clone(cache.links)
    //         .reverse()
    //         .forEach((l) => {
    //           const before = content.substring(0, l.position.start.offset);
    //           const after = content.substr(l.position.end.offset);
    //           content = `${before}[${l.displayText || l.link}](${clean(l.link)})${after}`;
    //         });
    //     fs.mkdirSync(path.dirname(filepath), { recursive: true });
    //     const copy = fs.writeFileSync(
    //       // path.join(vaultDir, linkFile.path),
    //       filepath,
    //       content
    //     );
    //     git.add({
    //       fs,
    //       dir: repoDir,
    //       filepath: path.relative(repoDir, filepath),
    //     });
    //     return copy;
    //   };
    //   const toDocs = copyLink(path.join(repoDir, "docs"));
    //   await Promise.all(
    //     // TODO: Rename copies of pages to their display text/slug. Record in registry to rewrite links.
    //     out.pages
    //       .map(copyLink(path.join(repoDir, "src", "pages")))
    //       .concat(out.blog.map(copyLink(path.join(repoDir, "blog"))))
    //       .concat(out.navbar.map((i) => toDocs(i.to.substr(5))))
    //   );
    //   const sidebarLinks: (b: SidebarBuilder) => string[] = (b: SidebarBuilder) =>
    //     b.children?.length ? flatten(b.children.map(sidebarLinks)) : [b.value];
    //   out.sidebars.forEach((b) => sidebarLinks(b).map(toDocs));
    //   out.navbar = out.navbar.map((n) => {
    //     const target = this.app.metadataCache.getFirstLinkpathDest(n.to.substr(5), record.path);
    //     const slug = this.app.metadataCache.getCache(target.path).frontmatter?.slug || target.path;
    //     return { ...n, to: `docs${slug}` };
    //   });
    //   if (headings.some((h) => h.heading === "Blog")) {
    //     out.navbar.push({
    //       to: "blog",
    //       label: "Blog",
    //       position: "left",
    //     });
    //   }
    //   return out;
    // };
    // const out = await Promise.all(Object.keys(content).map(prepare));
    // console.log(out);
    // out.forEach((c) => this.write(c));
  }
}
