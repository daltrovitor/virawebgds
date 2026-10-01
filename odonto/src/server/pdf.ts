import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * Geração de PDF com fontes padrão (WinAnsi cobre acentos do português).
 * Caracteres fora do conjunto são substituídos para não quebrar a geração.
 */
const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;

/** Substituições por código Unicode (aspas tipográficas, travessões, espaços especiais). */
const PDF_REPLACEMENTS: [number, string][] = [
  [0x2060, ""], // word joiner
  [0x2212, "-"], // sinal de menos
  [0x2018, "'"],
  [0x2019, "'"],
  [0x201c, '"'],
  [0x201d, '"'],
  [0x2026, "..."],
  [0x2013, "-"],
  [0x2014, "-"],
  [0x00a0, " "],
  [0x202f, " "],
];

export function sanitizePdfText(text: string): string {
  let out = text;
  for (const [code, rep] of PDF_REPLACEMENTS) out = out.split(String.fromCharCode(code)).join(rep);
  // Caracteres fora do WinAnsi/Latin-1 viram "?" para não quebrar a geração.
  return out.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");
}

export class PdfWriter {
  private doc!: PDFDocument;
  private page!: PDFPage;
  private font!: PDFFont;
  private bold!: PDFFont;
  private y = 0;

  static async create(): Promise<PdfWriter> {
    const w = new PdfWriter();
    w.doc = await PDFDocument.create();
    w.font = await w.doc.embedFont(StandardFonts.Helvetica);
    w.bold = await w.doc.embedFont(StandardFonts.HelveticaBold);
    w.newPage();
    return w;
  }

  private newPage() {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - MARGIN;
  }

  private ensure(height: number) {
    if (this.y - height < MARGIN) this.newPage();
  }

  get width() {
    return A4[0] - MARGIN * 2;
  }

  wrap(text: string, size: number, bold = false, width = this.width): string[] {
    const font = bold ? this.bold : this.font;
    const out: string[] = [];
    for (const paragraph of sanitizePdfText(text).split(/\r?\n/)) {
      if (paragraph.trim() === "") {
        out.push("");
        continue;
      }
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
        else {
          if (line) out.push(line);
          line = word;
        }
      }
      if (line) out.push(line);
    }
    return out;
  }

  text(text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number } = {}) {
    const size = opts.size ?? 10;
    for (const line of this.wrap(text, size, opts.bold)) {
      this.ensure(size * 1.4);
      this.page.drawText(line, { x: MARGIN, y: this.y - size, size, font: opts.bold ? this.bold : this.font, color: rgb(...(opts.color ?? [0.09, 0.09, 0.11])) });
      this.y -= size * 1.4;
    }
    this.y -= opts.gap ?? 4;
  }

  /** Linha de tabela com colunas alinhadas; a primeira coluna quebra linha. */
  row(cells: { text: string; width: number; align?: "left" | "right" }[], opts: { size?: number; bold?: boolean; shade?: boolean } = {}) {
    const size = opts.size ?? 9;
    const font = opts.bold ? this.bold : this.font;
    const wrapped = cells.map((c) => this.wrap(c.text, size, opts.bold, c.width - 6));
    const lines = Math.max(...wrapped.map((w) => w.length), 1);
    const height = lines * size * 1.35 + 6;
    this.ensure(height);
    if (opts.shade) this.page.drawRectangle({ x: MARGIN, y: this.y - height, width: this.width, height, color: rgb(0.96, 0.96, 0.97) });
    let x = MARGIN;
    cells.forEach((c, i) => {
      wrapped[i]!.forEach((line, k) => {
        const tw = font.widthOfTextAtSize(line, size);
        const lx = c.align === "right" ? x + c.width - 3 - tw : x + 3;
        this.page.drawText(line, { x: lx, y: this.y - 3 - size - k * size * 1.35, size, font, color: rgb(0.09, 0.09, 0.11) });
      });
      x += c.width;
    });
    this.y -= height;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: MARGIN + this.width, y: this.y }, thickness: 0.4, color: rgb(0.85, 0.85, 0.87) });
  }

  space(h: number) {
    this.y -= h;
  }

  async bytes(): Promise<Uint8Array> {
    const pages = this.doc.getPages();
    pages.forEach((p, i) => {
      p.drawText(`Página ${i + 1} de ${pages.length}`, { x: A4[0] - MARGIN - 70, y: 24, size: 8, font: this.font, color: rgb(0.45, 0.45, 0.48) });
    });
    return this.doc.save();
  }
}
