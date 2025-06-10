const palette = [
    [255, 255, 255], // 白
    [0, 0, 255],     // 青
    [255, 0, 0],     // 赤
    [255, 165, 0],   // オレンジ
    [255, 255, 0],   // 黄色
    [0, 128, 0]      // 緑
];

let originalImage = null;

// UI要素の取得
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const convertBtn = document.getElementById('convertBtn');
const downloadBtn = document.getElementById('downloadBtn');
const originalImg = document.getElementById('originalImg');
const resultCanvas = document.getElementById('resultCanvas');
const scaledCanvas = document.getElementById('scaledCanvas');
const resultArea = document.getElementById('resultArea');
const progress = document.getElementById('progress');
const progressBar = document.getElementById('progressBar');

// イベントリスナーの設定
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('drop', handleDrop);
uploadArea.addEventListener('dragenter', e => e.preventDefault());
uploadArea.addEventListener('dragleave', handleDragLeave);

fileInput.addEventListener('change', handleFileSelect);
convertBtn.addEventListener('click', convertImage);
downloadBtn.addEventListener('click', downloadImage);

function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('画像ファイルを選択してください');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        originalImage = new Image();
        originalImage.onload = function() {
            originalImg.src = e.target.result;
            convertBtn.disabled = false;
            resultArea.style.display = 'none';
            downloadBtn.disabled = true;
        };
        originalImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function colorDistance(c1, c2) {
    return Math.sqrt(
        Math.pow(c1[0] - c2[0], 2) +
        Math.pow(c1[1] - c2[1], 2) +
        Math.pow(c1[2] - c2[2], 2)
    );
}

function findClosestColor(rgb) {
    let minDistance = Infinity;
    let closestColor = palette[0];

    for (let color of palette) {
        const distance = colorDistance(rgb, color);
        if (distance < minDistance) {
            minDistance = distance;
            closestColor = color;
        }
    }

    return closestColor;
}

function floydSteinbergDithering(imageData, width, height) {
    const data = new Uint8ClampedArray(imageData.data);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const oldPixel = [data[idx], data[idx + 1], data[idx + 2]];
            const newPixel = findClosestColor(oldPixel);

            // 新しい色を設定
            data[idx] = newPixel[0];
            data[idx + 1] = newPixel[1];
            data[idx + 2] = newPixel[2];

            // 誤差を計算
            const error = [
                oldPixel[0] - newPixel[0],
                oldPixel[1] - newPixel[1],
                oldPixel[2] - newPixel[2]
            ];

            // Floyd-Steinberg誤差拡散
            distributeError(data, width, height, x, y, error);
        }
    }

    return new ImageData(data, width, height);
}

function distributeError(data, width, height, x, y, error) {
    const distributions = [
        { dx: 1, dy: 0, factor: 7/16 },  // 右
        { dx: -1, dy: 1, factor: 3/16 }, // 左下
        { dx: 0, dy: 1, factor: 5/16 },  // 下
        { dx: 1, dy: 1, factor: 1/16 }   // 右下
    ];

    for (let dist of distributions) {
        const nx = x + dist.dx;
        const ny = y + dist.dy;

        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const idx = (ny * width + nx) * 4;
            data[idx] = Math.max(0, Math.min(255, data[idx] + error[0] * dist.factor));
            data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + error[1] * dist.factor));
            data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + error[2] * dist.factor));
        }
    }
}

async function convertImage() {
    if (!originalImage) return;

    // プログレスバー表示
    progress.style.display = 'block';
    progressBar.style.width = '0%';
    convertBtn.disabled = true;

    // 30×30にリサイズ
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = 30;
    tempCanvas.height = 30;

    // スムーズなリサイズのため、段階的に縮小
    progressBar.style.width = '25%';
    await new Promise(resolve => setTimeout(resolve, 100));

    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';
    tempCtx.drawImage(originalImage, 0, 0, 30, 30);

    progressBar.style.width = '50%';
    await new Promise(resolve => setTimeout(resolve, 100));

    // 画像データを取得
    const imageData = tempCtx.getImageData(0, 0, 30, 30);

    progressBar.style.width = '75%';
    await new Promise(resolve => setTimeout(resolve, 100));

    // ディザリング処理
    const ditheredData = floydSteinbergDithering(imageData, 30, 30);

    // 結果をcanvasに描画
    const ctx = resultCanvas.getContext('2d');
    ctx.putImageData(ditheredData, 0, 0);

    // 拡大版も作成（ピクセルアートスタイル）
    const scaledCtx = scaledCanvas.getContext('2d');
    scaledCtx.imageSmoothingEnabled = false;
    scaledCtx.drawImage(resultCanvas, 0, 0, 300, 300);

    progressBar.style.width = '100%';
    await new Promise(resolve => setTimeout(resolve, 300));

    // UI更新
    progress.style.display = 'none';
    resultArea.style.display = 'flex';
    convertBtn.disabled = false;
    downloadBtn.disabled = false;
}

function downloadImage() {
    const link = document.createElement('a');
    link.download = 'dithered_30x30.png';
    link.href = resultCanvas.toDataURL();
    link.click();
}
