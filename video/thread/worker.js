// worker.js
const {parentPort} = require('worker_threads');
const {exec} = require('child_process');

// 接收主线程传递的消息
parentPort.on('message', ({filePath, outputFilePath}) => {
    // TODO ---->打印子线程执行 , 日期: 2024/10/13
    console.log(`---->打印子线程执行 , 当前时间是: ${new Date().toString()}`, filePath);
    const command = `ffmpeg -hwaccel cuda -c:v h264_cuvid -i "${filePath}" -c:v h264_nvenc "${outputFilePath}"`;
    exec(command, (error, stdout, stderr) => {
        if (error) {
            parentPort.postMessage({success: false, message: error.message});
        } else {
            parentPort.postMessage({success: true});
        }
    });
});
