const db = require('../../../utils/db.js');

Page({
  data: {
    hotelId: null,
    hotelName: '酒店房间',
    rooms: [],
    roomStatuses: ['空闲', '入住', '打扫中', '维修中'], // Available statuses
    statusClassMap: { // For WXML status badge styling
      '空闲': 'kongxian',
      '入住': 'ruzhu',
      '打扫中': 'dasao',
      '维修中': 'weixiu'
    }
  },

  onLoad: function (options) {
    if (options.hotelId) {
      this.setData({
        hotelId: options.hotelId,
        hotelName: options.hotelName ? decodeURIComponent(options.hotelName) : '酒店房间'
      });
      if (options.hotelName) {
        wx.setNavigationBarTitle({ title: decodeURIComponent(options.hotelName) + ' - 房间状态' });
      }
      this.loadRooms();
    } else {
      wx.showToast({
        title: '缺少酒店信息',
        icon: 'none',
        complete: () => wx.navigateBack()
      });
    }
  },

  loadRooms: function() {
    if (!this.data.hotelId) return;
    const hotelRooms = db.getRoomsByHotelId(this.data.hotelId);
    this.setData({
      rooms: hotelRooms
    });
  },

  onStatusChange: function(event) {
    const newStatusIndex = event.detail.value;
    const newStatus = this.data.roomStatuses[newStatusIndex];
    const roomId = event.currentTarget.dataset.roomid;
    const roomIndex = event.currentTarget.dataset.roomindex;

    if (!roomId || newStatus === undefined) {
      wx.showToast({ title: '操作失败', icon: 'none' });
      return;
    }

    const success = db.updateRoomDetails(roomId, { status: newStatus });

    if (success) {
      wx.showToast({ title: '状态已更新', icon: 'success', duration: 1000 });
      // Update local data to reflect change immediately
      this.setData({
        [`rooms[${roomIndex}].status`]: newStatus
      });
    } else {
      wx.showToast({ title: '更新失败，请重试', icon: 'none' });
      // Optionally reload all rooms if partial update is complex or fails
      // this.loadRooms(); 
    }
  }
}); 