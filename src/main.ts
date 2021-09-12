import { App, FileSystemAdapter, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";

import { join } from "path";
import * as fs from "fs-extra";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import { NavbarItem, SidebarBuilder } from "./template/templates.js";
import { ObsidianContentStore } from "./store.js";
import { SiteBuilder } from "./pipeline.js";

interface MyPluginSettings {
  gitRepo: string;
  siteTitle: string;
  siteUrl: string;
  exportDir: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  gitRepo: "",
  siteTitle: "My Obsidian Export",
  siteUrl: "",
  exportDir: "~/obsidian-docusaurus-exports",
};

export default class MyPlugin extends Plugin {
  settings: MyPluginSettings;

  async onload() {
    (window as any).plugin = this;
    console.log("loading plugin");

    await this.loadSettings();

    this.addCommand({
      id: "open-docusaurus-website",
      name: "Open Docusaurus website",
      callback: () => {
        console.log("Open Docusaurus website");
      },
    });
    this.addCommand({
      id: "clone-docusaurus-website",
      name: "Clone Docusaurus website",
      callback: () => {
        console.log("clone command");
        this.clone();
      },
    });
    this.addCommand({
      id: "prepare-docusaurus-website",
      name: "Prepare Docusaurus website",
      callback: () => {
        console.log("prepare command");
        this.prepareContent();
      },
    });
    this.addCommand({
      id: "delete-docusaurus-exported",
      name: "Delete exported Docusaurus docs",
      callback: () => {
        console.log("delete exported command");
        this.deleteExported();
      },
    });

    this.addSettingTab(new SampleSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    console.log("saving settings", this.settings);
    await this.saveData(this.settings);
  }

  basePath(): string {
    return (this.app.vault.adapter as FileSystemAdapter).getBasePath();
  }

  absPluginDir(): string {
    return join(this.basePath(), this.manifest.dir);
  }

  expandExportDir() {
    const dir = this.settings.exportDir;
    if (dir[0] === "~") {
      return join(process.env.HOME, dir.substr(1));
    }
    return dir;
  }

  absRepoDir(repo: string): string {
    return join(this.expandExportDir(), repo.replace("https://", "").replace(".git", ""));
  }

  clone() {
    const dir = this.absRepoDir(this.settings.gitRepo);
    git
      .clone({ fs, http, dir, url: this.settings.gitRepo })
      .then(() => console.log("git result", arguments));
  }

  async prepareContent(): Promise<void> {
    const sb = new SiteBuilder(new ObsidianContentStore({ plugin: this }));
    const repo = this.settings.gitRepo;
    const site = await sb.build({
      title: this.settings.siteTitle,
      url: this.settings.siteUrl,
      repo,
      path: join(
        this.manifest.dir,
        "repos",
        ...repo.replace("https://", "").replace(".git", "").split("/")
      ),
    });
    console.log("prepared", site);
    await sb.write(site);
  }

  //   async write(content: Content) {
  //     const dir = this.absRepoDir(this.settings.gitRepo);
  //     const imgDir = join(dir, "static", "img");
  //     const templateDir = join(this.absPluginDir(), "src", "template");
  //     const logoRelDestPath = join("static", "img", "logo.png");
  //     const logoDestPath = join(dir, logoRelDestPath);

  //     const files: { [key: string]: string } = {
  //       ".gitignore": gitignore(),
  //       "package.json": packageJson(),
  //       "babel.config.js": babelConfig(),
  //       "docusaurus.config.js": docusaurusConfig({
  //         title: content.title || this.settings.siteTitle || DEFAULT_SETTINGS.siteTitle,
  //         url: this.settings.siteUrl || "https://netlify.com",
  //         other: {
  //           repo: this.settings.gitRepo,
  //           navbar: content.navbar,
  //           logoSrc: logoRelDestPath,
  //         },
  //       }),
  //       "sidebars.js": sidebars(content.sidebars),
  //       "src/css/custom.css": customCss(),
  //     };

  //     fs.mkdirpSync(path.dirname(logoDestPath));
  //     fs.copyFileSync(join(this.basePath(), content.logo.path), logoDestPath);

  //     Object.keys(files).forEach((f) => {
  //       const dest = join(dir, f);
  //       fs.mkdirpSync(path.dirname(dest));
  //       fs.writeFileSync(dest, files[f]);
  //     });
  //   }

  deleteExported() {
    const dir = this.absRepoDir(this.settings.gitRepo);
    fs.emptyDirSync(join(dir, "docs"));
    fs.emptyDirSync(join(dir, "blog"));
    fs.emptyDirSync(join(dir, "src", "pages"));
    fs.emptyDirSync(join(dir, "static", "img"));
  }
}

// function clean(name: string): string {
//   return name.replace(/\?/g, "_");
// }

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

    new Setting(containerEl)
      .setName("Git repo")
      .setDesc("URL to the Git repository to export to")
      .addText((text) =>
        text
          .setPlaceholder("https://github.com/you/repo")
          .setValue(this.plugin.settings.gitRepo)
          .onChange(async (value) => {
            this.plugin.settings.gitRepo = value;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName("Export directory")
      .setDesc("Path to the directory to export to")
      .addText((text) =>
        text
          .setPlaceholder("~/path/to/dir")
          .setValue(this.plugin.settings.exportDir)
          .onChange(async (value) => {
            this.plugin.settings.exportDir = value;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName("Site title")
      .setDesc("Title of your exported website")
      .addText((text) =>
        text
          .setPlaceholder("My Obsidian Export")
          .setValue(this.plugin.settings.siteTitle)
          .onChange(async (value) => {
            this.plugin.settings.siteTitle = value;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName("Site URL")
      .setDesc("URL of the deployed website")
      .addText((text) =>
        text
          .setPlaceholder("https://mysite.com")
          .setValue(this.plugin.settings.siteUrl)
          .onChange(async (value) => {
            this.plugin.settings.siteUrl = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
