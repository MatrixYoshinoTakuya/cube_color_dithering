const palette = [
    [255, 255, 255], // 白
    [0, 0, 255],     // 青
    [255, 0, 0],     // 赤
    [255, 165, 0],   // オレンジ
    [255, 255, 0],   // 黄色
    [0, 128, 0]      // 緑
];

let originalImage = null;
let cropArea = { x: 0, y: 0, width: 0, height: 0 };

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

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            // Display preview image
            const previewImage = document.createElement('img');
            previewImage.src = event.target.result;
            previewImage.style.maxWidth = '100%';
            previewImage.style.border = '2px solid rgba(255, 255, 255, 0.3)';
            previewImage.style.borderRadius = '10px';
            const uploadArea = document.getElementById('uploadArea');
            uploadArea.innerHTML = ''; // Clear previous content
            uploadArea.appendChild(previewImage);

            // Set originalImage and enable the convert button
            originalImage = new Image();
            originalImage.onload = function() {
                convertBtn.disabled = false;
                console.log('Image loaded and ready for processing');
                initializeCropTool();
            };
            originalImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});
convertBtn.addEventListener('click', convertImage);
downloadBtn.addEventListener('click', downloadImage);

document.getElementById('resizeWidth').addEventListener('input', updateResizeText);
document.getElementById('resizeHeight').addEventListener('input', updateResizeText);

function updateResizeText() {
    const width = document.getElementById('resizeWidth').value;
    const height = document.getElementById('resizeHeight').value;
    document.getElementById('resizeText').textContent = `${width}×${height}`;
}

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
        const file = files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                // Display preview image
                const previewImage = document.createElement('img');
                previewImage.src = event.target.result;
                previewImage.style.maxWidth = '100%';
                previewImage.style.border = '2px solid rgba(255, 255, 255, 0.3)';
                previewImage.style.borderRadius = '10px';
                uploadArea.innerHTML = ''; // Clear previous content
                uploadArea.appendChild(previewImage);
                
                // Set originalImage and enable the convert button
                originalImage = new Image();
                originalImage.onload = function() {
                    convertBtn.disabled = false;
                    console.log('Image loaded and ready for processing');
                    initializeCropTool();
                };
                originalImage.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            alert('画像ファイルを選択してください');
        }
    }
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

/**
 * Initializes the crop tool UI and functionality for cropping an image.
 * 
 * - Removes any existing crop canvas and container from the DOM.
 * - Creates a new crop canvas displaying the original image.
 * - Adds a reset button to restore the crop area to the full image.
 * - Handles mouse and touch events for selecting and resizing the crop area,
 *   maintaining the aspect ratio specified by the resizeWidth and resizeHeight inputs.
 * - Draws the crop rectangle on the canvas and updates the display accordingly.
 * 
 * Assumes the existence of the following global variables and elements:
 * - `originalImage`: The source image to be cropped (HTMLImageElement).
 * - `cropArea`: An object representing the crop rectangle ({ x, y, width, height }).
 * - `updateOriginalImgDisplay()`: A function to update the image display after cropping.
 * - `resizeWidth`, `resizeHeight`: Input elements specifying the output aspect ratio.
 * - `uploadArea`: The DOM element after which the crop tool UI is inserted.
 */
function initializeCropTool() {
    // 既存の cropCanvas/cropContainer を削除
    const oldCropCanvas = document.getElementById('cropCanvas');
    if (oldCropCanvas) {
        const oldContainer = oldCropCanvas.parentNode;
        if (oldContainer && oldContainer.parentNode) {
            oldContainer.parentNode.removeChild(oldContainer);
        }
    }

    const cropCanvas = document.createElement('canvas');
    cropCanvas.id = 'cropCanvas';
    cropCanvas.width = originalImage.width;
    cropCanvas.height = originalImage.height;
    cropCanvas.style.position = 'relative';
    cropCanvas.style.marginLeft = '20px';
    cropCanvas.style.border = '2px dashed red';
    cropCanvas.style.cursor = 'crosshair';

    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.drawImage(originalImage, 0, 0);

    const cropContainer = document.createElement('div');
    cropContainer.style.display = 'flex';
    cropContainer.style.flexDirection = 'column';
    cropContainer.style.alignItems = 'center';

    const resetButton = document.createElement('button');
    resetButton.textContent = 'リセット';
    resetButton.style.marginTop = '10px';
    resetButton.addEventListener('click', () => {
        cropArea = { x: 0, y: 0, width: originalImage.width, height: originalImage.height };
        cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
        cropCtx.drawImage(originalImage, 0, 0);
        cropCtx.strokeStyle = 'blue';
        cropCtx.lineWidth = 2;
        cropCtx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
        updateOriginalImgDisplay();
    });

    cropContainer.appendChild(cropCanvas);
    cropContainer.appendChild(resetButton);

    const uploadArea = document.getElementById('uploadArea');
    uploadArea.parentNode.insertBefore(cropContainer, uploadArea.nextSibling);

    let isDragging = false;

    // --- マウス操作 ---
    cropCanvas.addEventListener('mousedown', (e) => {
        const rect = cropCanvas.getBoundingClientRect();
        cropArea.x = e.clientX - rect.left;
        cropArea.y = e.clientY - rect.top;
        isDragging = true;
    });
    cropCanvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const rect = cropCanvas.getBoundingClientRect();
            const width = parseInt(document.getElementById('resizeWidth').value, 10);
            const height = parseInt(document.getElementById('resizeHeight').value, 10);
            const outputRatio = width / height;
            let newWidth = e.clientX - rect.left - cropArea.x;
            let newHeight = e.clientY - rect.top - cropArea.y;
            if (newWidth / newHeight > outputRatio) {
                newWidth = newHeight * outputRatio;
            } else {
                newHeight = newWidth / outputRatio;
            }
            cropArea.width = newWidth;
            cropArea.height = newHeight;
            cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
            cropCtx.drawImage(originalImage, 0, 0);
            cropCtx.strokeStyle = 'blue';
            cropCtx.lineWidth = 2;
            cropCtx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
            updateOriginalImgDisplay();
        }
    });
    cropCanvas.addEventListener('mouseup', () => {
        isDragging = false;
    });
    cropCanvas.addEventListener('mouseleave', () => {
        isDragging = false;
    });

    // --- タッチ操作（スマホ対応）---
    cropCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const rect = cropCanvas.getBoundingClientRect();
        const touch = e.touches[0];
        cropArea.x = touch.clientX - rect.left;
        cropArea.y = touch.clientY - rect.top;
        isDragging = true;
    }, { passive: false });
    cropCanvas.addEventListener('touchmove', (e) => {
        if (isDragging) {
            e.preventDefault();
            const rect = cropCanvas.getBoundingClientRect();
            const touch = e.touches[0];
            const width = parseInt(document.getElementById('resizeWidth').value, 10);
            const height = parseInt(document.getElementById('resizeHeight').value, 10);
            const outputRatio = width / height;
            let newWidth = touch.clientX - rect.left - cropArea.x;
            let newHeight = touch.clientY - rect.top - cropArea.y;
            if (newWidth / newHeight > outputRatio) {
                newWidth = newHeight * outputRatio;
            } else {
                newHeight = newWidth / outputRatio;
            }
            cropArea.width = newWidth;
            cropArea.height = newHeight;
            cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
            cropCtx.drawImage(originalImage, 0, 0);
            cropCtx.strokeStyle = 'blue';
            cropCtx.lineWidth = 2;
            cropCtx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
            updateOriginalImgDisplay();
        }
    }, { passive: false });
    cropCanvas.addEventListener('touchend', (e) => {
        isDragging = false;
    });

    // Initialize with default crop area
    cropArea = { x: 0, y: 0, width: originalImage.width, height: originalImage.height };
    updateOriginalImgDisplay();
}

function updateOriginalImgDisplay() {
    const originalImgCtx = originalImg.getContext('2d');
    const canvasWidth = originalImg.width;
    const canvasHeight = originalImg.height;
    
    // Maintain aspect ratio of the crop area
    const cropRatio = cropArea.width / cropArea.height;
    let displayWidth, displayHeight;
    
    if (cropRatio > 1) {
        // Landscape orientation
        displayWidth = canvasWidth;
        displayHeight = canvasWidth / cropRatio;
    } else {
        // Portrait or square orientation
        displayHeight = canvasHeight;
        displayWidth = canvasHeight * cropRatio;
    }
    
    // Center the image in the canvas
    const offsetX = (canvasWidth - displayWidth) / 2;
    const offsetY = (canvasHeight - displayHeight) / 2;
    
    originalImgCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    originalImgCtx.drawImage(
        originalImage, 
        cropArea.x, 
        cropArea.y, 
        cropArea.width, 
        cropArea.height,
        offsetX,
        offsetY,
        displayWidth,
        displayHeight
    );
}

async function convertImage() {
    if (!originalImage) {
        alert('画像が選択されていません。');
        return;
    }

    // ユーザー指定の幅と高さを取得
    const width = parseInt(document.getElementById('resizeWidth').value, 10);
    const height = parseInt(document.getElementById('resizeHeight').value, 10);

    // 出力canvasのサイズを指定サイズに合わせる
    resultCanvas.width = width;
    resultCanvas.height = height;
    scaledCanvas.width = width * 10;
    scaledCanvas.height = height * 10;

    // Clear output canvases
    const ctx = resultCanvas.getContext('2d');
    ctx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
    const scaledCtx = scaledCanvas.getContext('2d');
    scaledCtx.clearRect(0, 0, scaledCanvas.width, scaledCanvas.height);

    // プログレスバー表示
    progress.style.display = 'block';
    progressBar.style.width = '0%';
    convertBtn.disabled = true;

    // 出力サイズの比率を計算
    const outputRatio = width / height;
    const cropRatio = cropArea.width / cropArea.height;

    // 比率を調整
    if (cropRatio > outputRatio) {
        const adjustedWidth = cropArea.height * outputRatio;
        cropArea.x += (cropArea.width - adjustedWidth) / 2;
        cropArea.width = adjustedWidth;
    } else if (cropRatio < outputRatio) {
        const adjustedHeight = cropArea.width / outputRatio;
        cropArea.y += (cropArea.height - adjustedHeight) / 2;
        cropArea.height = adjustedHeight;
    }

    // 選択範囲の表示を更新
    const cropCanvas = document.getElementById('cropCanvas');
    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
    cropCtx.drawImage(originalImage, 0, 0);
    cropCtx.strokeStyle = 'blue';
    cropCtx.lineWidth = 2;
    cropCtx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    
    // 選択範囲を元画像表示に反映
    updateOriginalImgDisplay();

    // リサイズ用キャンバスを作成
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = width;
    tempCanvas.height = height;

    // スムーズなリサイズのため、段階的に縮小
    progressBar.style.width = '25%';
    await new Promise(resolve => setTimeout(resolve, 100));

    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';
    tempCtx.drawImage(
        originalImage,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height,
        0,
        0,
        width,
        height
    );

    progressBar.style.width = '50%';
    await new Promise(resolve => setTimeout(resolve, 100));

    // 画像データを取得
    const imageData = tempCtx.getImageData(0, 0, width, height);

    // 透過部分を白で塗りつぶし、アルファ値を255に
    for (let i = 0; i < imageData.data.length; i += 4) {
        if (imageData.data[i + 3] < 255) {
            var alpha = imageData.data[i + 3] / 255; // アルファ値を0-1の範囲に変換;
            imageData.data[i] = imageData.data[i] * alpha + 255 * (1 - alpha);     // R
            imageData.data[i + 1] = imageData.data[i + 1] * alpha + 255 * (1 - alpha); // G
            imageData.data[i + 2] = imageData.data[i + 2] * alpha + 255 * (1 - alpha); // B
            imageData.data[i + 3] = 255; // A
        } else {
            imageData.data[i + 3] = 255; // 強制的に不透明化
        }
    }

    progressBar.style.width = '75%';
    await new Promise(resolve => setTimeout(resolve, 100));

    // ディザリング処理
    const ditheredData = floydSteinbergDithering(imageData, width, height);

    // 結果をcanvasに描画
    ctx.putImageData(ditheredData, 0, 0);

    // 拡大版も作成（ピクセルアートスタイル）
    scaledCtx.imageSmoothingEnabled = false;
    scaledCtx.drawImage(resultCanvas, 0, 0, width * 10, height * 10);

    progressBar.style.width = '100%';
    await new Promise(resolve => setTimeout(resolve, 300));

    // UI更新
    progress.style.display = 'none';
    resultArea.style.display = 'flex';
    convertBtn.disabled = false;
    downloadBtn.disabled = false;
}

function downloadImage() {
    const width = document.getElementById('resizeWidth').value;
    const height = document.getElementById('resizeHeight').value;
    const fileName = `dithered_${width}x${height}`;
    const link = document.createElement('a');
    link.download = `${fileName}.png`;
    link.href = resultCanvas.toDataURL();
    link.click();
}
