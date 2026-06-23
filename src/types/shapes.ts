export type Rect = {
  type: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  fillColor?: string;
  brushSize: number;
};

export type Line = {
  type: "line";
  points: { x: number; y: number }[];
  color: string;
  brushSize: number;
  isEraser: boolean;
};

export type Circle = {
  type: "circle";
  x: number;
  y: number;
  rX: number;
  rY: number;
  color: string;
  fillColor?: string;
  brushSize: number;
};

export type Arrow = {
  type: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  brushSize: number;
};

export type TextShape = {
  type: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
};

export type Shape = Rect | Line | Circle | Arrow | TextShape;
