import { merge } from "lodash";
import { Navbar, Sidebar, TreeBranch, TreeLeaf, TreeNode } from "src/model";
import { DocusaurusConfig } from "@docusaurus/types";

export interface NavbarItem {
  to: string;
  label: string;
  position?: string;
}

export interface SidebarBuilder {
  value: string;
  children?: SidebarBuilder[];
}
export interface SidebarObject {
  [key: string]: SidebarItem[];
}
interface SidebarDoc {
  type: "doc";
  id: string;
  label?: string;
}
export type SidebarItem = SidebarObject | SidebarDoc | string;

interface Stringify {
  json: any;
  prefix?: string;
  jsonIndent?: number;
}

function stringify({ json, prefix = "", jsonIndent = 2 }: Stringify): string {
  const str = `${prefix}${JSON.stringify(json, null, jsonIndent)}\n`;
  return str.replace(/"`([^`]+)`"/g, "$1");
}

// interface DocusaurusConfig {
//   title: string;
//   tagline?: string;
//   url: string;
//   baseUrl?: string;
//   favicon?: string;

//   algolia?: {
//     indexName: string;
//     apiKey: string;
//   };
//   googleAnalytics?: {
//     trackingID: string;
//     anonymizeIP: boolean;
//   };

export interface OtherConfig {
  repo: string;
  branch?: string;

  navbar?: Navbar;
  logoSrc: string;
  logoDarkSrc?: string;
}

export function docusaurusConfig(config: any, other: OtherConfig): string {
  let { repo, branch, navbar, logoSrc, logoDarkSrc } = other;
  branch ||= "main";
  repo = repo.replace("https://", "");
  const [orgName, repoName] = repo.split("/");

  const json = merge(
    {
      title: "Obsidian Site",
      tagline: "My Obsidian site",
      url: "",
      baseUrl: "/",
      favicon: "img/favicon.png",
      organizationName: orgName,
      projectName: repoName,
      themeConfig: {
        navbar: {
          title: "",
          logo: {
            alt: "Logo",
            src: logoSrc,
            srcDark: logoDarkSrc ?? undefined,
          },
          items: navbarToItems(navbar),
        },
        footer: {
          copyright: `Copyright © ${new Date().getFullYear()}`,
        },
        colorMode: {
          defaultMode: "light",
          disableSwitch: false,
        },
      },
      presets: [
        [
          "@docusaurus/preset-classic",
          {
            docs: {
              sidebarPath: "`require.resolve('./sidebars.js')`",
              editUrl: `https://${repo}/edit/${branch}/`,
              admonitions: {
                infima: true,
                customTypes: {
                  right: {
                    ifmClass: "success",
                    keyword: "right",
                    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"/></svg>',
                  },
                  wrong: {
                    ifmClass: "danger",
                    keyword: "wrong",
                    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M24 20.188l-8.315-8.209 8.2-8.282-3.697-3.697-8.212 8.318-8.31-8.203-3.666 3.666 8.321 8.24-8.206 8.313 3.666 3.666 8.237-8.318 8.285 8.203z"/></svg>',
                  },
                },
              },
            },
            blog: {
              showReadingTime: true,
              editUrl: `https://${repo}/edit/${branch}/`,
            },
            theme: {
              customCss: "`require.resolve('./src/css/custom.css')`",
            },
          },
        ],
      ],
      plugins: [],
      scripts: [],
      themes: [],
      stylesheets: [
        "https://fonts.googleapis.com/css?family=Lato:wght@400;900|Roboto|Source+Code+Pro",
        "https://at-ui.github.io/feather-font/css/iconfont.css",
      ],
      baseUrlIssueBanner: undefined,
      i18n: undefined,
      noIndex: undefined,
      onBrokenLinks: undefined,
      onBrokenMarkdownLinks: undefined,
      onDuplicateRoutes: undefined,
      trailingSlash: undefined,
    } as DocusaurusConfig,
    config
  );

  return stringify({
    prefix: "module.exports = ",
    json,
  });
}

export type Feature = {
  title: string;
  imageUrl: string;
  description: string | Element;
};

export function defaultHome(features: Feature[] = []): string {
  return `
import React from 'react';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

const features = ${JSON.stringify(features)};

function Feature({imageUrl, title, description}) {
    const imgUrl = useBaseUrl(imageUrl);
    return (
        <div className={clsx('col col--4', styles.feature)}>
            {imgUrl && (
                <div className="text--center">
                    <img className={styles.featureImage} src={imgUrl} alt={title}/>
                </div>
            )}
            <h3>{title}</h3>
            <p>{description}</p>
        </div>
    );
}

function Home() {
    const context = useDocusaurusContext();
    const {siteConfig = {}} = context;
    return (
        <Layout
            title={siteConfig.title}
            description="The ultimate data engine">
            <header className={clsx('hero hero--primary', styles.heroBanner)}>
                <div className="container">
                    <h1 className="hero__title">{siteConfig.title}</h1>
                    <p className="hero__subtitle">{siteConfig.tagline}</p>
                    <div className={styles.buttons}>
                        <Link
                            className={clsx(
                                'button button--outline button--secondary button--lg',
                                styles.getStarted,
                            )}
                            to={useBaseUrl('docs/')}>
                            Get Started
                        </Link>
                    </div>
                </div>
            </header>
            <main>
                {features && features.length > 0 && (
                    <section className={styles.features}>
                        <div className="container">
                            <div className="row">
                                {features.map((props, idx) => (
                                    <Feature key={idx} {...props} />
                                ))}
                            </div>
                        </div>
                    </section>
                )}
            </main>
        </Layout>
    );
}

export default Home;
`;
}

export function moduleCss(): string {
  return `
/**
 * CSS files with the .module.css suffix will be treated as CSS modules
 * and scoped locally.
 */

.heroBanner {
  padding: 4rem 0;
  text-align: center;
  position: relative;
  overflow: hidden;
}

@media screen and (max-width: 966px) {
  .heroBanner {
    padding: 2rem;
  }
}

.buttons {
  display: flex;
  align-items: center;
  justify-content: center;
}

.features {
  display: flex;
  align-items: center;
  padding: 2rem 0;
  width: 100%;
}

.featureImage {
  height: 200px;
  width: 200px;
}
`;
}

export function customCss(): string {
  return `/* stylelint-disable docusaurus/copyright-header */
/**
 * Any CSS included here will be global. The classic template
 * bundles Infima by default. Infima is a CSS framework designed to
 * work well for content-centric websites.
 */

/* You can override the default Infima variables here. */
:root {
	--ifm-color-primary: #007dba;
	--ifm-color-primary-dark: #004165;
	--ifm-color-primary-darker: #394a58;
	--ifm-color-primary-darkest: #253d50;
	--ifm-color-primary-light: rgb(70, 203, 174);
	--ifm-color-primary-lighter: rgb(102, 212, 189);
	--ifm-color-primary-lightest: rgb(146, 224, 208);
	--ifm-code-font-size: 95%;
}

.docusaurus-highlight-code-line {
	background-color: rgb(72, 77, 91);
	display: block;
	margin: 0 calc(-1 * var(--ifm-pre-padding));
	padding: 0 var(--ifm-pre-padding);
}

.navbar__title {
	color: #007dba;
	font-family: Lato, Arial, sans-serif;
	font-size: 2em;
}

.pull-right {
	float: right;
}

html {
	--ifm-color--text--desc: #4a4a4a;
	--ifm-color--text--primary: #007dba;
	--feature-svg--filter: none;
}

html[data-theme="dark"] {
	--ifm-color--text--desc: #ffffff;
	--ifm-color--text--primary: #ffffff;
	--feature-svg--filter: invert(100%) sepia(100%) saturate(100%)
	hue-rotate(346deg) brightness(104%) contrast(97%);
}
.container {
	max-width: 100%;
}

@media (max-width: 1320px) and (min-width: 997px) {
	.container {
	max-width: 100% !important;
	}
}
`;
}

function clean(name: string): string {
  return name.replace(/\?/g, "_").replace(/\.\w+/, "");
}

function href(i: TreeLeaf): string {
  if (i.slug) {
    let href = i.slug;
    if (i.category) {
      href = `/${i.category}${href}`;
    }
    return href;
  } else {
    return i.sourcePath.startsWith("/") ? i.sourcePath : `docs/${i.sourcePath}`;
  }
}

export function navbarToItems(navbar: Navbar): any {
  const itemToItem = (i) => {
    const item: any = {
      label: i.label,
      position: i.position,
    };
    if ("sourcePath" in i) {
      item.to = href(i);
    } else if ("children" in i) {
      item.type = "dropdown";
      item.items = i.children.map(itemToItem);
    }
    return item;
  };
  return navbar.items.map(itemToItem);
}

export function sidebars(roots: Sidebar): string {
  const json: SidebarObject = {};
  const toTree = (i: TreeNode): SidebarItem => {
    if ("children" in i) {
      return {
        [i.label]: i.children.map(toTree),
      };
    } else if ("sourcePath" in i) {
      return {
        type: "doc",
        id: clean(i.sourcePath),
        label: i.label || undefined,
      } as SidebarDoc;
    }
  };
  roots.items.forEach((r: TreeBranch) => (json[r.label] = r.children.map(toTree)));

  return stringify({ prefix: "module.exports = ", json });
}

export function babelConfig(): string {
  return stringify({
    prefix: "module.exports = ",
    json: {
      presets: ["`require.resolve('@docusaurus/core/lib/babel/preset')`"],
    },
  });
}

export function packageJson(): string {
  return stringify({
    json: {
      name: "docusaurus-2-classic-template",
      version: "2.0.0-beta.2",
      private: true,
      scripts: {
        docusaurus: "docusaurus",
        start: "docusaurus start",
        build: "docusaurus build",
        swizzle: "docusaurus swizzle",
        deploy: "docusaurus deploy",
        clear: "docusaurus clear",
        serve: "docusaurus serve",
        "write-translations": "docusaurus write-translations",
        "write-heading-ids": "docusaurus write-heading-ids",
      },
      dependencies: {
        "@docusaurus/core": "2.0.0-beta.2",
        "@docusaurus/preset-classic": "2.0.0-beta.2",
        "@mdx-js/react": "^1.6.21",
        "@svgr/webpack": "^5.5.0",
        clsx: "^1.1.1",
        "file-loader": "^6.2.0",
        "prism-react-renderer": "^1.2.1",
        react: "^17.0.1",
        "react-dom": "^17.0.1",
        "url-loader": "^4.1.1",
      },
      browserslist: {
        production: [">0.5%", "not dead", "not op_mini all"],
        development: ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"],
      },
    },
  });
}

export function gitignore(): string {
  return `# Dependencies
/node_modules

# Production
/build

# Generated files
.docusaurus
.cache-loader

# Misc
.DS_Store
.env.local
.env.development.local
.env.test.local
.env.production.local

npm-debug.log*
yarn-debug.log*
yarn-error.log*
`;
}
