declare module "d3-cloud" {
  interface CloudWord {
    text: string;
    size: number;
    x: number;
    y: number;
    rotate: number;
  }

  interface CloudLayout {
    size(size: [number, number]): this;
    words(words: CloudWord[]): this;
    padding(padding: number): this;
    rotate(rotate: () => number): this;
    font(font: string): this;
    fontSize(fn: (word: any) => number): this;
    on(event: "end", callback: (words: CloudWord[]) => void): this;
    start(): void;
  }

  function cloud(): CloudLayout;
  export default cloud;
}
