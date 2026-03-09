const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDir = path.join(__dirname, '../public/ui');
const outputDir = path.join(__dirname, '../public/ui-optimized');

console.log('🖼️  Optimizare Imagini - Triathlon Team');
console.log('=========================================\n');

// Creează directorul de output dacă nu există
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`✓ Director creat: ${outputDir}\n`);
}

// Statistici
let totalInputSize = 0;
let totalOutputSize = 0;
let processedCount = 0;
let errorCount = 0;

// Procesează toate imaginile
const processImages = async () => {
  const files = fs.readdirSync(inputDir)
    .filter(file => /\.(jpg|jpeg|JPG|JPEG)$/i.test(file));

  console.log(`📁 Găsite ${files.length} imagini de procesat...\n`);

  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, file.toLowerCase());
    const webpPath = outputPath.replace(/\.jpe?g$/i, '.webp');

    try {
      const inputSize = fs.statSync(inputPath).size;
      totalInputSize += inputSize;

      // 1. Optimizează JPG (max width 1920px, quality 80%)
      await sharp(inputPath)
        .resize(1920, null, {
          withoutEnlargement: true,
          fit: 'inside'
        })
        .jpeg({
          quality: 80,
          progressive: true,
          mozjpeg: true
        })
        .toFile(outputPath);

      const jpgOutputSize = fs.statSync(outputPath).size;

      // 2. Generează și WebP (quality 80%)
      await sharp(inputPath)
        .resize(1920, null, {
          withoutEnlargement: true,
          fit: 'inside'
        })
        .webp({
          quality: 80
        })
        .toFile(webpPath);

      const webpOutputSize = fs.statSync(webpPath).size;
      totalOutputSize += jpgOutputSize + webpOutputSize;

      const jpgReduction = ((1 - jpgOutputSize / inputSize) * 100).toFixed(1);
      const webpReduction = ((1 - webpOutputSize / inputSize) * 100).toFixed(1);

      console.log(`✓ ${file}`);
      console.log(`  Original:  ${(inputSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  JPG:       ${(jpgOutputSize / 1024 / 1024).toFixed(2)} MB (-${jpgReduction}%)`);
      console.log(`  WebP:      ${(webpOutputSize / 1024 / 1024).toFixed(2)} MB (-${webpReduction}%)`);
      console.log('');

      processedCount++;
    } catch (err) {
      console.error(`✗ Eroare la procesarea ${file}:`, err.message);
      errorCount++;
    }
  }

  // Afișează sumar final
  console.log('\n=========================================');
  console.log('📊 SUMAR OPTIMIZARE');
  console.log('=========================================');
  console.log(`✓ Imagini procesate:  ${processedCount}`);
  console.log(`✗ Erori:              ${errorCount}`);
  console.log(`📦 Dimensiune inițială: ${(totalInputSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📦 Dimensiune finală:   ${(totalOutputSize / 1024 / 1024).toFixed(2)} MB`);
  
  const totalReduction = ((1 - totalOutputSize / totalInputSize) * 100).toFixed(1);
  const savedMB = ((totalInputSize - totalOutputSize) / 1024 / 1024).toFixed(2);
  
  console.log(`💾 Economisit:          ${savedMB} MB (${totalReduction}%)`);
  console.log('\n✅ Optimizare completă!');
  console.log(`\n📁 Imaginile optimizate sunt în: ${outputDir}`);
  console.log('\n💡 URMĂTORII PAȘI:');
  console.log('   1. Verifică imaginile optimizate în folderul ui-optimized');
  console.log('   2. Dacă arată bine, șterge imaginile vechi din ui/');
  console.log('   3. Mută imaginile din ui-optimized/ în ui/');
  console.log('   4. Reîncarcă site-ul și testează performanța!');
};

processImages().catch(err => {
  console.error('\n❌ Eroare fatală:', err);
  process.exit(1);
});

