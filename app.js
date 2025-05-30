// app.js
App({
  globalData: {
    loggedInUser: null,
    statusBarHeight: 0, // 初始化 statusBarHeight
    navBarHeight: 0    // 初始化 navBarHeight
  },
  onLaunch() {
    // 云开发初始化
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-0gmfc74geebd1b50', // 根据您的 File ID 推断的环境ID
        traceUser: true, 
      });
      console.log('微信云开发环境已尝试初始化。');
    }

    // Optional: Try to load loggedInUser from storage on launch
    const user = wx.getStorageSync('loggedInUser');
    if (user) {
      this.globalData.loggedInUser = user;
    }

    // 获取系统信息，设置全局 statusBarHeight 和 navBarHeight
    try {
      const systemInfo = wx.getSystemInfoSync();
      this.globalData.statusBarHeight = systemInfo.statusBarHeight;
      // 假设导航栏内容区高度为44px (典型值)
      this.globalData.navBarHeight = 44 + systemInfo.statusBarHeight; 
    } catch (e) {
      console.error('获取系统信息失败:', e);
      // 可以设置一个默认值或进一步处理错误
      this.globalData.statusBarHeight = 20; // 默认值
      this.globalData.navBarHeight = 64;    // 默认值
    }

  }
})
