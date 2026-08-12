import type { CSSProperties, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
type SpriteRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const toolbarSprite = "assets/sketchforge/toolbar-sprite.svg?v=2";
const vectorToolbarSprite = "assets/sketchforge/vector-toolbar-icons.svg?v=1";

// Sprite icons size themselves inline, so the CSS --toolbar-glyph-size variable
// cannot reach them. Keep this value in sync with that variable in globals.css.
const TOOLBAR_GLYPH_SIZE = 32;

function ToolbarSpriteIcon({ rect, className, style }: IconProps & { rect: SpriteRect }) {
  const size = TOOLBAR_GLYPH_SIZE;
  const scale = size / rect.height;

  return (
    <span
      aria-hidden="true"
      className={["toolbar-sprite-icon", className].filter(Boolean).join(" ")}
      style={
        {
          "--sprite-x": `${-rect.x * scale}px`,
          "--sprite-y": `${-rect.y * scale}px`,
          "--sprite-width": `${260 * scale}px`,
          "--sprite-height": `${80 * scale}px`,
          width: `${rect.width * scale}px`,
          height: `${size}px`,
          backgroundImage: `url(${toolbarSprite})`,
          ...(style as CSSProperties),
        } as CSSProperties
      }
    />
  );
}

function VectorToolbarSpriteIcon({ rect, className, style }: IconProps & { rect: SpriteRect }) {
  const size = TOOLBAR_GLYPH_SIZE;
  const scale = size / rect.height;

  return (
    <span
      aria-hidden="true"
      className={["vector-toolbar-sprite-icon", className].filter(Boolean).join(" ")}
      style={
        {
          "--vector-sprite-x": `${-rect.x * scale}px`,
          "--vector-sprite-y": `${-rect.y * scale}px`,
          "--vector-sprite-width": `${165 * scale}px`,
          "--vector-sprite-height": `${27 * scale}px`,
          width: `${rect.width * scale}px`,
          height: `${size}px`,
          backgroundImage: `url(${vectorToolbarSprite})`,
          ...(style as CSSProperties),
        } as CSSProperties
      }
    />
  );
}

type ToolbarCommandImageProps = { file: string; className?: string };

function ToolbarCommandImage({ file, className }: ToolbarCommandImageProps) {
  const assetClassName = `toolbar-art-${file.replace(/\.png$/i, "")}`;
  return <img aria-hidden="true" className={["toolbar-command-icon", assetClassName, className].filter(Boolean).join(" ")} src={"/assets/sketchforge/" + file} alt="" draggable={false} />;
}

export function ToolbarHomeIcon() {
  return <ToolbarCommandImage file="toolbar-home.png" className="toolbar-user-art-icon" />;
}

export function ToolbarCopyIcon() {
  return <ToolbarCommandImage file="toolbar-copy.png" className="toolbar-user-art-icon" />;
}

export function ToolbarPasteIcon() {
  return <ToolbarCommandImage file="toolbar-paste.png" className="toolbar-user-art-icon" />;
}

export function ToolbarDuplicateIcon() {
  return <ToolbarCommandImage file="toolbar-duplicate.png" className="toolbar-user-art-icon" />;
}

export function ToolbarTrashIcon() {
  return <ToolbarCommandImage file="toolbar-delete.png" className="toolbar-user-art-icon" />;
}

export function ToolbarUndoIcon() {
  return <ToolbarCommandImage file="toolbar-undo.png" className="toolbar-user-art-icon" />;
}

export function ToolbarRedoIcon() {
  return <ToolbarCommandImage file="toolbar-redo.png" className="toolbar-user-art-icon" />;
}

export function ToolbarImportIcon() {
  return <ToolbarCommandImage file="toolbar-import.png" className="toolbar-user-art-icon" />;
}

export function ToolbarVectorExportIcon() {
  return <ToolbarCommandImage file="toolbar-export.png" className="toolbar-user-art-icon" />;
}

export function ToolbarSettingsIcon() {
  return <ToolbarCommandImage file="toolbar-settings.png" className="toolbar-user-art-icon" />;
}

export function ToolbarShapeAddIcon(props: IconProps) {
  return <VectorToolbarSpriteIcon rect={{ x: 104, y: 0, width: 29, height: 27 }} {...props} />;
}

export function ToolbarHideSelectedIcon(props: IconProps) {
  return <VectorToolbarSpriteIcon rect={{ x: 138, y: 0, width: 27, height: 27 }} {...props} />;
}

export function ToolbarCaretDownIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path d="m16 19 8 9 8-9z" fill="currentColor" />
    </svg>
  );
}

export function ToolbarGroupIcon() {
  return <ToolbarCommandImage file="toolbar-group.png" />;
}

export function ToolbarUngroupIcon() {
  return <ToolbarCommandImage file="toolbar-ungroup.png" />;
}

export function ToolbarIntersectionIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <circle cx="19" cy="24" r="13" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="29" cy="24" r="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeDasharray="4 3" />
      <path d="M24 11.99A13 13 0 0 1 24 36.01A13 13 0 0 1 24 11.99Z" fill="currentColor" opacity="0.82" />
    </svg>
  );
}

export function ToolbarDrillHoleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path d="M14 10h20v7H14zM17 17h14v20a7 7 0 0 1-14 0z" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M21 22h6M21 27h6M21 32h6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M24 39v5M19 44h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function ToolbarApplyDrillIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path d="M9 14 24 7l15 7v18L24 40 9 32z" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="m9 14 15 8 15-8M24 22v18" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinejoin="round" />
      <ellipse cx="24" cy="14.5" rx="4.2" ry="2.2" fill="none" stroke="currentColor" strokeWidth="2.1" />
      <path d="m31 34 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ToolbarPaintIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path d="M24 8C14.2 8 7 15.1 7 24.4 7 33.2 13.6 40 22.4 40h3.9c2.5 0 3.7-3.1 1.8-4.8-1.2-1.1-.4-3.2 1.2-3.2h2.1c5.3 0 9.6-4.2 9.6-9.4C41 14.5 33.4 8 24 8Z" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
      <circle cx="15.5" cy="22" r="2.2" fill="currentColor" />
      <circle cx="22.5" cy="15.5" r="2.2" fill="currentColor" />
      <circle cx="31.4" cy="18.4" r="2.2" fill="currentColor" />
      <circle cx="15.8" cy="30" r="2.2" fill="currentColor" />
    </svg>
  );
}

export function ToolbarSelectIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path
        d="M8 7.5 22.2 42l5.1-14.7L42 22.2Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ToolbarBrushPaintIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <rect x="7" y="8" width="27" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="2.8" />
      <path d="M11 13h19" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" opacity="0.35" />
      <path d="M34 14h5v10H24v6" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="19" y="29" width="10" height="15" rx="2.5" fill="currentColor" />
    </svg>
  );
}

export function ToolbarAlignIcon(props: IconProps) {
  return <ToolbarSpriteIcon rect={{ x: 97.3, y: 46.7, width: 29.1, height: 32.5 }} {...props} />;
}

export function ToolbarMirrorIcon() {
  return <ToolbarCommandImage file="toolbar-mirror.png" className="toolbar-user-art-icon" />;
}

export function ToolbarChamferIcon() {
  return <ToolbarCommandImage file="toolbar-chamfer.png" className="toolbar-user-art-icon" />;
}

export function ToolbarFilletIcon() {
  return <ToolbarCommandImage file="toolbar-fillet.png" className="toolbar-user-art-icon" />;
}

/**
 * Push/pull: a block whose top face is lifted, with an arrow along the face
 * normal. Drawn inline because there is no sprite or PNG art for it.
 */
export function ToolbarPushPullIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path d="M10 26.5 24 20l14 6.5-14 6.5z" fill="currentColor" opacity="0.28" />
      <path d="M10 26.5 24 20l14 6.5-14 6.5z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M10 26.5v7L24 40l14-6.5v-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M24 33v7" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M24 15.5V5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="m19.5 9.5 4.5-4.5 4.5 4.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ToolbarPreserveEdgeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path d="M10 35V17c0-4 3-7 7-7h18" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" />
      <path d="M10 35h25V10" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinejoin="round" />
      <path d="M17 29h13M17 25v8M30 25v8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M18 17a7 7 0 0 1 7-7" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function ToolbarSnapGridIcon() {
  return <ToolbarCommandImage file="toolbar-snap-grid.png" className="toolbar-user-art-icon" />;
}

export function ToolbarExportIcon() {
  return <ToolbarCommandImage file="toolbar-export.png" className="toolbar-user-art-icon" />;
}

export function ToolbarWorkplaneIcon() {
  return <ToolbarCommandImage file="toolbar-workplane.png" className="toolbar-user-art-icon" />;
}

export function ToolbarDropToWorkplaneIcon() {
  return <ToolbarCommandImage file="toolbar-drop-workplane.png" className="toolbar-user-art-icon" />;
}
