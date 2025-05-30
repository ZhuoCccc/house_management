const app = getApp();
const db = require('../../utils/db.js');

Page({
  data: {
    // Custom Navigation Bar (if you want one here too)
    statusBarHeight: wx.getSystemInfoSync().statusBarHeight,
    navBarHeight: wx.getMenuButtonBoundingClientRect().height + (wx.getMenuButtonBoundingClientRect().top - wx.getSystemInfoSync().statusBarHeight) * 2,
    navBarTitle: '我的订单',
    
    orders: [],
    activeTab: 'all', // 'all', 'pendingPayment', 'pendingStay', 'completed'
    tabs: [
      { key: 'all', title: '全部' },
      { key: 'pendingPayment', title: '待支付' },
      { key: 'pendingStay', title: '待入住' },
      { key: 'completed', title: '已完成' },
    ]
  },

  onShow: function () {
    this.loadOrders();
  },
  
  loadOrders: function() {
    const currentUser = app.globalData.loggedInUser || wx.getStorageSync('loggedInUser');
    if (currentUser && currentUser.username) {
      const userOrders = db.getOrdersByUsername(currentUser.username);
      console.log('Loaded orders for user:', currentUser.username, userOrders);
      this.setData({
        orders: userOrders.map(order => ({
          ...order,
          // Format date for display if needed, e.g. using a utility function
          displayOrderTime: new Date(order.orderTime).toLocaleDateString() + ' ' + new Date(order.orderTime).toLocaleTimeString()
        }))
      });
    } else {
      console.log('No logged in user found, cannot load orders.');
      this.setData({ orders: [] });
      // Optional: Show a message or redirect to login
      wx.showToast({
          title: '请先登录查看订单',
          icon: 'none',
          duration: 2000
      });
    }
  },

  switchTab: function(e) {
    const newTab = e.currentTarget.dataset.key;
    this.setData({ activeTab: newTab });
    // Here you would typically re-filter your this.data.orders based on the activeTab and order.status
    // For now, loadOrders loads all, and filtering will be done in WXML or a separate function.
    // Example: this.filterOrdersByStatus(newTab);
  },

  // filterOrdersByStatus: function(statusKey) { ... }

  // Custom Nav Back (if needed for non-tab page)
  navigateBack: function() {
    wx.navigateBack();
  }
}); 