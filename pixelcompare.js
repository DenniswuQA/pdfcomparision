import fs from 'fs-extra';
import path from 'path';
import poppler from 'pdf-poppler';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
// npm install fs-extra pdf-poppler pngjs pixelmatch

const getFormattedDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}${day}${hours}${minutes}`; // Removed the colon
};

const convertPdfToPng = async (pdfPath, outputDir) => {
    const options = {
        format: 'png',
        out_dir: outputDir,
        out_prefix: path.basename(pdfPath, path.extname(pdfPath)),
        page: null // Convert all pages
    };

    try {
        await poppler.convert(pdfPath, options);
        console.log(`Successfully converted ${pdfPath} to PNG format in ${outputDir}`);
    } catch (error) {
        console.error(`Error converting ${pdfPath}: `, error);
    }
};

const cleanupDirectory = async (dir) => {
    try {
        const files = await fs.readdir(dir);
        for (const file of files) {
            if (file.endsWith('.png')) {
                await fs.unlink(path.join(dir, file));
            }
        }
        console.log(`Cleaned up PNG files in ${dir}`);
    } catch (error) {
        console.error(`Error cleaning up directory ${dir}: `, error);
    }
};

const compareImages = (img1Path, img2Path, outputDir, outputFileName) => {
    const img1 = PNG.sync.read(fs.readFileSync(img1Path));
    const img2 = PNG.sync.read(fs.readFileSync(img2Path));
    const { width, height } = img1;
    const diff = new PNG({ width, height });

    const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });

    fs.ensureDirSync(outputDir);
    fs.writeFileSync(path.join(outputDir, outputFileName), PNG.sync.write(diff));

    return numDiffPixels;
};

const getNumericSuffix = (filename) => {
    const match = filename.match(/-(\d+)\.png$/);
    return match ? match[1] : null;
};

const main = async () => {
    const args = process.argv.slice(2);

    if (args.length !== 2) {
        console.error('Please provide exactly two PDF filenames as arguments.');
        process.exit(1);
    }

    const pdf1 = args[0];
    const pdf2 = args[1];

    const pdf1Dir = path.join(process.cwd(), `1-firstPDF`);
    const pdf2Dir = path.join(process.cwd(), `2-secondPDF`);
    const outputDir = path.join(process.cwd(), 'result');

    // Ensure output directories exist and clean them up
    if (!fs.existsSync(pdf1Dir)) {
        fs.mkdirSync(pdf1Dir);
    } else {
        await cleanupDirectory(pdf1Dir);
    }

    if (!fs.existsSync(pdf2Dir)) {
        fs.mkdirSync(pdf2Dir);
    } else {
        await cleanupDirectory(pdf2Dir);
    }

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    } else {
        await cleanupDirectory(outputDir);
    }

    // Convert PDFs to PNGs
    await convertPdfToPng(pdf1, pdf1Dir);
    await convertPdfToPng(pdf2, pdf2Dir);

    // Compare images
    const files1 = fs.readdirSync(pdf1Dir).filter(file => file.endsWith('.png'));
    const files2 = fs.readdirSync(pdf2Dir).filter(file => file.endsWith('.png'));

    console.log('Files in first directory:', files1);
    console.log('Files in second directory:', files2);

    const files2Map = new Map(files2.map(file => [getNumericSuffix(file), file]));

    files1.forEach(file => {
        const suffix = getNumericSuffix(file);
        if (suffix && files2Map.has(suffix)) {
            const img1Path = path.join(pdf1Dir, file);
            const img2Path = path.join(pdf2Dir, files2Map.get(suffix));
            const diffFileName = `diff-${file}`;
            const numDiffPixels = compareImages(img1Path, img2Path, outputDir, diffFileName);

            console.log(`Compared ${file} with ${files2Map.get(suffix)}: ${numDiffPixels} pixels differ`);
        } else {
            console.warn(`File ${file} does not have a corresponding file in the second directory`);
        }
    });

    // Clean up PNG files in the source directories
    //await cleanupDirectory(pdf1Dir);
    //await cleanupDirectory(pdf2Dir);
};

main();
