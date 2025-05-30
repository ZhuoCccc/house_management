Page({
  data: {
    roomId: null,
    roomName: '',
    roomPrice: 0,
    checkInDate: '',
    checkOutDate: '',
    nights: 1
  },
  onLoad: function(options) {
    if (options.roomId) {
      this.setData({
        roomId: options.roomId,
        roomName: decodeURIComponent(options.roomName || ''),
        roomPrice: parseFloat(options.roomPrice || 0),
        checkInDate: options.checkInDate || '',
        checkOutDate: options.checkOutDate || '',
        nights: parseInt(options.nights || 1)
      });
      // You can also fetch full room details here using the roomId if needed
      console.log('Online Booking Page - Received Data:', this.data);
    }
  },
  navigateToFillOrder: function() {
    const { roomId, roomName, roomPrice, checkInDate, checkOutDate, nights } = this.data;
    wx.navigateTo({
      url: `/pages/fill_order/fill_order?roomId=${roomId}&roomName=${encodeURIComponent(roomName)}&roomPrice=${roomPrice}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}&nights=${nights}`
    });
  }
}); 