// worker.js
const {parentPort} = require('worker_threads');
const {exec} = require('child_process');
const path = require('path');

// 检测输入文件的编解码器类型
function detectVideoCodec(filePath) {
    return new Promise((resolve, reject) => {
        const ffprobeCmd = `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
        exec(ffprobeCmd, (error, stdout, stderr) => {
            if (error) {
                resolve('unknown');
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

// 获取优化的 FFmpeg 命令
async function getOptimizedCommand(filePath, outputFilePath) {
    const codec = await detectVideoCodec(filePath);
    
    // RTX 5070 优化参数 - 简化 CUDA 配置以提高兼容性
    const nvencParams = [
        '-c:v h264_nvenc',           // 使用 NVENC H.264 编码器
        '-preset p1',                // 最快预设 (RTX 5070 支持更快的预设)
        '-tune hq',                  // 高质量调优
        '-rc vbr',                   // 可变比特率
        '-cq 23',                    // 质量因子 (类似 CRF)
        '-b:v 0',                    // 不限制比特率
        '-bufsize 16M',              // 缓冲区大小
        '-profile:v high',           // High Profile
        '-level 5.1',                // Level 5.1 支持 4K@30fps
        '-pix_fmt yuv420p',          // 像素格式
        '-movflags +faststart',      // 快速启动 (网络播放优化)
        '-c:a copy',                 // 音频直接复制
        '-c:s copy',                 // 字幕直接复制
    ];

    // 简化的 CUDA 加速参数 - 提高兼容性
    let hwaccelParams = '-hwaccel cuda';
    
    // 根据输入编码选择合适的解码器
    if (codec === 'h264') {
        hwaccelParams += ' -c:v h264_cuvid';
    } else if (codec === 'hevc' || codec === 'h265') {
        hwaccelParams += ' -c:v hevc_cuvid';
    } else if (codec === 'mpeg2video') {
        hwaccelParams += ' -c:v mpeg2_cuvid';
    } else if (codec === 'mpeg4') {
        hwaccelParams += ' -c:v mpeg4_cuvid';
    } else if (codec === 'vp9') {
        hwaccelParams += ' -c:v vp9_cuvid';
    }

    // 构建完整命令
    const command = `ffmpeg ${hwaccelParams} -i "${filePath}" ${nvencParams.join(' ')} "${outputFilePath}"`;
    
    return { command, codec };
}

// 接收主线程传递的消息
parentPort.on('message', async ({filePath, outputFilePath}) => {
    try {
        const { command, codec } = await getOptimizedCommand(filePath, outputFilePath);
        
        console.log(`[Worker] 处理文件: ${path.basename(filePath)}`);
        console.log(`[Worker] 检测到的编码: ${codec}`);
        console.log(`[Worker] 执行命令: ${command}`);
        
        exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            if (error) {
                console.error(`[Worker] 转换失败: ${error.message}`);
                parentPort.postMessage({success: false, message: error.message});
            } else {
                console.log(`[Worker] 转换成功: ${path.basename(outputFilePath)}`);
                parentPort.postMessage({success: true});
            }
        });
    } catch (err) {
        console.error(`[Worker] 错误: ${err.message}`);
        parentPort.postMessage({success: false, message: err.message});
    }
});
