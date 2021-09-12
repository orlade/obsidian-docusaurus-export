import _ from "lodash";
import { ObsimianPlugin } from "obsimian";
import { Document, ref, Site } from "./model";
import { SiteBuilder } from "./pipeline";
import { ObsimianContentStore } from "./store";
import { extractStructure, findStructureFiles } from "./structure";
import { navbarToItems } from "./template/templates";

const testData = require("../test/obsidian-docusaurus-export-test.json");

// describe("ObsidianContentStore", () => {
//   const plugin = new ObsimianPlugin(testData);
//   const cs = new ObsimianContentStore({ plugin });

//   it("loads files", () => {
//     const path = "Page Simple.md";
//     const expected = testData["vault.read(*)"][path];
//     expect(cs.loadFile({ title: "", path })).resolves.toMatchObject({
//       body: expected,
//     });
//   });
// });

describe("structure", () => {
  const plugin = new ObsimianPlugin(testData);
  const cs = new ObsimianContentStore({ plugin });
  const sb = new SiteBuilder(cs);

  it("finds in store", () => {
    expect(findStructureFiles(cs)).resolves.toMatchObject([
      {
        id: "test",
        structureFile: {
          title: "Structure.md",
          path: "Structure.md",
        },
      },
    ]);
  });

  it("extracts from store", () => {
    return findStructureFiles(cs).then(([s]) => {
      return expect(extractStructure(cs, s)).resolves.toMatchObject({
        id: "test",
        blogLinks: [{ label: "Blog Simple", sourcePath: "Blog Simple.md" }],
        pageLinks: [
          { label: "Docs Landing Page", sourcePath: "Docs Landing Page.md", slug: "/" },
          { label: "Page Simple", sourcePath: "Page Simple.md" },
          { label: "Page Links", sourcePath: "Page Links.md" },
          { label: "Page Slug", sourcePath: "Page Slug.md" },
          {
            label: "Obsidian to Docusaurus Mapping",
            sourcePath: "Obsidian to Docusaurus Mapping.md",
          },
        ],
        navbarLinks: [
          { label: "My Docs", sourcePath: "Docs Landing Page.md" },
          {
            label: "Menu",
            children: [
              { label: "Docs Landing Page", sourcePath: "Docs Landing Page.md" },
              { label: "Label", sourcePath: "Docs Landing Page.md" },
            ],
          },
        ],
        sidebarLinks: [
          {
            label: "docs",
            children: [
              { label: "Welcome", sourcePath: "Docs Landing Page.md" },
              { label: "Page Simple", sourcePath: "Page Simple.md" },
              { label: "Page Links", sourcePath: "Page Links.md" },
              { label: "Page Slug", sourcePath: "Page Slug.md" },
              {
                label: "This Plugin",
                children: [
                  {
                    label: "Mappings",
                    sourcePath: "Obsidian to Docusaurus Mapping.md",
                  },
                ],
              },
            ],
          },
        ],
      });
    });
  });

  it("enriches content", async () => {
    const sourcePath = "Page Simple.md";
    const doc: Document = { sourcePath };

    await sb.enrichContent(doc);

    expect(doc).toEqual({
      sourcePath,
      content: "Simplest page.",
    });
  });

  it("replaces links", async () => {
    const sourcePath = "Page Links.md";
    const doc: Document = { sourcePath };
    await sb.enrichContent(doc);
    const site: Site = {
      blog: { posts: { "Blog Simple.md": { sourcePath: "Blog Simple.md" } } },
      pages: { docs: { "Page Simple.md": {}, "Page Links.md": {}, "Page Slug.md": {} } },
    } as any as Site;

    await sb.replaceLinks(doc, site);

    expect(doc).toEqual({
      sourcePath,
      content: `Page with links.

[Page Simple](/docs/Page%20Simple)

[Page Links](/docs/Page%20Links)

[Page Slug](/docs/slug)

[Blog Simple](/blog/Blog%20Simple)
`,
    });
  });

  describe("test site", () => {
    const props = {
      title: "foo",
      url: "foo.com",
      repo: "github.com/bar/foo",
      path: "path/to/repo",
    };

    it("builds", () => {
      return expect(sb.build(props)).resolves.toMatchObject({
        title: "foo",
        url: "foo.com",
        repo: "github.com/bar/foo",
        path: "path/to/repo",
        logo: { path: "" },

        blog: {
          posts: {
            "Blog Simple.md": {
              label: "Blog Simple",
              sourcePath: "Blog Simple.md",
              content: /.+/,
            },
          },
        },
        pages: {
          docs: {
            "Docs Landing Page.md": {
              label: "Docs Landing Page",
              sourcePath: "Docs Landing Page.md",
              content: /.+/,
            },
            "Page Simple.md": {
              label: "Page Simple",
              sourcePath: "Page Simple.md",
              content: /.+/,
            },
            "Page Links.md": {
              label: "Page Links",
              sourcePath: "Page Links.md",
            },
            "Page Slug.md": {
              label: "Page Slug",
              sourcePath: "Page Slug.md",
            },
            "Obsidian to Docusaurus Mapping.md": {
              label: "Obsidian to Docusaurus Mapping",
              sourcePath: "Obsidian to Docusaurus Mapping.md",
              content: /.+/,
            },
          },
        },
        navbar: {
          items: [
            { label: "My Docs", sourcePath: "Docs Landing Page.md", slug: "/", category: "docs" },
            {
              label: "Menu",
              children: [
                {
                  label: "Docs Landing Page",
                  sourcePath: "Docs Landing Page.md",
                  slug: "/",
                  category: "docs",
                },
                {
                  label: "Label",
                  sourcePath: "Docs Landing Page.md",
                  slug: "/",
                  category: "docs",
                },
              ],
            },
            { label: "Blog", sourcePath: "/blog" },
          ],
        },
        sidebar: {
          items: [
            {
              label: "docs",
              children: [
                {
                  label: "Welcome",
                  sourcePath: "Docs Landing Page.md",
                  slug: "/",
                  category: "docs",
                },
                { label: "Page Simple", sourcePath: "Page Simple.md", category: "docs" },
                { label: "Page Links", sourcePath: "Page Links.md", category: "docs" },
                { label: "Page Slug", sourcePath: "Page Slug.md", slug: "/slug", category: "docs" },
                {
                  label: "This Plugin",
                  children: [
                    {
                      label: "Mappings",
                      sourcePath: "Obsidian to Docusaurus Mapping.md",
                      category: "docs",
                    },
                  ],
                },
              ],
            },
          ],
        },
      });
    });

    it("build navbar", async () => {
      const site = await sb.build(props);
      const navbar = navbarToItems(site.navbar);
      expect(navbar).toMatchObject([
        { label: "My Docs", to: "/docs/" },
        {
          label: "Menu",
          type: "dropdown",
          items: [
            { label: "Docs Landing Page", to: "/docs/" },
            { label: "Label", to: "/docs/" },
          ],
        },
        { label: "Blog", to: "/blog" },
      ]);
    });

    it("writes", async () => {
      const site = await sb.build(props);
      await sb.write(site);

      // expect(cs.copies).toEqual({
      //   // Blog
      //   "Blog Simple.md": [`${props.path}/blog/Blog Simple.md`],
      //   // Docs
      //   "Page Simple.md": [`${props.path}/docs/Page Simple.md`],
      //   "Docs Landing Page.md": [`${props.path}/docs/Docs Landing Page.md`],
      //   "Obsidian to Docusaurus Mapping.md": [
      //     `${props.path}/docs/Obsidian to Docusaurus Mapping.md`,
      //   ],
      // });

      const config = cs.writes[`${props.path}/docusaurus.config.js`];
      //       expect(cs.writes).toMatchObject({
      //         [`${props.path}/docusaurus.config.js`]: [/.*/],
      //         [`${props.path}/sidebars.js`]: [
      //           new RegExp(
      //             `module.exports = {
      //   "Sidebar name": [
      //     "Page Simple",
      //     "Page Simple with label",
      //     {
      //       "Category label": [
      //         "Page Simple",
      //         "Page Simple with label"
      //       ]
      //     }
      //   ]
      // }`
      //           ),
      //         ],
      //         [`${props.path}/.gitignore`]: [/.*/],
      //         [`${props.path}/package.json`]: [/.*/],
      //         [`${props.path}/babel.config.js`]: [/.*/],
      //         [`${props.path}/src/css/custom.css`]: [/.*/],
      //       });

      //       expect(cs.writes[`${props.path}/sidebars.js`][0]).toMatch(/Sidebar name/);
    });
  });
});
