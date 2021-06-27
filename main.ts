import { App, FileSystemAdapter, LinkCache, ListItemCache, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

import * as path from 'path'
import git from 'isomorphic-git'
import http from 'isomorphic-git/http/node'
import * as fs from 'fs'
import {merge} from 'lodash'

interface MyPluginSettings {
	gitRepo: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	gitRepo: '',
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		(window as any).plugin = this;
		console.log('loading plugin');

		await this.loadSettings();

		this.addRibbonIcon('dice', 'Open Docusaurus website', () => {
			new Notice(`open ${this.settings.gitRepo}`);
		});

		// this.addStatusBarItem().setText('Status Bar Text');

		this.addCommand({
			id: 'open-docusaurus-website',
			name: 'Open Docusaurus website',
			// callback: () => {
			// 	console.log('Simple Callback');
			// },
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						// new SampleModal(this.app).open();
					}
					return true;
				}
				return false;
			}
		});
		this.addCommand({
			id: 'clone-docusaurus-website',
			name: 'Clone Docusaurus website',
			callback: () => {
				console.log('clone command');
				this.clone()
			}
		});
		this.addCommand({
			id: 'prepare-docusaurus-website',
			name: 'Prepare Docusaurus website',
			callback: () => {
				console.log('prepare command');
				this.prepareContent()
			}
		});

		this.addSettingTab(new SampleSettingTab(this.app, this));

		this.registerCodeMirror((cm: CodeMirror.Editor) => {
			console.log('codemirror', cm);
		});

		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
		console.log('unloading plugin');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		console.log('saving settings', this.settings)
		await this.saveData(this.settings);
	}

	absRepoDir() {
		return path.join(
			(this.app.vault.adapter as FileSystemAdapter).getBasePath(),
			this.manifest.dir,
			'repos',
			this.settings.gitRepo.replace('https://', '').replace('.git', '')
		);
	}

	clone() {
		const dir = this.absRepoDir();
		git.clone({ fs, http, dir, url: this.settings.gitRepo })
			.then(() => console.log('git result', arguments));
	}

	async prepareContent() {
		console.log('preparing');
		const files = this.app.vault.getMarkdownFiles();
		const re = new RegExp(`\\s#docusaurus/([^/]+)/_\\s`);
		const content: any = {};
		await Promise.all(files.map(f => this.app.vault.read(f)
			.then(md => {
				const match = md.match(re);
				if (match) {
					content[match[1]] = {
						path: f.path,
						content: md,
					}
				}
			})
		));
		console.log(content)

		const prepare = async (name: string) => {
			const out: Content = {};
			console.log('preparing', name)
			const record = content[name];
			const {headings, links, listItems} = this.app.metadataCache.getCache(record.path);

			const linkOnLine = (line: Number) => links.filter(l => l.position.start.line === line)[0];
			headings.forEach((h, i) => {
				const start = h.position.start.line;
				const end = headings.length > i + 1
					? headings[i+1].position.start.line
					: Number.MAX_SAFE_INTEGER;
				const items = listItems.filter(i => i.position.start.line > start && i.position.end.line < end);

				const fromText = (i: ListItemCache): SidebarBuilder => {
					const value = record.content
						.substring(i.position.start.offset, i.position.end.offset)
						.replace(/^\s*\-\s*/, '');
					return {value, children: []};
				};
				const fromLink = (l: LinkCache): SidebarBuilder => ({value: l.link, children: []});

				if (h.heading === 'Navbar') {
					out.navbar = items.map(i => {
						const link = linkOnLine(i.position.start.line);
						return {
							path: link.displayText,
							label: link.link,
							position: "left",
						};
					});
				} else if (h.heading === 'Sidebars') {
					const roots: SidebarBuilder[] = [];
					const index: {[key: string]: SidebarBuilder} = {};
					items.forEach(i => {
						const link = linkOnLine(i.position.start.line);
						const si = link ? fromLink(link) : fromText(i);
						index[i.position.start.line] = si;
						if (i.parent > 0) {
							index[i.parent].children.push(si);
						} else {
							roots.push(si);
						}
					});
					const toTree = (i: SidebarBuilder): SidebarItem =>
						i.children.length ? {[i.value]: i.children.map(toTree)} : i.value;
					out.sidebars = roots.map(toTree);
				} else if (h.heading === 'Pages') {
					out.pages = items.map(i => {
						const link = linkOnLine(i.position.start.line);
						return (link ? fromLink(link) : fromText(i)).value;
					});
				} else if (h.heading === 'Blog') {
					out.blog = items.map(i => {
						const link = linkOnLine(i.position.start.line);
						return (link ? fromLink(link) : fromText(i)).value;
					});
				}
			});

			const vaultDir = (this.app.vault.adapter as FileSystemAdapter).getBasePath();
			const repoDir = this.absRepoDir();
			const docsDir = path.join(repoDir, 'docs');
			const copyLink = (link: string) => {
				const linkFile = this.app.metadataCache.getFirstLinkpathDest(link, record.path);
				const filepath = path.join(docsDir, linkFile.path);
				fs.mkdirSync(path.dirname(filepath), {recursive: true})
				const copy = fs.copyFileSync(
					path.join(vaultDir, linkFile.path),
					filepath
				);
				git.add({ fs, dir: repoDir, filepath: path.relative(repoDir, filepath) });
				return copy;
			}
			await Promise.all(
				out.pages.map(copyLink)
					.concat(out.blog.map(copyLink))
			)
			return out
		}
		const out = await Promise.all(Object.keys(content).map(prepare));
		console.log(out);
		out.forEach(c => this.write(c));
	}

	write(content: Content) {
		const repoDir = this.absRepoDir();
		const docusaurusConfig = `
module.exports = {
	themeConfig: {
		navbar: {
			items: ${JSON.stringify(content.navbar)}
		}
	},
	presets: [
		[
			"@docusaurus/preset-classic",
			{
				docs: {
					sidebarPath: require.resolve("./sidebars.js"),
				},
				community: {
					homePageId: "discussions",
					sidebarPath: require.resolve("./sidebars.js"),
				},
				blog: {
					showReadingTime: true,
					editUrl: "${this.settings.gitRepo}/edit/master/",
				},
				//theme: {
				//	customCss: require.resolve("./src/css/custom.css"),
				//},
			},
		],
	],
};
`;
		const sidebars = `module.exports = ${JSON.stringify(merge({}, ...content.sidebars), null, 2)}`;
		fs.writeFileSync(path.join(repoDir, "sidebars.js"), sidebars);
		fs.writeFileSync(path.join(repoDir, "docusaurus.config.js"), docusaurusConfig);
	}
}

interface NavbarItem {
	path: string;
	label: string;
	position?: string;
}

interface SidebarBuilder {
	value: string;
	children: SidebarBuilder[];
}
interface SidebarObject {
	[key: string]: SidebarItem[];
}
type SidebarItem = SidebarObject | string;

interface Content {
	navbar?: NavbarItem[];
	sidebars?: SidebarItem[];
	pages?: string[];
	blog?: string[];
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let {containerEl} = this;

		containerEl.empty();

		// containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

		new Setting(containerEl)
			.setName('Git repo')
			.setDesc('URL to the Git repository to export to')
			.addText(text => text
				.setPlaceholder('https://github.com/you/repo')
				.setValue(this.plugin.settings.gitRepo)
				.onChange(async (value) => {
					this.plugin.settings.gitRepo = value;
					await this.plugin.saveSettings();
				}));
	}
}
