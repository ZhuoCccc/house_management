const app = getApp();

Page({
  data: {
    // Custom Navigation Bar related
    statusBarHeight: wx.getSystemInfoSync().statusBarHeight,
    navBarHeight: wx.getMenuButtonBoundingClientRect().height + (wx.getMenuButtonBoundingClientRect().top - wx.getSystemInfoSync().statusBarHeight) * 2,
    navBarTitle: '我的',

    // User Info (Placeholder - ideally from login/globalData)
    // avatarUrl: '/static/images/avatar-placeholder.png', // Placeholder avatar
    username: '用户昵称',
    isLoggedIn: false // We'll update this based on actual login state later
  },

  onShow: function() {
    // Check login status when page is shown
    // This is a simple check. A more robust way would be to use app.globalData
    // or storage to check for a logged-in user token/info.
    const loggedInUser = app.globalData.loggedInUser || wx.getStorageSync('loggedInUser');
    if (loggedInUser && loggedInUser.username) {
      this.setData({
        username: loggedInUser.username,
        isLoggedIn: true
        // avatarUrl: loggedInUser.avatarUrl || '/static/images/avatar-placeholder.png'
      });
    } else {
      this.setData({
        username: '未登录',
        isLoggedIn: false
        // avatarUrl: '/static/images/avatar-placeholder.png'
      });
    }
  },

  // No navigateBack for tab pages usually

  navigateToMyOrders: function() {
    if (!this.data.isLoggedIn) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        // Optional: Redirect to login page
        // setTimeout(() => { wx.navigateTo({ url: '/pages/login/login' }); }, 1500);
        return;
    }
    wx.navigateTo({ url: '/pages/my_orders/my_orders' });
  },

  navigateToLogin: function() {
    wx.navigateTo({ url: '/pages/login/login' });
  },
  
  handleLogout: function() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.globalData.loggedInUser = null;
          wx.removeStorageSync('loggedInUser');
          this.setData({
            username: '未登录',
            isLoggedIn: false,
            // avatarUrl: '/static/images/avatar-placeholder.png'
          });
          wx.showToast({ title: '已退出登录', icon: 'success' });
        }
      }
    });
  }
  // Add other navigation functions for settings, etc.
}); 