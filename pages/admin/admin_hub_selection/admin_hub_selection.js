const app = getApp();

Page({
  data: {
    navBarHeight: app.globalData.navBarHeight,
    adminUsername: ''
  },

  onLoad: function (options) {
    const loggedInUser = app.globalData.loggedInUser;
    if (loggedInUser && loggedInUser.type === 'admin') {
      this.setData({
        adminUsername: loggedInUser.username
      });
    } else {
      wx.redirectTo({ url: '/pages/login/login' });
    }
  },

  onShow: function() {
    const loggedInUser = app.globalData.loggedInUser;
    if (!loggedInUser || loggedInUser.type !== 'admin') {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    if (loggedInUser && this.data.adminUsername !== loggedInUser.username) {
        this.setData({
            adminUsername: loggedInUser.username
        });
    }
  },

  navigateToRoomManagement: function () {
    wx.navigateTo({
      url: '/pages/admin/hotel_management/hotel_management'
    });
  },

  navigateToUserManagement: function () {
    wx.navigateTo({
      url: '/pages/admin/user_management/user_management'
    });
  },
  
  navigateToHotelStatusSelection: function () {
    wx.navigateTo({
        url: '/pages/admin/hotel_status_selection/hotel_status_selection'
    });
  },

  navigateToPendingCleanupLog: function() {
    wx.navigateTo({
      url: '/pages/admin/pending_image_cleanup/pending_image_cleanup'
    });
  },

  logoutAdminHub: function() {
    app.globalData.loggedInUser = null;
    wx.removeStorageSync('loggedInUser');
    wx.showToast({
      title: '已退出登录',
      icon: 'success',
      duration: 1500,
      complete: () => {
        wx.redirectTo({
          url: '/pages/login/login'
        });
      }
    });
  }
}); 