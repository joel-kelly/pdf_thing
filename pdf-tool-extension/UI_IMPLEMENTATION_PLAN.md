# PDF Extension UI Rework - Adobe Acrobat Style

## Overview
Transform the current mode-based UI (Pages/Redact/Sign tabs) into an Adobe Acrobat-style interface with a continuous scroll PDF viewer and a right-side tools panel.

## New Architecture

```
+------------------------------------------+
|  Header (title + zoom controls + page #) |
+------------------------------------------+
|                             |            |
|  PDF Viewer                 | Tools      |
|  (continuous scroll)        | Panel      |
|  - All pages visible        | (right)    |
|  - Zoom support             |            |
|  - Current page tracking    | - Page     |
|                             |   Tools    |
|                             | - Document |
|                             |   Tools    |
|                             | - Redact   |
|                             | - Sign     |
+------------------------------------------+
```

## Files to Modify

### Existing Files
- `popup/popup.html` - Complete restructure for new layout
- `popup/popup.css` - Major rewrite for flexbox layout and Adobe styling
- `popup/popup.js` - Refactor to orchestrate new modules
- `src/ui-handler.js` - Adapt redaction/signature to new overlay approach

### New Files to Create
- `src/viewer.js` - Continuous scroll PDF viewer with zoom and lazy loading
- `src/tools-panel.js` - Right sidebar with accordion tool groups
- `src/modal-manager.js` - Reusable modal system for complex operations

## Implementation Phases

### Phase 1: Core Structure
1. Update `popup.html` with new layout:
   - Header with zoom controls and page indicator
   - Main content area with flex layout
   - PDF viewer container (scrollable)
   - Tools panel sidebar
   - Modal overlay container

2. Implement CSS layout:
   - Flexbox main structure
   - Dark header (#323639)
   - Gray document background (#525659)
   - White tool panel (#f4f4f4)
   - Adobe blue accent (#1473e6)

### Phase 2: PDF Viewer (`src/viewer.js`)
1. Continuous scroll container with all pages rendered vertically
2. Zoom controls: fit-width, 50%, 75%, 100%, 125%, 150%, 200%
3. Intersection Observer to track current visible page
4. Lazy loading - render only visible pages + margin
5. Page wrappers with page number labels
6. Redaction overlay canvas on each page

### Phase 3: Tools Panel (`src/tools-panel.js`)
1. Fixed-width sidebar (always visible, not collapsible)
2. Accordion-style tool groups:

   **Page Tools** (operate on current visible page - auto-detected):
   - Rotate Left/Right
   - Delete Page
   - Extract Page

   **Document Tools**:
   - Merge PDFs → opens file picker modal
   - Split Document → opens split options modal
   - Reorder Pages → opens thumbnail reorder modal

   **Redact**:
   - Toggle redaction mode (enables drawing on pages)
   - Apply Redactions button
   - Clear Redactions button

   **Sign**:
   - Add Signature → opens upload modal
   - Quick-select list of saved signatures
   - Clicking signature enters placement mode

   **Download** (always visible at bottom):
   - Download PDF button

### Phase 4: Modal System (`src/modal-manager.js`)
1. Reusable modal with header, body, footer
2. Pre-built templates for:
   - **Split PDF**: Radio options (all pages, every N pages, at specific pages)
   - **Merge PDFs**: Drag-drop file picker with file list
   - **Reorder Pages**: Thumbnail grid with drag-drop reordering
   - **Add Signature**: Name input + image upload with preview

### Phase 5: Redaction Integration
1. Each page wrapper has a `.redaction-overlay` canvas
2. When "Mark for Redaction" clicked, all pages enter redact mode
3. Draw boxes directly on any page while scrolling
4. Apply Redactions processes all pages with boxes
5. Clear Redactions removes all drawn boxes

### Phase 6: Signature Integration
1. Signature quick-list shows saved signatures in tools panel
2. Click signature → placement overlay appears on current page
3. Drag to position, resize from corner
4. Confirm/Cancel buttons to finalize placement

## Key Technical Details

### Current Page Tracking (Auto-detect)
The page most visible in the viewport is automatically considered the "current page" for page tools.

```javascript
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.intersectionRatio > 0.5) {
      updateCurrentPage(entry.target.dataset.page);
    }
  });
}, { threshold: [0, 0.25, 0.5, 0.75, 1] });
```

### Lazy Loading
- Render pages within viewport + 200px margin
- Use placeholder divs with correct aspect ratio
- Queue renders to avoid overwhelming browser

### Zoom
- Store scale factor in state
- Fit-width: calculate scale from container/page width
- Re-render visible pages on zoom change

### State Management
- Global `appState` in popup.js holds PDF documents
- Each module maintains internal state
- Custom events for cross-module communication (`page-change`)

## Design Decisions
- **Tools Panel**: Fixed width, always visible (not collapsible)
- **Page Targeting**: Auto-detect current page based on viewport visibility
- **Reorder Pages**: Modal with thumbnail grid and drag-drop (not inline)

## Verification
1. Load PDF - should display in continuous scroll view
2. Scroll - page indicator should update
3. Zoom - pages should re-render at new scale
4. Rotate/Delete - should modify current page and refresh view
5. Merge - modal should allow adding files, result merged
6. Split - modal should offer options, download multiple files
7. Redaction - draw boxes on multiple pages, apply all at once
8. Signature - select, position, and place on any page
9. Download - exports modified PDF
