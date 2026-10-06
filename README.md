# Shared Memory House — The inhabited archive

Open this folder in VS Code and launch index.html with Five Server. No build step is required. The existing Firebase configuration and NYU / ITP proxy endpoint are retained in main.js.

## Visual changes
The homepage is now a real Three.js orthographic scene viewed diagonally from above, based on the provided architectural cutaway reference. Each Firebase user has an independent rectangular room with a floor, two walls, and thin wire outlines describing its open front and roof. Empty rooms contain no people, furniture or decorative placeholders. Up to three actual saved memory objects appear as cutout previews. Clicking geometry or the projected name button enters the existing personal room. Hover brightens the surfaces; a quiet dash marks your room. Rooms have different proportions and the camera fits the complete layout. The AI-generated concept image shown in the conversation is a visual reference, not a screenshot or a website background.

## Preserved behavior
Firebase memoryHouse/users, profiles, assets and connections remain unchanged. AI generation, owner-only transform tools, deletion, replay, social responses, demo neighbors, legacy Skyler import and the 70/30 Next Room recommendation remain available. Demo neighbors are added only through the existing explicit button.

## Reliability improvements
Asynchronous object loading cannot insert stale objects after switching rooms. Generation captures the originating user's room. Replay cancels on navigation. Login failures show inline messages. Rendering pauses while the room is hidden.

## Validation
JavaScript syntax and HTML/DOM references checked. Browser visual verification and live Firebase/AI integration were not run in the delivery environment; no database writes or paid generations were performed.

## Local verification
1. Enter your existing name and confirm existing objects remain present.
2. Enter a neighboring room, select an object and leave a response.
3. Return to your room; generate, move, rotate, scale and delete a test object.
4. Replay and switch rooms during playback. Try Next Room.
5. Check desktop and mobile widths and keyboard navigation.

Volunteered names retain the original identity behavior: matching normalized names access the same room. This prototype does not add authentication or change Firebase security rules.

## Archival collage room update
New AI objects are prompted as grayscale archival photographic cutouts with fine paper grain. Chroma green stays uniform for background removal. Existing object URLs and Firebase data remain untouched; successfully processed textures display in grayscale, including lobby previews. The personal room now has pale gray surfaces, fine back-wall drafting lines, floor grid and a noninteractive grain overlay. Violet appears only as a subtle editor focus accent. No preset furniture is added to empty rooms. If image CORS prevents chroma processing, the original texture fallback remains available and may retain its original colors.

## Hand-drawn generated objects
The AI prompt now explicitly requests black ink outlines, slightly irregular hand-drawn strokes, simplified cartoon-like shapes, light gray fills and sparse pencil crosshatching. It explicitly excludes photographic imagery and glossy 3D renders. This applies to newly generated objects; existing saved images are not regenerated. Room layout and all interactions remain unchanged.

## Entrance / window / room management update
The volunteered-name entrance uses entrance-collage.png as a slowly drifting and scaling background, with a dark overlay for readable text. Keep the PNG beside index.html and main.js. Reduced-motion preferences disable animation. The background uses the upper collage portion of the supplied reference through CSS framing. Window glass is opaque dark gray (#555555); frames are medium gray (#666666). Visiting another user's room exposes Delete This Room; explicit confirmation precedes removing that complete room node, including objects and responses. This follows the original volunteered-name prototype permissions and does not add admin authentication. Firebase rules must allow the operation. No live deletion was performed during development.

## Thin 3D objects / entrance navigation update
Memory cutouts now have a .16-unit extrusion following the alpha silhouette, with illustrated front/back planes and gray side surfaces. Alpha edges are sampled at 128x128 for a lightweight paper-model thickness effect. This is a 2.5D cutout volume, not a fully reconstructed 3D object. It also appears in lobby previews; saved transforms and Firebase schema are unchanged. Shared textures/geometries are disposed once. Both the lobby and room offer Return to Entrance without clearing the volunteered name. The entrance collage is brighter and repeats seamlessly across its full tile width while moving continuously left to right over 55 seconds. Reduced motion disables the animation.

## More rooms and proportional scaling
There is no six-room cap; the lobby renders all memoryHouse/users entries in rows of three. Add Room creates a new empty volunteered-name room without changing the current viewer or overwriting an existing profile. Reusing a normalized name enters the existing room. The lobby now scrolls explicitly within the viewport. Scale applies the same positive factor to width, height and thickness, preserving the object's starting proportions. Move and Rotate remain unchanged and the scale vector is still saved in the original Firebase format.

## Solid room surfaces and XYZ dimensions
Floor and three existing walls are now solid .18-unit slabs with visible edges; the front and roof remain open for viewing. Room Dimensions in the owner's sidebar toggles numeric width X / height Y / depth Z controls (2–20 units). Apply saves an optional dimensions object at the existing room node; older rooms default to 8x5x7. Room meshes, window, drafting grid and camera adjust to the dimensions; lobby previews reflect proportions. Objects retain existing transforms and can fall outside a smaller room. Visitors can see the saved size but do not receive owner editing controls. Lights are created once, and replaced room geometry is disposed on resize.
