// Business-card design, edited in /admin/card and rendered in the home hero.
// All geometry is in "card units": the card is `width` x `height` units and
// the renderer scales it to fit, so designs stay pixel-exact at any size.

export type FontKey = "display" | "body" | "mono";

/** Offsets applied on top of an element's base pose at a scroll progress. */
export interface Keyframe {
  at: number; // scroll progress 0..1
  x: number; // units, relative to base position
  y: number;
  rotate: number; // degrees, added to base rotation
  scale: number; // multiplier
  opacity: number; // multiplier 0..1
}

export interface Shadow {
  x: number;
  y: number;
  color: string;
}

interface BaseElement {
  id: string;
  name?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  hidden?: boolean;
  locked?: boolean;
  link?: string; // makes the element clickable on the site
  motion: Keyframe[];
}

export interface TextElement extends BaseElement {
  type: "text";
  text_ko: string;
  text_en: string;
  font: FontKey;
  size: number;
  weight: number;
  italic: boolean;
  color: string;
  align: "left" | "center" | "right";
  vAlign: "top" | "middle" | "bottom";
  letterSpacing: number; // em
  lineHeight: number;
  uppercase: boolean;
}

export interface ShapeElement extends BaseElement {
  type: "shape";
  shape: "rect" | "ellipse" | "line";
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
  shadow?: Shadow;
}

export interface ImageElement extends BaseElement {
  type: "image";
  src: string;
  fit: "cover" | "contain";
  radius: number;
  stroke: string;
  strokeWidth: number;
  grayscale: boolean;
  shadow?: Shadow;
}

export interface QrElement extends BaseElement {
  type: "qr";
  value: string;
  color: string;
  background: string;
}

export type CardElement = TextElement | ShapeElement | ImageElement | QrElement;
export type ElementType = CardElement["type"];

export interface Background {
  type: "solid" | "gradient" | "image";
  color: string;
  color2: string;
  angle: number;
  image: string;
}

export interface CardFace {
  background: Background;
  elements: CardElement[];
}

export interface CardScroll {
  /** Height of the scroll stage in viewport heights. */
  length: number;
  flip: boolean;
  flipStart: number;
  flipEnd: number;
  /** Max tilt in degrees while scrolling. */
  tilt: number;
  scaleFrom: number;
  scaleTo: number;
  /** Tilt toward the pointer on hover. */
  hoverTilt: boolean;
}

export interface CardDesign {
  version: 1;
  width: number;
  height: number;
  radius: number;
  borderWidth: number;
  borderColor: string;
  shadow: Shadow;
  front: CardFace;
  back: CardFace;
  scroll: CardScroll;
  updated_at?: string;
}

export type FaceKey = "front" | "back";
