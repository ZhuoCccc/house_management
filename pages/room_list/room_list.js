const fs = wx.getFileSystemManager(); // Add fs
// const db = require('../../utils/db.js'); // Remove old db import
const app = getApp();

// It's good practice to define these constants here if not already globally managed or imported,
// but ensure they are consistent with other files if they refer to the same cloud resources.
// For now, assuming they are specific to this page's needs for fetching a single hotel JSON.

Page({
  data: {
    allRooms: [], // Will hold all rooms for the specific hotel
    filteredRooms: [], // Rooms to display (can be filtered by availability, type etc. later)
    allRoomTypes: [], // Will hold all room types for the specific hotel
    displayedRoomTypes: [], // Room types to display, filtered by search
    searchQuery: '', // For search functionality
    checkInDate: '',
    checkOutDate: '',
    nights: 1,
    currentHotelFileID: null, // << CHANGED: To store the cloud FileID of the hotel JSON
    hotelName: '房间列表', // Default or to be updated from loaded hotel data
    isLoading: false, // For loading indicator
    // Map Chinese status to Pinyin class names for CSS
    statusClassMap: {
      '空闲': 'kongxian',
      '入住': 'ruzhu',
      '打扫中': 'dasao',
      '维修中': 'weixiu'
    }
  },

  onLoad: function(options) {
    console.log('[RoomList] onLoad options:', options);
    if (options.hotelFileID) { // << CHANGED: Expect hotelFileID (full cloud file ID)
      this.setData({ 
        currentHotelFileID: decodeURIComponent(options.hotelFileID),
        checkInDate: options.checkInDate || '',
        checkOutDate: options.checkOutDate || '',
        nights: options.nights ? parseInt(options.nights) : 1
      });
      // Initial load is now triggered by onShow or by the dirty check in onShow
    } else {
      console.error('[RoomList] Page loaded without a hotelFileID!');
      wx.showToast({
        title: '加载酒店信息失败',
        icon: 'none'
      });
      // Optionally navigate back
      // wx.navigateBack(); 
      return;
    }
    // Initial load of room data is now primarily handled by onShow to ensure freshness logic is centralized
  },

  onShow: function() {
    console.log('[RoomList] onShow triggered. CurrentHotelFileID:', this.data.currentHotelFileID);
    if (this.data.currentHotelFileID) {
      const hotelDataDirty = wx.getStorageSync('hotel_data_dirty');
      if (hotelDataDirty) {
        console.log('[RoomList] Hotel data is dirty, reloading current hotel details and rooms.');
        this.loadHotelDetailsAndRooms(this.data.currentHotelFileID);
        wx.removeStorageSync('hotel_data_dirty'); // Clear the flag
      } else {
        // Load if not dirty but rooms are not yet loaded (e.g., first load via onLoad then onShow)
        if ((!this.data.allRooms || this.data.allRooms.length === 0) && !this.data.isLoading) {
            console.log('[RoomList] Rooms not loaded and not dirty, attempting to load.');
            this.loadHotelDetailsAndRooms(this.data.currentHotelFileID);
        }
      }
    } else {
      console.warn('[RoomList] onShow: currentHotelFileID not available. Cannot load rooms.');
    }
  },

  loadHotelDetailsAndRooms: async function(hotelFileID) { // << NEW/REFACTORED FUNCTION
    if (!hotelFileID) {
      console.error('[RoomList] loadHotelDetailsAndRooms called without hotelFileID.');
      return;
    }
    console.log('[RoomList] Attempting to load hotel details and rooms for FileID:', hotelFileID);
    this.setData({ isLoading: true });
    wx.showLoading({ title: '加载房间...', mask: true });

    try {
      const downloadRes = await wx.cloud.downloadFile({ fileID: hotelFileID });
      const fileContent = fs.readFileSync(downloadRes.tempFilePath, 'utf-8');
      const hotelData = JSON.parse(fileContent);
      console.log('[RoomList] Successfully downloaded and parsed hotel data:', hotelData.name);

      const roomsForThisHotel = hotelData.roomTypes || [];
      const processedRooms = roomsForThisHotel.map(room => ({
        ...room,
        statusClass: this.data.statusClassMap[room.status] || 'default',
        videoUrl: room.roomTypeVideoFileID || null,
        // If you have a dedicated field in your JSON for video posters, map it here, e.g.:
        // videoPosterUrl: room.yourActualVideoPosterFieldInJson || null,
        // The WXML currently uses `poster="{{item.videoPosterUrl || item.roomTypeImageFileID}}"`
        // Ensure item.videoPosterUrl or item.roomTypeImageFileID is available if you need specific posters.
        // If roomTypeImageFileID was removed from JSON, that fallback won't work unless it's re-added or a new poster field is used.
      }));

      this.setData({
        hotelName: hotelData.name || '房间列表',
        allRoomTypes: processedRooms, // Store all fetched rooms
        isLoading: false
      });
      this.updateDisplayedRoomTypes(); // New: Apply search filter
      wx.setNavigationBarTitle({ title: this.data.hotelName + ' - 房间列表' });

    } catch (error) {
      console.error(`[RoomList] Failed to load hotel details or rooms for ${hotelFileID}:`, error);
      this.setData({ isLoading: false });
      wx.showToast({
        title: '加载房间信息失败',
        icon: 'none',
        duration: 2000
      });
    } finally {
      wx.hideLoading();
    }
  },

  onRoomSelect: function(event) {
    const roomId = event.currentTarget.dataset.id;
    const selectedRoom = this.data.allRoomTypes.find(room => room.id === roomId);

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
        url: `/pages/online_booking/online_booking?roomId=${selectedRoom.id}&roomNumber=${selectedRoom.roomNumber}&roomType=${encodeURIComponent(selectedRoom.type)}&roomPrice=${selectedRoom.price}&checkInDate=${this.data.checkInDate}&checkOutDate=${this.data.checkOutDate}&nights=${this.data.nights}&hotelId=${this.data.currentHotelFileID}` // Pass hotelId along
      });
    } else {
      wx.showToast({
        title: '选择的房间信息不存在',
        icon: 'none',
        duration: 2000
      });
    }
  },

  handleSearchInput: function(e) {
    const searchQuery = e.detail.value;
    this.setData({ searchQuery: searchQuery });
    if (!searchQuery) {
      this.updateDisplayedRoomTypes();
    }
    // Debounce or search on confirm for better performance on large lists
  },

  handleSearchConfirm: function() {
    this.updateDisplayedRoomTypes();
  },

  clearSearchQuery: function() {
    this.setData({ searchQuery: '' });
    this.updateDisplayedRoomTypes();
  },

  updateDisplayedRoomTypes: function() {
    const allTypes = this.data.allRoomTypes;
    const query = this.data.searchQuery.toLowerCase().trim();

    if (!query) {
      this.setData({ displayedRoomTypes: allTypes });
      return;
    }

    const filtered = allTypes.filter(roomType => {
      const nameMatch = roomType.type && roomType.type.toLowerCase().includes(query);
      // Assuming roomNumber might be part of the roomType object, or you might need to search within a nested array of rooms if structure is different
      const roomNumberMatch = roomType.roomNumber && roomType.roomNumber.toLowerCase().includes(query); 
      // If roomType.rooms is an array of individual rooms, you might want to search deeper:
      // const individualRoomNumberMatch = roomType.rooms && roomType.rooms.some(room => room.roomNumber && room.roomNumber.toLowerCase().includes(query));
      return nameMatch || roomNumberMatch; // || individualRoomNumberMatch;
    });
    this.setData({ displayedRoomTypes: filtered });
  }
}); 