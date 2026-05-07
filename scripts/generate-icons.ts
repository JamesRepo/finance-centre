import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const svgBuffer = readFileSync(join(publicDir, "icon.svg"));

async function generateIcons() {
  // 192x192 standard icon
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(join(publicDir, "icon-192.png"));

  // 512x512 standard icon
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(join(publicDir, "icon-512.png"));

  // 512x512 maskable icon with 20% safe-zone padding
  // Maskable icons need content inset by ~20% on each side
  const innerSize = Math.round(512 * 0.6); // 60% of 512 = 307
  const innerIcon = await sharp(svgBuffer).resize(innerSize, innerSize).png().toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 37, g: 99, b: 235, alpha: 1 }, // #2563eb
    },
  })
    .composite([
      {
        input: innerIcon,
        gravity: "centre",
      },
    ])
    .png()
    .toFile(join(publicDir, "icon-512-maskable.png"));

  // favicon.ico as 32x32 PNG (modern browsers accept PNG favicons)
  const faviconPng = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  writeFileSync(join(publicDir, "favicon.ico"), faviconPng);

  // eslint-disable-next-line no-console
  console.log("Generated: icon-192.png, icon-512.png, icon-512-maskable.png, favicon.ico");
}

generateIcons().catch((err) => {
  console.error(err);
  process.exit(1);
});
