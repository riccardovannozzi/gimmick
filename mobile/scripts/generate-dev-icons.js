const sharp = require('sharp');
const path = require('path');

const BORDER = 40; // px border thickness
const COLOR = '#FF8C00'; // arancione

async function addBorder(inputPath, outputPath, size) {
  const image = sharp(inputPath).resize(size - BORDER * 2, size - BORDER * 2);
  const bordered = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: COLOR,
    },
  })
    .composite([{ input: await image.toBuffer(), top: BORDER, left: BORDER }])
    .png()
    .toFile(outputPath);

  console.log(`Created: ${outputPath}`);
  return bordered;
}

async function main() {
  const assets = path.join(__dirname, '..', 'assets');

  await addBorder(
    path.join(assets, 'icon.png'),
    path.join(assets, 'icon-dev.png'),
    1024
  );

  await addBorder(
    path.join(assets, 'adaptive-icon.png'),
    path.join(assets, 'adaptive-icon-dev.png'),
    1024
  );
}

main().catch(console.error);
