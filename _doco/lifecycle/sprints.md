# sprints

- [sprint-111-fill-plugin](../design/plugins/fill/sprint-1.md)
  - Design and implement FillPlugin
  - complete 20260523

- [sprint-112-fill-plugin-more-types](../design/plugins/fill/sprint-2.md)
  - FillPlugin supports NamedNote only. Add more note-types: SingleNote, TinyNote
  - complete 20260523


# TODO

We'd like to fill out the `# sprints` section above with the sprints we already have documented, using the document organization we are moving to.

New document organization: 
- All sprints have a repository-unique number called the "sprint number", starting at 100.
- All sprints have a short-name.  For example, sprint-111-fill-plugin shown above has a short name "fill-plugin".
- For directories where we do not have a sprint-1.md, sprint-1.md split, assume each directory is one sprint.
- For directories where we do have a sprint-1.md or sprint-2.md, we need to update the filename to the new format sprint-{sprint-number}-{sprint-short-name}.md, and fix any references in .md files in that same directory.  For example: the sprint-number is 112, the sprint-short-name is "fill-plugin-more-types" so the full filename is "sprint-112-fill-plugin-more-types.md"
- We just made up the numbers 111 and 112 for the example sprints above.  They should be sequenced like the others and fixed.
- We need to cut a row in this document in the `# sprints` section for each file, and a bullet point under that that gives a short sentence about what this sprint was designing, implementing, or fixing. 
- We need to look through the following directories, and assign sprint numbers going back in time to refer to those sprints created before the numbering/naming system.  First step would be to look at the file dates, organized them by date, and assign numbers, generally from 100 up.
- Here are the directories that count as sprint-planning.  Other files and folders are not necessarily sprints, and should be skipped.
```
├── design
│   ├── info
│   ├── myTunings
│   ├── plugins
│   │   ├── arpeggio
│   │   ├── clip
│   │   ├── fill
│   │   ├── move
│   │   └── transpose
│   ├── tonal
│   └── transport
```
- build the dates of the sprints before editing any files to fix up links, as this will change file timestamps.

At the end, we need:
- one row in this document with a Markdown file link to each sprint planning document in its directory.  The title of the link includes the sprint-number and the sprint-short-name.  
- one bullet point under that row for a sprint description
- if the status and date can be determined from content, one bullet point for completion date or current status.  Acceptable to use file date of latest file in directory if no date is specified in a planning document.
- one or more `sprint-{sprint-number}-{sprint-short-name}.md` files per directory showing the sprint planning, as exemplified in the few sprint-1.md and sprint-2.md files that exist.  Most descriptions etc. will still be in design and implementation docs, so the sprint planning docs should be lean, and include just links and status and short descriptions.  For example, `_doco/design/transport/sprint-105-map-spacebar.md` should exist afterwards, and if possible, `_doco/design/transport/sprint-106-transport-controller.md` should exist as well, since work on `map-spacebar` was interrupted to specify and implement `transport-controller`.

This is not mission-critical editing.  If the documents remain in place, have minimal file-link correctness, have a sprint planning doc per directory, and have a working link from this file to the sprint planning doc, we'll declare victory for Copilot and hand-edit them from there.

Note: We'd like the Markdown links to work throughout this ./_doco/ filesystem in our infinite-neck repository.  This directory should be considered stable relative to our repository.

Preserve this `# TODO` section when done.
