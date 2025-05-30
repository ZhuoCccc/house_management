Page({
  data: {},
  viewMyOrders: function() {
    // Navigate to My Orders page - assuming it's a tab or a specific page
    // For now, let's assume it's a tab page /pages/profile/profile which might list orders
    wx.switchTab({ url: '/pages/profile/profile' });
  },
  backToHome: function() {
    wx.switchTab({ url: '/pages/home/home' });
  }
}); 