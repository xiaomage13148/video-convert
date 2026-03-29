const fs = require('fs');
const path = require('path');
const {Worker} = require('worker_threads');

// 指定视频文件所在的目录
const inputDir = 'D:\\NDM下载\\Video'; // 你的视频目录路径

// 支持的视频格式列表
const supportedFormats = ['.ts', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.3gp', '.m2ts', '.mts'];

function runWorker(filePath, outputFilePath) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, 'worker.js'));

        worker.on('message', (message) => {
            if (message.success) {
                resolve();
            } else {
                reject(new Error(message.message));
            }
        });

        worker.on('error', reject);

        // 监听工作线程的退出事件
        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });

        worker.postMessage({filePath, outputFilePath}); // 发送文件路径到 Worker
    });
}

// 获取输出文件路径（统一转换为 .mp4）
function getOutputFilePath(inputFilePath) {
    const ext = path.extname(inputFilePath);
    const baseName = path.basename(inputFilePath, ext);
    const dir = path.dirname(inputFilePath);
    return path.join(dir, `${baseName}.mp4`);
}

async function processFile(arrFiles) {
    for (let arr of arrFiles) {
        const pathArr = arr.map(file => {
            const filePath = path.join(inputDir, file);
            const outputFilePath = getOutputFilePath(filePath);
            return [filePath, outputFilePath];
        });

        const runWorkerList = pathArr.map(path => {
            return runWorker(path[0], path[1]);
        });

        try {
            const results = await Promise.allSettled(runWorkerList);
            results.forEach((result, index) => {
                const path = pathArr[index];
                const filePathEl = path[0];
                const outputFileEl = path[1];
                if (result.status === 'fulfilled') {
                    console.log(`成功转换: ${filePathEl}`);
                    // 删除原始文件
                    fs.unlink(filePathEl, (err) => {
                        if (err) {
                            console.error(`删除文件 ${filePathEl} 失败:`, err.message);
                        } else {
                            console.log(`已删除原始文件: ${filePathEl}`);
                        }
                    });
                } else {
                    console.error(`转换失败: ${filePathEl}, 错误:`, result.reason);
                    // 删除已生成的错误 .mp4 文件
                    fs.unlink(outputFileEl, (unlinkErr) => {
                        if (unlinkErr) {
                            console.error(`删除错误文件 ${outputFileEl} 失败:`, unlinkErr.message);
                        } else {
                            console.log(`已删除错误的 .mp4 文件: ${outputFileEl}`);
                        }
                    });
                }
            });
        } catch (e) {
            console.log(`Promise.allSettled 执行出错: ${e.message}`);
        }

    }
}

// 分割数组
function splitArrayIntoPairs(arr, max) {
    if (max > arr.length) {
        max = arr.length;
    }
    const result = [];
    for (let i = 0; i < arr.length; i += max) {
        // 使用 slice 方法从当前索引 i 开始，取出最多两个元素
        result.push(arr.slice(i, i + max));
    }
    return result;
}

// 检查是否为支持的视频格式
function isSupportedVideoFile(file) {
    const ext = path.extname(file).toLowerCase();
    return supportedFormats.includes(ext);
}

// 获取视频文件列表并启动处理
fs.readdir(inputDir, (err, files) => {
    if (err) {
        console.error('无法读取目录:', err);
        return;
    }

    const videoFiles = files.filter(isSupportedVideoFile);

    if (videoFiles.length === 0) {
        console.log(`没有找到支持的视频文件，支持的格式: ${supportedFormats.join(', ')}`);
        return;
    }

    console.log(`找到 ${videoFiles.length} 个视频文件，支持格式: ${supportedFormats.join(', ')}`);
    console.log('开始转换...');
    const arrFiles = splitArrayIntoPairs(videoFiles, 3);
    processFile(arrFiles).then(r => {
        console.log('所有文件处理完成');
        process.exit(0); // 显式退出程序
    });
});
