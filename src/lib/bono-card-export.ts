export async function waitForBonoCardAssets(node: HTMLElement) {
  await document.fonts.ready;
  await Promise.all(Array.from(node.querySelectorAll("img")).map((image) => image.decode()));
}
