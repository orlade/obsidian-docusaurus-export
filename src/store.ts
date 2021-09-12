import { Plugin, CachedMetadata, TFile, FileSystemAdapter } from "obsidian";
import { ObsimianPlugin } from "obsimian";
import { File, FileRef } from "./model";

import * as fs from "fs-extra";
import { dirname } from "path";

/** Abstraction over the concept of an Obsidian plugin. */
export interface ContentStore {
  getAllFiles(): Promise<FileRef[]>;
  getTextFiles(): Promise<FileRef[]>;
  findFilesWithTag(tag: string): Promise<FileRef[]>;

  getMetadata(ref: FileRef): Promise<CachedMetadata>;
  loadFile(ref: FileRef): Promise<File>;
  copy(file: FileRef, newPath: string): Promise<FileRef>;
  write(data: string, path: string): Promise<FileRef>;
  mkdir(path: string): Promise<void>;
}

// OBSIMIAN IMPL

export interface ObsimianContentStoreParams {
  plugin: ObsimianPlugin;
}

export class ObsimianContentStore implements ContentStore {
  plugin: ObsimianPlugin;

  writes: {
    [key: string]: string[];
  };
  copies: {
    [key: string]: string[];
  };

  constructor({ plugin }: ObsimianContentStoreParams) {
    this.plugin = plugin;
    this.writes = {};
    this.copies = {};
  }

  async getAllFiles(): Promise<FileRef[]> {
    const files = this.plugin.app.vault.getMarkdownFiles();
    return files.map((f) => ({
      title: f.name,
      path: f.path,
    }));
  }

  async getTextFiles(): Promise<FileRef[]> {
    return this.getAllFiles();
  }

  async findFilesWithTag(tag: string): Promise<FileRef[]> {
    return this.getAllFiles();
  }

  async getMetadata(ref: FileRef): Promise<CachedMetadata> {
    const meta: CachedMetadata = this.plugin.app.metadataCache.getCache(ref.path);
    return meta;
  }

  async loadFile(ref: FileRef): Promise<File> {
    const file = { name: ref.title, path: ref.path };
    const body = await this.plugin.app.vault.read(file);
    return { ...ref, body };
  }

  async write(data: string, path: string): Promise<File> {
    // TODO
    this.writes[path] ||= [];
    this.writes[path].push(data);
    return null;
  }

  async copy(file: FileRef, newPath: string): Promise<File> {
    // TODO
    this.copies[file.path] ||= [];
    this.copies[file.path].push(newPath);
    return null;
  }

  async mkdir(path: string): Promise<void> {}
}

// OBSIDIAN IMPL

interface OFileRef extends FileRef {
  tfile: TFile;
}

interface OFile extends File, OFileRef {}

export interface ObsidianContentStoreParams {
  plugin: Plugin;
}

export class ObsidianContentStore implements ContentStore {
  plugin: Plugin;

  constructor({ plugin }: ObsidianContentStoreParams) {
    this.plugin = plugin;
  }

  resolve(path) {
    return (this.plugin.app.vault.adapter as FileSystemAdapter).getBasePath() + "/" + path;
  }

  async getAllFiles(): Promise<OFileRef[]> {
    return this.plugin.app.vault.getFiles().map(this.fileToDoc);
  }

  async getTextFiles(): Promise<OFileRef[]> {
    return this.plugin.app.vault.getMarkdownFiles().map(this.fileToDoc);
  }

  async findFilesWithTag(tag: string): Promise<OFileRef[]> {
    const orefs = await this.getTextFiles();
    const ofs = await Promise.all(orefs.map((ref) => this.loadFile(ref)));
    return ofs.filter((of) => of.body.match(tag));
  }

  async loadFile(ref: FileRef): Promise<OFile> {
    const tfile = (await this.plugin.app.vault.getAbstractFileByPath(ref.path)) as TFile;
    const body = await this.plugin.app.vault.read(tfile);
    return { ...ref, tfile, body };
  }
  async copy(file: FileRef, newPath: string): Promise<FileRef> {
    // TODO
    const p = this.resolve(newPath);
    const vault = this.plugin.app.vault;
    const from = await this.loadFile(file);
    try {
      console.log("checking", p);
      const stat = await fs.statSync(p);
      console.log("stat", stat);
      if (stat) {
        fs.rmSync(p);
        console.log("rmd");
      }
    } catch (e) {
      console.error(e);
    }
    fs.ensureDirSync(dirname(p));
    fs.copyFileSync(this.resolve(from.path), p);
    return { ...file };
  }
  async write(data: string, path: string): Promise<FileRef> {
    // TODO
    // return await this.plugin.app.vault.create(file, newPath);
    const p = this.resolve(path);
    fs.ensureDirSync(dirname(p));
    fs.writeFileSync(p, data);
    return null;
  }

  async mkdir(path: string): Promise<void> {
    fs.mkdirpSync(this.resolve(path));
  }

  async getMetadata(ref: OFileRef): Promise<CachedMetadata> {
    return this.plugin.app.metadataCache.getCache(ref.path);
  }

  fileToDoc(file: TFile): OFileRef {
    return {
      title: file.name,
      path: file.path,
      tfile: file,
    };
  }
}
