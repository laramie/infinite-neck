# SectionStatus Widget Programmer Instructions

## 1. CSS Inclusion
Add this to your `<head>` in `index.html`:

```
<link rel="stylesheet" type="text/css" href="templates/SectionStatus/section-status.css" />
```

## 2. Template Loading (in your appInit or similar):
Add to your template loading promises:

```
loadTemplates('templates/SectionStatus/section-status.html').then(() => {
    // Example: add a SectionStatus widget after loading
    SectionStatusBuilder.addToDest('#divSectionStatus_S6', 'tblS6_1', 'subcaption', 'vertical');
});
```

## 3. Instantiating a Widget

```
// destSelector: CSS selector for the destination element (must be unique)
// ownerID: unique string for the owning table/div/span (e.g. 'tblS6_1' or 'leadSheetCaptionRow')
// placementID: string for placement within the owner (e.g. 'subcaption', 'left')
// layout: 'vertical' or 'horizontal'

const widget = SectionStatusBuilder.addToDest('#divSectionStatus_S6', 'tblS6_1', 'subcaption', 'vertical');
```

## 4. Cleaning Up Widgets

```
// Remove all widgets for a given ownerID (e.g., when deleting a table)
SectionStatusBuilder.removeByOwnerID('tblS6_1');

// Remove all widgets (e.g., before rebuilding all tables)
SectionStatusBuilder.removeAll();
```

## 5. Switching Layout

```
// Change layout of a widget instance
theWidget.setLayout('horizontal');
```

## 6. EventBus Usage

SectionStatus widgets listen for these events:
- 'Widget:SectionStatus:keyChanged'
- 'Widget:SectionStatus:sectionChanged'
- 'Widget:SectionStatus:layoutChanged'
- 'Widget:SectionStatus:IDChanged'

Example trigger:
```
EventBus.trigger('Widget:SectionStatus:keyChanged', {
    widgetID: 'tblS6_1_subcaption_SectionStatus',
    rootID: 3,
    rootIDLead: 8
});
```

## 7. Widget ID Convention

Each widget gets a unique ID:

    `${ownerID}_${placementID}_SectionStatus`

This is used for event targeting and DOM lookup.

---

**See section-status.builder.js for full API and implementation details.**
