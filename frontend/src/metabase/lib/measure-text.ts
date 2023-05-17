import {
  FontStyle,
  TextMeasurer,
} from "metabase/visualizations/shared/types/measure-text";

let canvas: HTMLCanvasElement | null = null;

export const measureText: TextMeasurer = (text: string, style: FontStyle) => {
  canvas ??= document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not create canvas context");
  }

  context.font = `${style.weight} ${style.size} ${style.family}`;
  return context.measureText(text).width;
};

export const measureTextHeight = ({
  text,  style, containerWidth, lineHeight
} : {
  text: string,
  style: FontStyle,
  containerWidth: number,
  lineHeight: number,
}) => {
  const lineWidths = text
    .split("\n")
    .map(line => measureText(line, style));

  console.log(lineWidths);

  const totalLines = lineWidths.reduce((total: number, lineWidth: number) => {
    return total + Math.ceil((lineWidth + 1) / containerWidth)
  }, 0)

  console.log(lineWidths, totalLines);
  return totalLines;
}

export const renderedTextSize = ({
  text,  style, containerWidth
} : {
  text: string,
  style: FontStyle,
  containerWidth: number,
}) => {

  const myDiv = document.createElement("div");
  myDiv.className = "measure-text";
  myDiv.style.display = "inline-block";
  myDiv.style.position = "fixed";
  myDiv.style.right= "400px";
  myDiv.style.top = "196px";
  myDiv.style.visibility = "hidden";
  myDiv.style.fontFamily = 'Lato',
  myDiv.style.fontWeight = '400',
  myDiv.style.fontSize = '16.002px',
  myDiv.style.lineHeight = '25.63px',
  myDiv.style.zIndex = "-1";
  myDiv.style.width = `${containerWidth}px`;
  myDiv.innerText = text;
  document.body.appendChild(myDiv);

  const height = myDiv.clientHeight;
  const width = myDiv.clientWidth;

  // console.log(width, height);

  setTimeout(() => {
    myDiv.remove();
  }, 0);

  return { width, height };
}
