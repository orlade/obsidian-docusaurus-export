Most of the logic of obsidian-docusaurus-export is mapping Obsidian concepts to Docusaurus concepts (or the same concepts in the appropriate format). This document describes the mapping.

## Obsidian Concepts
- **File**: a file on disk.
- **Note**: a Markdown file.
- **Folder**: a folder on disk.
- **Vault**: all of the content under a root directory.
- **Link**: Reference from a note to another file (usually another note).

## Docusaurus Concepts
- **Page**: A page of the website. Markdown file nested under the `pages` subdirectory.
- **(Blog) Post**: basically a page, but part of the blog. Markdown file nested under the `blog` subdirectory.
- **Navbar**: Describes the contents and structure of the navbar (menu on top of the website).
- **Sidebars**: Describes the contents and structure of the sidebar (menu(s) on the left of the website, not the blog).
- **Config**: describes the website and orchestrates the other components. `docusaurus.config.js`.

## Plugin Concepts
- **Site**: a website containing a subset of the content in a vault.
- **Structure note**: a note describing the contents and structure of a side. The main input to the Docusaurus export logic.

## Mapping
### File to Page
- name -> name

### Vault to Site
- Input: Structure doc
	- Notes in **Pages** section:

Posts/Pages:
- If no slug is present, generate and prepend one to remove capitals, spaces, special chars, etc. from name
- TODO: One doc should be chosen as the `docs/` landing page.

Navbar:
- If there's any blog posts, add a Blog entry
- Prepend `docs/` to each link unless the link only maps to a blog post
- Some items will wants to link to roots, like `/docs` or `/blog`.
	- TODO some carveout for internal `href` type links.


```mermaid

```