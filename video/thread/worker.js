// worker.js
const {parentPort} = require('worker_threads');
const {exec} = require('child_process');

// 接收主线程传递的消息
parentPort.on('message', ({filePath, outputFilePath}) => {
    const command = `ffmpeg -hwaccel cuda -c:v h264_cuvid -i "${filePath}" -c:v h264_nvenc "${outputFilePath}"`;
    exec(command, (error, stdout, stderr) => {
        if (error) {
            parentPort.postMessage({success: false, message: error.message});
        } else {
            parentPort.postMessage({success: true});
        }
    });
});
