import { App, FileSystemAdapter, LinkCache, ListItemCache, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';

import * as path from 'path'
import * as fs from 'fs-extra'
import git from 'isomorphic-git'
import http from 'isomorphic-git/http/node'
import { clone, flatten } from 'lodash'
import { docusaurusConfig, babelConfig, packageJson, gitignore, sidebars, NavbarItem, SidebarBuilder, SidebarItem } from './template/templates.js'

interface MyPluginSettings {
	gitRepo: string;
	siteTitle: string;
	siteUrl: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	gitRepo: '',
	siteTitle: 'My Obsidian Export',
	siteUrl: '',
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		(window as any).plugin = this;
		console.log('loading plugin');

		await this.loadSettings();

		// this.addStatusBarItem().setText('Status Bar Text');

		this.addCommand({
			id: 'open-docusaurus-website',
			name: 'Open Docusaurus website',
			callback: () => {
				console.log('Open Docusaurus website');
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

	basePath(): string {
		return (this.app.vault.adapter as FileSystemAdapter).getBasePath();
	}

	absPluginDir(): string {
		return path.join(this.basePath(), this.manifest.dir);
	}

	relRepoDir(repo: string): string {
		return path.join(
			this.manifest.dir,
			'repos',
			repo.replace('https://', '').replace('.git', '')
		);
	}

	absRepoDir(repo: string): string {
		return path.join(this.basePath(), this.relRepoDir(repo));
	}

	clone() {
		const dir = this.absRepoDir(this.settings.gitRepo);
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
			const { headings, links, embeds, listItems, frontmatter } = this.app.metadataCache.getCache(record.path);

			console.log('links', links);
			console.log('embeds', embeds);
			out.title = frontmatter?.title;
			const logoLink = embeds.filter(e => e.displayText.toLowerCase() === "logo")[0]?.link;
			out.logo = logoLink && this.app.metadataCache.getFirstLinkpathDest(logoLink, record.path);

			const linkOnLine = (line: Number) => links.filter(l => l.position.start.line === line)[0];
			headings.forEach((h, i) => {
				const start = h.position.start.line;
				const end = headings.length > i + 1
					? headings[i + 1].position.start.line
					: Number.MAX_SAFE_INTEGER;
				const items = listItems.filter(i => i.position.start.line > start && i.position.end.line < end);

				const fromText = (i: ListItemCache): SidebarBuilder => {
					const value = record.content
						.substring(i.position.start.offset, i.position.end.offset)
						.replace(/^\s*\-\s*/, '');
					return { value, children: [] };
				};
				const fromLink = (l: LinkCache): SidebarBuilder => ({ value: l.link, children: [] });

				if (h.heading === 'Navbar') {
					out.navbar = items.map(i => {
						const link = linkOnLine(i.position.start.line);
						return {
							to: `docs/${link.link}`,
							label: link.displayText || link.link,
							position: "left",
						};
					});
				} else if (h.heading === 'Sidebars') {
					const roots: SidebarBuilder[] = [];
					const index: { [key: string]: SidebarBuilder } = {};
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
					out.sidebars = roots;
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
			const repoDir = this.absRepoDir(this.settings.gitRepo);

			// const linksToCopy = {};
			// out.pages.forEach(p => linksToCopy[] = path.join(repoDir, 'src', 'pages'))
			// 	copyLink())

			const copyLink = (dir: string) => async (link: string) => {
				const linkFile = this.app.metadataCache.getFirstLinkpathDest(link, record.path);
				const filepath = path.join(dir, linkFile.path);
				fs.mkdirSync(path.dirname(filepath), { recursive: true })

				const cache = this.app.metadataCache.getFileCache(linkFile);
				let content = await this.app.vault.read(linkFile);
				cache.links && clone(cache.links).reverse().forEach(l => {
					const before = content.substring(0, l.position.start.offset);
					const after = content.substr(l.position.end.offset);
					content = `${before}[${l.displayText || l.link}](${encodeURIComponent(l.link)})${after}`
				});

				const copy = fs.writeFileSync(
					// path.join(vaultDir, linkFile.path),
					filepath, content
				);

				git.add({ fs, dir: repoDir, filepath: path.relative(repoDir, filepath) });
				return copy;
			}
			const toDocs = copyLink(path.join(repoDir, 'docs'));
			await Promise.all(
				// TODO: Rename copies of pages to their display text/slug. Record in registry to rewrite links.
				out.pages.map(copyLink(path.join(repoDir, 'src', 'pages')))
					.concat(out.blog.map(copyLink(path.join(repoDir, 'blog'))))
					.concat(out.navbar.map(i => toDocs(i.to.substr(5))))
				// .concat(copyLink(repoDir)(out.logo))
				// .concat(copyLink(path.join(repoDir, "static"))(out.logo))
			)
			const sidebarLinks: (b: SidebarBuilder) => string[] = (b: SidebarBuilder) =>
				b.children?.length ? flatten(b.children.map(sidebarLinks)) : [b.value];

			out.sidebars.forEach(b => sidebarLinks(b).map(toDocs))

			out.navbar = out.navbar.map(n => {
				const target = this.app.metadataCache.getFirstLinkpathDest(n.to.substr(5), record.path);
				const slug = this.app.metadataCache.getCache(target.path).frontmatter?.slug || target.path;
				return { ...n, to: `docs${slug}` };
			})
			if (headings.some(h => h.heading === "Blog")) {
				out.navbar.push({
					to: "blog",
					label: "Blog",
					position: "left",
				});
			}

			return out
		}
		const out = await Promise.all(Object.keys(content).map(prepare));
		console.log(out);
		out.forEach(c => this.write(c));
	}

	async write(content: Content) {
		const dir = this.absRepoDir(this.settings.gitRepo);
		const imgDir = path.join(dir, 'static', 'img');
		const templateDir = path.join(this.absPluginDir(), 'src', 'template');
		const logoRelDestPath = path.join('static', 'img', 'logo.png');
		const logoDestPath = path.join(dir, logoRelDestPath);

		const files: { [key: string]: string } = {
			'.gitignore': gitignore(),
			'package.json': packageJson(),
			'babel.config.js': babelConfig(),
			'docusaurus.config.js': docusaurusConfig({
				title: content.title || this.settings.siteTitle || DEFAULT_SETTINGS.siteTitle,
				url: this.settings.siteUrl || 'https://netlify.com',
				other: {
					repo: this.settings.gitRepo,
					navbar: content.navbar,
					logoSrc: logoRelDestPath,
				}
			}),
			'sidebars.js': sidebars(content.sidebars),
		};
		// const copies: { [key: string]: string } = {
		// [path.join(templateDir, 'logo-small.png')]: path.join(imgDir, 'favicon.png'),
		// [path.join(templateDir, 'logo.png')]: path.join(dir, 'logo.png'),
		// [path.join(content.logo]: logoDestPath,
		// [content.logo]: path.join(imgDir, 'favicon.png'),
		// };

		fs.mkdirpSync(path.dirname(logoDestPath))
		fs.copyFileSync(path.join(this.basePath(), content.logo.path), logoDestPath);

		Object.keys(files).forEach(f => {
			fs.writeFileSync(path.join(dir, f), files[f]);
		});
		// Object.keys(copies).forEach(from => {
		// 	const to = copies[from];
		// 	fs.mkdirpSync(path.dirname(to))
		// 	fs.copyFileSync(from, to);
		// });
	}
}

interface Content {
	title?: string;
	logo?: TFile;
	navbar?: NavbarItem[];
	sidebars?: SidebarBuilder[];
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
		let { containerEl } = this;

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
		new Setting(containerEl)
			.setName('Site title')
			.setDesc('Title of your exported website')
			.addText(text => text
				.setPlaceholder('My Obsidian Export')
				.setValue(this.plugin.settings.siteTitle)
				.onChange(async (value) => {
					this.plugin.settings.siteTitle = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Site URL')
			.setDesc('URL of the deployed website')
			.addText(text => text
				.setPlaceholder('https://mysite.com')
				.setValue(this.plugin.settings.siteUrl)
				.onChange(async (value) => {
					this.plugin.settings.siteUrl = value;
					await this.plugin.saveSettings();
				}));
	}
}
