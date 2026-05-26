# Shared procedure — Save session to Obsidian vault

All `learn-*` skills follow this same save flow at the end of a session.
Reference this doc verbatim; do not re-improvise the steps in each skill.

## When to invoke

Only after the learning content is finalized and visible to the user.
Never write before the user has seen the rendered output in the conversation.

## Steps

1. **Ask the user whether to save.**
   - Prompt: "Save this to Obsidian? (y/N)"
   - If `n` or blank → stop. Do not write anything.

2. **Load or set the vault path.**
   - Read `~/.claude/tz-skills/config.json`.
   - If file does not exist or `vault` key missing:
     a. Prompt user for vault path (absolute, e.g. `/Users/<you>/Documents/<vault-name>`).
     b. Verify the path exists and is a directory. If not, re-prompt.
     c. Create `~/.claude/tz-skills/` if missing.
     d. Write `{ "vault": "<path>" }` to `~/.claude/tz-skills/config.json`.
   - Print the resolved vault path back to the user once.

3. **Resolve the topic folder.**
   - Topic folder lives at `<vault>/Learning/<Topic>/`.
   - Skill-specific defaults:
     - `learn-from-doc`: derive Topic from doc title or H1. Show as suggestion, let user confirm or override.
     - `learn-from-zero`: Topic = the user-supplied subject (Title Case).
     - `learn-by-case`: list existing topic folders under `<vault>/Learning/`. Ask user to pick one or type a new name.
   - Create the folder if it does not exist.

4. **Compute the session number `NN`.**
   - List existing files in the topic folder matching `^(\d{2}) - `.
   - `NN = max(existing numbers) + 1`, zero-padded to 2 digits. First file → `01`.
   - If a Case is being saved that should pair with an existing Fundamentals
     note from the same session, reuse the same `NN`. Ask if unsure.

5. **Write the markdown file.**
   - Filename per skill:
     - `learn-from-doc`: `NN - Doc - <slug>.md`
     - `learn-from-zero`: `NN - <topic-or-section>.md`
     - `learn-by-case`: `NN - Case - <slug>.md`
   - `<slug>` = kebab-case of the doc title or scenario name, no extension.
   - Add YAML frontmatter:

     ```yaml
     ---
     tags:
       - learning
       - <topic-slug>
       - <skill-name>           # e.g. case, doc, til
     category: learning
     session: "<NN>"
     ---
     ```

   - Use the structure conventions documented in each skill's body.
   - Wikilinks to companion notes: `[[NN - <topic>]]`, `[[Glossary]]`.

6. **Update Glossary.**
   - Open or create `<vault>/Learning/<Topic>/Glossary.md`.
   - For each new term introduced this session that is not already a heading
     in Glossary, append a section:

     ```markdown
     ## <Term>

     <one-line definition>

     First seen: [[NN - <filename without .md>]]

     ---
     ```

   - Maintain alphabetical order. Keep entries terse.

7. **Confirm with the user.**
   - Print the path(s) written.
   - Suggest reopening Obsidian if it was already running so backlinks refresh.

## Error handling

- Vault path invalid → re-prompt; do not silently fall back.
- File already exists → ask before overwriting. Default: do not overwrite.
- Filesystem write error → surface the OS error verbatim, do not retry.
