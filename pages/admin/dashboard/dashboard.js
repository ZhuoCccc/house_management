const app = getApp();
const db = require('../../../utils/db.js'); // Correct path to db.js

Page({
  data: {
    adminUsername: '管理员',
    navBarHeight: app.globalData.navBarHeight,
    statusBarHeight: app.globalData.statusBarHeight,
    rooms: [], // To store room data
    filterStatus: '全部', // Default filter
    statusOptions: ['全部', '空闲', '入住', '打扫中', '维修中'],
    statusOptionsForEdit: ['空闲', '入住', '打扫中', '维修中'], // For modal picker

    showEditModal: false,
    editingRoom: null, // Stores the full room object being edited
    currentRoomId: null,
    editedRoomNumber: '',
    editedRoomType: '',
    editedRoomStatus: ''
  },

  onLoad: function (options) {
    console.log('dashboard.js: onLoad triggered');
    const loggedInUser = app.globalData.loggedInUser;
    if (loggedInUser && loggedInUser.type === 'admin') {
      this.setData({
        adminUsername: loggedInUser.username
      });
      this.loadRoomData(); // Load room data on page load
    } else {
      // Optional: Redirect to login if not an admin or not logged in
      // This is a basic check, more robust checks might be needed in a real app
      wx.showToast({
        title: '请先以管理员身份登录',
        icon: 'none',
        duration: 2000,
        complete: () => {
          wx.redirectTo({ url: '/pages/login/login' });
        }
      });
    }
  },

  onShow: function () {
    console.log('dashboard.js: onShow triggered');
    // Ensure admin is still logged in and refresh data if necessary
    const loggedInUser = app.globalData.loggedInUser;
    if (!loggedInUser || loggedInUser.type !== 'admin') {
      wx.redirectTo({ url: '/pages/login/login' });
      return; // Stop further execution if not admin
    }
    this.loadRoomData(); // Refresh room data when page is shown
  },

  loadRoomData: function() {
    console.log('dashboard.js: loadRoomData called');
    const allRooms = db.getAllRooms();
    console.log('dashboard.js: Loaded rooms from db.getAllRooms():', JSON.stringify(allRooms));
    this.setData({
      rooms: allRooms || [] // Ensure it's an array
    });
    console.log('dashboard.js: setData for rooms done after loadRoomData. Current this.data.rooms count:', this.data.rooms.length, 'Full data:', JSON.stringify(this.data.rooms));
    this.applyFilter(); // Apply current filter after loading
  },

  applyFilter: function() {
    console.log('dashboard.js: applyFilter called with filterStatus:', this.data.filterStatus);
    const { filterStatus } = this.data;
    let filteredRooms = db.getAllRooms(); // Get fresh copy
    console.log('dashboard.js: Rooms from db.getAllRooms() in applyFilter:', JSON.stringify(filteredRooms));
    if (filterStatus !== '全部') {
      filteredRooms = filteredRooms.filter(room => room.status === filterStatus);
      console.log('dashboard.js: Rooms after filtering (' + filterStatus + '):', JSON.stringify(filteredRooms));
    }
    this.setData({ rooms: filteredRooms || [] }); // Ensure it's an array
    console.log('dashboard.js: setData for rooms done after applyFilter. Current this.data.rooms count:', this.data.rooms.length, 'Full data:', JSON.stringify(this.data.rooms));
  },

  onFilterChange: function(e) {
    this.setData({
      filterStatus: this.data.statusOptions[e.detail.value] // Get string value from picker
    });
    this.applyFilter();
  },
  
  // Placeholder for navigating to a dedicated management section page
  navigateToManagementHub: function() {
    // This page would contain the grid navigation previously on the dashboard
    wx.navigateTo({ url: '/pages/admin/management_hub/management_hub' }); 
  },

  logoutAdmin: function() {
    app.globalData.loggedInUser = null;
    wx.removeStorageSync('loggedInUser');
    wx.redirectTo({
      url: '/pages/login/login'
    });
  },

  openEditModal: function(e) {
    const roomId = e.currentTarget.dataset.roomid;
    const roomToEdit = this.data.rooms.find(room => room.id === roomId) || db.getAllRooms().find(room => room.id === roomId) ; // Fallback to all rooms if not in filtered list
    
    if (roomToEdit) {
      this.setData({
        showEditModal: true,
        editingRoom: roomToEdit,
        currentRoomId: roomId,
        editedRoomNumber: roomToEdit.roomNumber,
        editedRoomType: roomToEdit.type,
        editedRoomStatus: roomToEdit.status
      });
    } else {
      wx.showToast({ title: '找不到房间信息', icon: 'none' });
    }
  },

  closeEditModal: function() {
    this.setData({
      showEditModal: false,
      editingRoom: null,
      currentRoomId: null,
      editedRoomNumber: '',
      editedRoomType: '',
      editedRoomStatus: ''
    });
  },

  handleModalInputChange: function(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [field]: e.detail.value
    });
  },

  handleModalStatusChange: function(e) {
    this.setData({
      editedRoomStatus: this.data.statusOptionsForEdit[e.detail.value]
    });
  },

  saveRoomChanges: function() {
    if (!this.data.currentRoomId) return;

    if (!this.data.editedRoomNumber.trim() || !this.data.editedRoomType.trim()) {
        wx.showToast({ title: '房间号和房型不能为空', icon: 'none' });
        return;
    }

    const updatedDetails = {
      roomNumber: this.data.editedRoomNumber.trim(),
      type: this.data.editedRoomType.trim(),
      status: this.data.editedRoomStatus
    };

    const success = db.updateRoomDetails(this.data.currentRoomId, updatedDetails);

    if (success) {
      wx.showToast({ title: '修改成功', icon: 'success' });
      this.loadRoomData(); // Refresh the list
      this.closeEditModal();
    } else {
      wx.showToast({ title: '修改失败', icon: 'none' });
    }
  }
}); 