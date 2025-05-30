const db = require('../../utils/db.js'); // Import the db utility
const app = getApp();

Page({
  data: {
    allRooms: [], // Will hold rooms from db.js
    filteredRooms: [], // Rooms to display (can be filtered by availability, type etc. later)
    checkInDate: '',
    checkOutDate: '',
    nights: 1,
    // Map Chinese status to Pinyin class names for CSS
    statusClassMap: {
      '空闲': 'kongxian',
      '入住': 'ruzhu',
      '打扫中': 'dasao',
      '维修中': 'weixiu'
    },
    hotelId: 'h001' // Assuming this page is specific to h001, may need to adjust data loading logic
  },

  onLoad: function(options) {
    if (options.checkInDate && options.checkOutDate && options.nights) {
      this.setData({
        checkInDate: options.checkInDate,
        checkOutDate: options.checkOutDate,
        nights: parseInt(options.nights)
      });
    }
    // Initial load of room data is handled by onShow to ensure freshness
    // Consider using this.data.hotelId to filter rooms in loadAndDisplayRooms if db.getAllRooms() returns all rooms for all hotels
  },

  onShow: function() {
    // Load or refresh room data every time the page is shown
    this.loadAndDisplayRooms();
  },

  loadAndDisplayRooms: function() {
    // IMPORTANT: This function currently loads ALL rooms from db.js.
    // It needs to be modified to load or filter rooms specifically for this.data.hotelId (e.g., 'h001')
    // For now, it will display all rooms, which is not the final desired behavior for hotel-specific pages.
    let roomsFromDb = db.getAllRooms(); // This likely gets all rooms for all hotels
    
    // Placeholder for filtering logic - this needs to be implemented based on how db.js stores/retrieves rooms by hotel
    // Example: if db.getRoomsByHotelId(hotelId) exists:
    // roomsFromDb = db.getRoomsByHotelId(this.data.hotelId);
    // Or if rooms have a hotelId property: 
    // roomsFromDb = roomsFromDb.filter(room => room.hotelId === this.data.hotelId);

    const processedRooms = roomsFromDb.map(room => {
      return {
        ...room,
        statusClass: this.data.statusClassMap[room.status] || 'default' // Add a fallback class
      };
    });

    this.setData({
      allRooms: processedRooms,
      filteredRooms: processedRooms 
    });
    // console.log('Rooms loaded for room_list:', this.data.filteredRooms);
  },

  onRoomSelect: function(event) {
    const roomId = event.currentTarget.dataset.id;
    const selectedRoom = this.data.allRooms.find(room => room.id === roomId);

    if (selectedRoom) {
      if (selectedRoom.status !== '空闲') {
        wx.showToast({
          title: `该房间 [${selectedRoom.roomNumber}] 当前状态为 ${selectedRoom.status}，不可预订。`,
          icon: 'none',
          duration: 2500
        });
        return;
      }

      wx.navigateTo({
        url: `/pages/online_booking/online_booking?roomId=${selectedRoom.id}&roomNumber=${selectedRoom.roomNumber}&roomType=${encodeURIComponent(selectedRoom.type)}&roomPrice=${selectedRoom.price}&checkInDate=${this.data.checkInDate}&checkOutDate=${this.data.checkOutDate}&nights=${this.data.nights}`
      });
    } else {
      wx.showToast({
        title: '选择的房间信息不存在',
        icon: 'none',
        duration: 2000
      });
    }
  }
}); 