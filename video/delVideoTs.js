const fs = require('fs');
const path = require('path');

// 指定你的视频目录路径
const videoDir = 'F:\\我的下载\\我的视频\\真人\\2023-03-24'; // 替换为你的视频目录路径

// 读取目录中的所有文件
fs.readdir(videoDir, (err, files) => {
    if (err) {
        console.error('无法读取目录:', err);
        return;
    }

    // 过滤出 .mp4 和 .ts 文件
    const mp4Files = files.filter(file => path.extname(file) === '.mp4');
    const tsFiles = files.filter(file => path.extname(file) === '.ts');

    // 创建一个 Set 来存储所有的 .mp4 文件名（不包含扩展名）
    const mp4BaseNames = new Set(mp4Files.map(file => path.basename(file, '.mp4')));

    // 遍历 .ts 文件，检查是否有对应的 .mp4 文件
    tsFiles.forEach(tsFile => {
        const baseName = path.basename(tsFile, '.ts');

        // 如果有对应的 .mp4 文件，删除 .ts 文件
        if (mp4BaseNames.has(baseName)) {
            const tsFilePath = path.join(videoDir, tsFile);
            fs.unlink(tsFilePath, (err) => {
                if (err) {
                    console.error(`删除文件 ${tsFile} 失败:`, err);
                } else {
                    console.log(`成功删除重复文件: ${tsFile}`);
                }
            });
        }
    });
});
