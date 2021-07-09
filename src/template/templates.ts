import * as path from 'path';
import { merge } from 'lodash'

const template = {}

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
export type SidebarItem = SidebarObject | string;


interface Stringify {
	json: any;
	prefix?: string;
	jsonIndent?: number;
}

function stringify({
	json,
	prefix = '',
	jsonIndent = 2,
}: Stringify) {
	const str = `${prefix}${JSON.stringify(json, null, jsonIndent)}\n`;
	return str.replace(/"`([^`]+)`"/g, '$1');
}

interface DocusaurusConfig {
	title: string;
	tagline?: string;
	url: string;
	baseUrl?: string;
	favicon?: string;

	algolia?: {
		indexName: string;
		apiKey: string;
	};
	googleAnalytics?: {
		trackingID: string;
		anonymizeIP: boolean,
	};

	other: {
		repo: string;
		branch?: string;

		navbar?: NavbarItem[];
		logoSrc: string;
	};
}

export function docusaurusConfig(config: DocusaurusConfig) {
	let {repo, branch, navbar, logoSrc} = config.other;
	branch ||= 'main';
	repo = repo.replace('https://', '');
	const [orgName, repoName,] = repo.split('/');
	config.other = undefined;

	const json = merge({
		title: 'Obsidian Site',
		tagline: 'My Obsidian site',
		url: "",
		baseUrl: "/",
		favicon: "img/favicon.png",
		organizationName: orgName,
		projectName: repoName,
		themeConfig: {
			navbar: {
				title: "",
				logo: {
					alt: '', //"Sysl Logo",
					src: logoSrc, //"img/logo-blue.png",
					// srcDark: '', //"img/logo-white.png",
				},
				items: navbar,
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
	}, config);

	return stringify({
		prefix: 'module.exports = ',
		json,
	});
}

function clean(name: string): string {
	return name.replace(/\?/g, '_');
}

export function sidebars(roots: SidebarBuilder[]) {
	const json: SidebarObject = {};
	const toTree = (i: SidebarBuilder): SidebarItem =>
		i.children.length
			? { [i.value]: i.children.map(toTree) }
			: clean(i.value);
	roots.forEach(r => json[r.value] = r.children.map(toTree));

	return stringify({ prefix: 'module.exports = ', json })
}

export function babelConfig() {
	return stringify({
		prefix: 'module.exports = ',
		json: {
			presets: ["`require.resolve('@docusaurus/core/lib/babel/preset')`"]
		}
	});
}

export function packageJson() {
	return stringify({
		json: {
			"name": "docusaurus-2-classic-template",
			"version": "2.0.0-beta.2",
			"private": true,
			"scripts": {
				"docusaurus": "docusaurus",
				"start": "docusaurus start",
				"build": "docusaurus build",
				"swizzle": "docusaurus swizzle",
				"deploy": "docusaurus deploy",
				"clear": "docusaurus clear",
				"serve": "docusaurus serve",
				"write-translations": "docusaurus write-translations",
				"write-heading-ids": "docusaurus write-heading-ids"
			},
			"dependencies": {
				"@docusaurus/core": "2.0.0-beta.2",
				"@docusaurus/preset-classic": "2.0.0-beta.2",
				"@mdx-js/react": "^1.6.21",
				"@svgr/webpack": "^5.5.0",
				"clsx": "^1.1.1",
				"file-loader": "^6.2.0",
				"prism-react-renderer": "^1.2.1",
				"react": "^17.0.1",
				"react-dom": "^17.0.1",
				"url-loader": "^4.1.1"
			},
			"browserslist": {
				"production": [
					">0.5%",
					"not dead",
					"not op_mini all"
				],
				"development": [
					"last 1 chrome version",
					"last 1 firefox version",
					"last 1 safari version"
				]
			}
		}
	})
}

export function gitignore() {
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
