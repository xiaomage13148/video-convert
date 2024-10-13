const fs = require('fs');
const path = require('path');
const {exec} = require('child_process');

// 指定 .ts 文件所在的目录
const inputDir = 'F:\\我的下载\\我的视频\\真人\\外国妞'; // 你的视频目录路径

// 获取指定目录下的所有 .ts 文件
fs.readdir(inputDir, (err, files) => {
    if (err) {
        console.error('无法读取目录:', err);
        return;
    }

    // 过滤出 .ts 文件
    const tsFiles = files.filter(file => path.extname(file) === '.ts');

    if (tsFiles.length === 0) {
        console.log('目录中没有找到 .ts 文件');
        return;
    }

    // 遍历每个 .ts 文件并转换为 .mp4
    tsFiles.forEach(file => {
        console.log(`${file} 开始转换...`);
        const filePath = path.join(inputDir, file);
        const outputFilePath = path.join(inputDir, file.replace('.ts', '.mp4'));

        // ffmpeg 命令，进行文件转换
        const command = `ffmpeg -hwaccel cuda -c:v h264_cuvid -i "${filePath}" -c:v h264_nvenc "${outputFilePath}"`;

        // 执行 ffmpeg 命令
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`转换文件 ${file} 失败:`, error.message);
                // 删除已生成的错误 .mp4 文件
                fs.unlink(outputFilePath, (unlinkErr) => {
                    if (unlinkErr) {
                        console.error(`删除错误文件 ${outputFilePath} 失败:`, unlinkErr.message);
                    } else {
                        console.log(`已删除错误的 .mp4 文件: ${outputFilePath}`);
                    }
                });
                return;
            }
            console.log(`成功将 ${file} 转换为 .mp4`);


            // 删除原始的 .ts 文件
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error(`删除文件 ${file} 失败:`, err.message);
                    return;
                }
                console.log(`已删除原始 .ts 文件: ${file}`);
            });
        });
    });
});
