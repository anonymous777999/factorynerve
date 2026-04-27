const PDF_TYPE = "application/pdf";

function isPdf(input: File) {
  return input.type === PDF_TYPE || /\.pdf$/i.test(input.name);
}

async function canvasToJpegFile(canvas: HTMLCanvasElement, sourceName: string) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) {
        resolve(value);
        return;
      }
      reject(new Error("Could not convert the PDF preview."));
    }, "image/jpeg", 0.92);
  });
  const baseName = sourceName.replace(/\.[^.]+$/, "") || "ocr-document";
  return new File([blob], `${baseName}-page-1.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export async function rasterizeDocumentForOcr(input: File): Promise<File> {
  if (!isPdf(input)) {
    return input;
  }

  const pdfjs = await import("pdfjs-dist");
  const workerModule = await import("pdfjs-dist/build/pdf.worker.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;

  const bytes = new Uint8Array(await input.arrayBuffer());
  const pdfDocument = await pdfjs.getDocument({ data: bytes }).promise;
  const page = await pdfDocument.getPage(1);
  const viewport = page.getViewport({ scale: 1.8 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not open a rendering surface for this PDF.");
  }
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({ canvas, canvasContext: context, viewport }).promise;
  const file = await canvasToJpegFile(canvas, input.name);
  page.cleanup();
  await pdfDocument.destroy();
  return file;
}
