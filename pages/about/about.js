Page({
  data: {
    // Custom Navigation Bar related
    statusBarHeight: wx.getSystemInfoSync().statusBarHeight,
    navBarHeight: wx.getMenuButtonBoundingClientRect().height + (wx.getMenuButtonBoundingClientRect().top - wx.getSystemInfoSync().statusBarHeight) * 2,
    navBarTitle: '关于我们',

    // Page specific data
    hotelName: '我的豪华酒店',
    hotelIntroLink: '/pages/hotel_info/hotel_info',
    contactNumber: '010-12345678',
    contactEmail: 'contact@myhotel.com',
    address: '中国北京市XX区YY路123号'
  },
  onLoad: function(options) {},

  navigateBack: function() {
    wx.navigateBack();
  },

  // Optional: Function to call the hotel
  callHotel: function() {
    wx.makePhoneCall({
      phoneNumber: this.data.contactNumber,
      fail: () => {
        wx.showToast({
          title: '拨号失败',
          icon: 'none'
        });
      }
    });
  }
}); 