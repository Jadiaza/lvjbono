export async function waitForBonoCardAssets(node: HTMLElement) {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    images.map((image) => {
      if (image.complete && image.naturalWidth > 0) return Promise.resolve();
      return image.decode().catch(() => undefined);
    }),
  );
}
