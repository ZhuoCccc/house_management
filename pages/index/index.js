// index.js
const app = getApp(); // 获取 App 实例

Page({
  onLoad: function (options) {
    this.checkLoginStatus();
  },

  onShow: function () {
    // 如果希望每次页面显示时都检查登录状态（例如从后台切回前台），也在此处调用
    // this.checkLoginStatus(); 
  },

  checkLoginStatus: function() {
    // 示例：从本地存储获取用户信息来判断登录状态
    // 您需要根据您的实际登录逻辑调整这里的判断条件
    const userInfo = wx.getStorageSync('loggedInUser'); // 假设登录成功后会存储 loggedInUser

    if (userInfo && userInfo.username) { // 或者其他判断用户已登录的条件
      console.log('用户已登录, 跳转到主页');
      // 跳转到主页 (假设是 TabBar 页面)
      wx.switchTab({
        url: '/pages/home/home' // 请替换为您的实际主页路径
      });
      // 如果主页不是 TabBar 页面，使用 wx.redirectTo
      // wx.redirectTo({
      //   url: '/pages/home/home' 
      // });
    } else {
      console.log('用户未登录, 跳转到登录页');
      // 跳转到登录页
      wx.redirectTo({
        url: '/pages/login/login' // 请替换为您的实际登录页路径
      });
    }
  }
})