const fs = require('fs');
const path = require('path');
const {exec} = require('child_process');
const {promisify} = require('util');

const inputDir = 'F:\\我的下载\\我的视频\\真人\\外国妞'; // 视频目录路径
const execPromise = promisify(exec);

// 最大并发数量
const maxConcurrentSessions = 2;
let runningSessions = 0;

function convertVideo(filePath, outputFilePath) {
    return new Promise((resolve, reject) => {
        const command = `ffmpeg -hwaccel cuda -c:v h264_cuvid -i "${filePath}" -c:v h264_nvenc "${outputFilePath}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

function processFileQueue(queue) {
    if (queue.length === 0) {
        console.log('所有文件处理完成');
        return;
    }

    if (runningSessions < maxConcurrentSessions) {
        const file = queue.shift();
        const filePath = path.join(inputDir, file);
        const outputFilePath = path.join(inputDir, file.replace('.ts', '.mp4'));

        runningSessions++;
        console.log(`开始处理: ${file}`);

        convertVideo(filePath, outputFilePath)
            .then(() => {
                console.log(`成功转换: ${file}`);

                // 删除原始的 .ts 文件
                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error(`删除文件 ${file} 失败:`, err.message);
                    } else {
                        console.log(`已删除原始 .ts 文件: ${file}`);
                    }
                });

                runningSessions--;
                processFileQueue(queue); // 处理下一个文件
            })
            .catch((error) => {
                console.error(`转换失败: ${file}, 错误:`, error.message);

                // 删除已生成的错误 .mp4 文件
                fs.unlink(outputFilePath, (unlinkErr) => {
                    if (unlinkErr) {
                        console.error(`删除错误文件 ${outputFilePath} 失败:`, unlinkErr.message);
                    } else {
                        console.log(`已删除错误的 .mp4 文件: ${outputFilePath}`);
                    }
                });

                runningSessions--;
                processFileQueue(queue); // 继续处理队列
            });
    } else {
        setTimeout(() => processFileQueue(queue), 500); // 等待一段时间后再检查
    }
}

// 获取 .ts 文件列表并启动处理
fs.readdir(inputDir, (err, files) => {
    if (err) {
        console.error('无法读取目录:', err);
        return;
    }

    const tsFiles = files.filter(file => path.extname(file) === '.ts');

    if (tsFiles.length === 0) {
        console.log('没有找到 .ts 文件');
        return;
    }

    console.log(`找到 ${tsFiles.length} 个 .ts 文件，开始转换...`);
    processFileQueue(tsFiles);
});
