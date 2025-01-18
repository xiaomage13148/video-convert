# 初衷

从IDM或者NDM下载的视频资源后缀格式好多都是m3u8，为了快捷的批量将m3u8后缀的视频批量转换成mp4，所以写了这个脚本

# 基础配置

1. windows 安装 ffmpeg 并配置环境变量。参考：[【最新】windows电脑FFmpeg安装教程手把手详解_windows安装ffmpeg-CSDN博客](https://blog.csdn.net/csdn_yudong/article/details/129182648)

2. 本人电脑显卡 4060ti，使用的英伟达cuda加速指令，其他显卡类型可以自行查阅资料修改`worker.js`中的指令

   

