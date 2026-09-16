const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generatePwaIcons() {
  const publicDir = path.join(__dirname, '..', 'public');
  const sourceLogo = path.join(publicDir, 'lost-and-found.png');

  if (!fs.existsSync(sourceLogo)) {
    console.error('Source logo not found at:', sourceLogo);
    process.exit(1);
  }

  // 1. Trim transparent padding from the source artwork so we start with the pure emblem
  console.log('Trimming transparent border from source artwork...');
  const trimmedLogoBuffer = await sharp(sourceLogo)
    .trim()
    .toBuffer();

  const trimmedMeta = await sharp(trimmedLogoBuffer).metadata();
  console.log(`Trimmed dimensions: ${trimmedMeta.width}x${trimmedMeta.height}`);

  // Minimal safety padding: 6% (target 5-8% as per requirement 17)
  // Artwork will occupy 88% of canvas size
  const PADDING_RATIO = 0.06;
  const ARTWORK_RATIO = 1 - 2 * PADDING_RATIO; // 0.88

  // Outer emblem color: deep blue matching emblem outer border
  const emblemBgBlue = { r: 5, g: 64, b: 144, alpha: 1 }; // #054090

  // 2. Standard Any Icons (192x192 and 512x512)
  // Transparent background, minimal padding, no container, no card, no extra frame
  const anySizes = [192, 512];
  for (const size of anySizes) {
    const artSize = Math.round(size * ARTWORK_RATIO);
    const resizedArt = await sharp(trimmedLogoBuffer)
      .resize(artSize, artSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    const outPath = path.join(publicDir, `pwa-${size}x${size}.png`);
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([
        {
          input: resizedArt,
          gravity: sharp.gravity.center
        }
      ])
      .png()
      .toFile(outPath);

    console.log(`Generated: ${outPath} (${size}x${size}, artSize: ${artSize}px, ~6% padding)`);
  }

  // 3. Maskable Icons (192x192 and 512x512)
  // For maskable icons, the safe zone is an 80% circle (10% padding on each edge).
  // Scaled to fit safe zone without clipping while keeping artwork as large as safe.
  // Using matching outer emblem color so Android launcher masks (circle/squircle) blend seamlessly
  // without any artificial container or white box effect.
  const MASKABLE_ARTWORK_RATIO = 0.82; // 9% safe margin around emblem
  for (const size of anySizes) {
    const artSize = Math.round(size * MASKABLE_ARTWORK_RATIO);
    const resizedArt = await sharp(trimmedLogoBuffer)
      .resize(artSize, artSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    const outPath = path.join(publicDir, `pwa-maskable-${size}x${size}.png`);
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: emblemBgBlue
      }
    })
      .composite([
        {
          input: resizedArt,
          gravity: sharp.gravity.center
        }
      ])
      .png()
      .toFile(outPath);

    console.log(`Generated maskable: ${outPath} (${size}x${size}, artSize: ${artSize}px)`);
  }

  // 4. Apple Touch Icon (180x180)
  const appleSize = 180;
  const appleArtSize = Math.round(appleSize * 0.86);
  const appleResized = await sharp(trimmedLogoBuffer)
    .resize(appleArtSize, appleArtSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: appleSize,
      height: appleSize,
      channels: 4,
      background: emblemBgBlue
    }
  })
    .composite([
      {
        input: appleResized,
        gravity: sharp.gravity.center
      }
    ])
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated: apple-touch-icon.png (180x180)');

  // 5. Favicon (64x64) with trimmed artwork and minimal padding
  const favSize = 64;
  const favArtSize = Math.round(favSize * 0.90);
  const favResized = await sharp(trimmedLogoBuffer)
    .resize(favArtSize, favArtSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: favSize,
      height: favSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      {
        input: favResized,
        gravity: sharp.gravity.center
      }
    ])
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));
  console.log('Generated: favicon.png (64x64)');

  console.log('\nAll PWA icons generated successfully!');
}

generatePwaIcons().catch(err => {
  console.error('Failed generating PWA icons:', err);
  process.exit(1);
});
